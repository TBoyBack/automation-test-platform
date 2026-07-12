const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const express = require('express');

const routePath = path.join(__dirname, 'cases.js');
const dbPath = path.join(__dirname, '..', 'db.js');

function loadRouterWithDb(db) {
  delete require.cache[routePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../db' && parent?.filename === routePath) {
      return db;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(routePath);
  } finally {
    Module._load = originalLoad;
  }
}

function createServer(router) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);
  return http.createServer(app);
}

async function request(server, method, pathname, body) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const payload = body ? JSON.stringify(body) : undefined;
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: payload ? { 'content-type': 'application/json' } : undefined,
    body: payload,
  });

  const text = await response.text();
  server.close();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

test('cases router loads with its configured database module', () => {
  delete require.cache[routePath];

  assert.equal(fs.existsSync(dbPath), true);
  assert.doesNotThrow(() => require(routePath));
});

test('creating a case lets PostgreSQL generate the SERIAL id and preserves JSONB content', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ id: 42, name: params[1], content: params[4] }] };
    },
  };

  const router = loadRouterWithDb(db);
  const server = createServer(router);

  const content = { steps: [{ action: 'tap', target: 'login' }] };
  const response = await request(server, 'POST', '/api/v1/cases', {
    suite_id: 7,
    name: 'login flow',
    description: 'critical path',
    type: 'native',
    content,
  });

  assert.equal(response.status, 201);
  assert.equal(queries.length, 1);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case\s*\(\s*id\b/i);
  assert.deepEqual(queries[0].params, [
    7,
    'login flow',
    'critical path',
    'native',
    content,
    'system',
  ]);
  assert.deepEqual(response.body.data.content, content);
});

test('running a case lets PostgreSQL generate the execution id returned to clients', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (/FROM test_case/i.test(sql)) {
        return { rows: [{ id: 42, suite_id: 7, content: { steps: [] } }] };
      }

      if (/FROM test_suite/i.test(sql)) {
        return { rows: [{ id: 7 }] };
      }

      if (/INSERT INTO test_execution/i.test(sql)) {
        return { rows: [{ id: 99 }] };
      }

      throw new Error(`unexpected query: ${sql}`);
    },
  };

  const router = loadRouterWithDb(db);
  const server = createServer(router);

  const response = await request(server, 'POST', '/api/v1/cases/42/run', {
    device_id: 3,
    params: { retry: 1 },
  });

  const insert = queries.find((entry) => /INSERT INTO test_execution/i.test(entry.sql));

  assert.equal(response.status, 200);
  assert.ok(insert);
  assert.doesNotMatch(insert.sql, /INSERT INTO test_execution\s*\(\s*id\b/i);
  assert.match(insert.sql, /RETURNING id/i);
  assert.deepEqual(insert.params, [7, 3]);
  assert.equal(response.body.data.execution_id, 99);
});

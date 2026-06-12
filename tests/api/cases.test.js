const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const Module = require('node:module');

const express = require('express');

const routePath = path.resolve(__dirname, '../../src/api/routes/cases.js');

function loadCasesRouterWithDb(db) {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../db' && parent?.filename === routePath) {
      return db;
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    delete require.cache[routePath];
    return require(routePath);
  } finally {
    Module._load = originalLoad;
  }
}

function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', loadCasesRouterWithDb(db));
  return app;
}

async function request(app, method, url, body) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('POST /cases lets PostgreSQL generate the integer test_case id', async () => {
  let insert;
  const db = {
    async query(sql, params) {
      if (/INSERT INTO test_case/i.test(sql)) {
        insert = { sql, params };
        return {
          rows: [{
            id: 42,
            suite_id: params[0],
            name: params[1],
            description: params[2],
            type: params[3],
            content: params[4],
            created_by: params[5],
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const response = await request(createApp(db), 'POST', '/api/v1/cases', {
    suite_id: 1,
    name: 'Login flow',
    description: 'Valid login',
    type: 'webview',
    content: { steps: [] },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, 42);
  assert.ok(insert, 'expected an INSERT INTO test_case query');
  assert.doesNotMatch(insert.sql, /INSERT INTO test_case\s*\(\s*id\b/i);
  assert.match(insert.sql, /RETURNING \*/i);
  assert.deepEqual(insert.params, [
    1,
    'Login flow',
    'Valid login',
    'webview',
    JSON.stringify({ steps: [] }),
    'system',
  ]);
});

test('POST /cases/:id/run returns the generated integer test_execution id', async () => {
  let insert;
  const db = {
    async query(sql, params) {
      if (/SELECT \* FROM test_case WHERE id = \$1/i.test(sql)) {
        return {
          rows: [{
            id: Number(params[0]),
            suite_id: 7,
            name: 'Login flow',
            content: { steps: [] },
          }],
        };
      }

      if (/SELECT \* FROM test_suite WHERE id = \$1/i.test(sql)) {
        return { rows: [{ id: params[0], name: 'Smoke suite' }] };
      }

      if (/INSERT INTO test_execution/i.test(sql)) {
        insert = { sql, params };
        return { rows: [{ id: 99 }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const response = await request(createApp(db), 'POST', '/api/v1/cases/5/run', {
    device_id: 3,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.execution_id, 99);
  assert.ok(insert, 'expected an INSERT INTO test_execution query');
  assert.doesNotMatch(insert.sql, /INSERT INTO test_execution\s*\(\s*id\b/i);
  assert.match(insert.sql, /RETURNING id/i);
  assert.deepEqual(insert.params, [7, 3]);
});

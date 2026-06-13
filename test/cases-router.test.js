const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const test = require('node:test');

const express = require('express');

const casesRouterPath = require.resolve('../src/api/routes/cases');

function loadRouterWithDb(db) {
  const originalLoad = Module._load;
  delete require.cache[casesRouterPath];

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../db' && parent?.filename === casesRouterPath) {
      return db;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(casesRouterPath);
  } finally {
    Module._load = originalLoad;
  }
}

async function request(app, method, path, body) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json();
    return { status: response.status, body: json };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use(loadRouterWithDb(db));
  return app;
}

test('POST /cases lets PostgreSQL generate the SERIAL case id', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          id: 42,
          suite_id: 7,
          name: 'login',
          type: 'native',
          content: { steps: [] },
        }],
      };
    },
  };

  const response = await request(createApp(db), 'POST', '/cases', {
    suite_id: 7,
    name: 'login',
    type: 'native',
    content: { steps: [] },
  });

  assert.equal(response.status, 201);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /INSERT INTO test_case\s*\(\s*id\b/i);
  assert.equal(calls[0].params[0], 7);
});

test('POST /cases/:id/run returns the generated SERIAL execution id', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/FROM test_case/.test(sql)) {
        return { rows: [{ id: 42, suite_id: 7, name: 'login' }] };
      }
      if (/FROM test_suite/.test(sql)) {
        return { rows: [{ id: 7, name: 'smoke' }] };
      }
      if (/INSERT INTO test_execution/.test(sql)) {
        return { rows: [{ id: 99 }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };

  const response = await request(createApp(db), 'POST', '/cases/42/run', {
    device_id: 3,
  });

  const insert = calls.find((call) => /INSERT INTO test_execution/.test(call.sql));
  assert.equal(response.status, 200);
  assert.ok(insert);
  assert.doesNotMatch(insert.sql, /INSERT INTO test_execution\s*\(\s*id\b/i);
  assert.deepEqual(insert.params, [7, 3]);
  assert.equal(response.body.data.execution_id, 99);
});

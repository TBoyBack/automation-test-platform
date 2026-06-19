const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const test = require('node:test');

const express = require('express');

const routerPath = require.resolve('./cases');
const dbPath = require.resolve('../db');

function withMockedDb(query, callback) {
  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === '../db' && parent?.filename === routerPath) {
      return { query };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[routerPath];

  try {
    return callback(require('./cases'));
  } finally {
    delete require.cache[routerPath];
    Module._load = originalLoad;
  }
}

async function request(app, method, path, body) {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

test('database module exposes a query function for route startup', () => {
  const db = require(dbPath);

  assert.equal(typeof db.query, 'function');
});

test('case creation lets PostgreSQL generate the integer primary key', async () => {
  const calls = [];

  await withMockedDb(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: 42, name: 'checkout flow' }] };
  }, async (router) => {
    const response = await request(
      createApp(router),
      'POST',
      '/cases',
      {
        suite_id: 7,
        name: 'checkout flow',
        type: 'web',
        content: { steps: [] },
      }
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.data.id, 42);
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO test_case \(suite_id, name, description, type, content, created_by, created_at, updated_at\)/);
  assert.deepEqual(calls[0].params, [
    7,
    'checkout flow',
    undefined,
    'web',
    JSON.stringify({ steps: [] }),
    'system',
  ]);
});

test('case execution lets PostgreSQL generate the integer execution id', async () => {
  const calls = [];

  await withMockedDb(async (sql, params) => {
    calls.push({ sql, params });

    if (/FROM test_case/.test(sql)) {
      return { rows: [{ id: 13, suite_id: 7 }] };
    }

    if (/FROM test_suite/.test(sql)) {
      return { rows: [{ id: 7 }] };
    }

    return { rows: [{ id: 99 }] };
  }, async (router) => {
    const response = await request(
      createApp(router),
      'POST',
      '/cases/13/run',
      {
        device_id: 3,
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, { execution_id: 99 });
  });

  assert.equal(calls.length, 3);
  assert.match(calls[2].sql, /INSERT INTO test_execution \(suite_id, device_id, status, start_time, created_at\)/);
  assert.match(calls[2].sql, /RETURNING id/);
  assert.deepEqual(calls[2].params, [7, 3]);
});

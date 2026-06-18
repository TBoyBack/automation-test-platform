const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

function clearCasesModules() {
  for (const modulePath of ['./cases', '../db']) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }
  }
}

function buildApp(query) {
  clearCasesModules();

  let db;
  assert.doesNotThrow(() => {
    db = require('../db');
  }, 'cases route requires a database adapter at src/api/db.js');

  db.query = query;

  const app = express();
  app.use(express.json());
  app.use(require('./cases'));
  return app;
}

async function request(app, method, path, body) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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

test('POST /cases lets PostgreSQL generate the case id', async () => {
  const queries = [];
  const app = buildApp(async (sql, params) => {
    queries.push({ sql, params });
    return {
      rows: [
        {
          id: 42,
          suite_id: params[0],
          name: params[1],
          description: params[2],
          type: params[3],
          content: params[4],
          created_by: params[5],
        },
      ],
    };
  });

  const response = await request(app, 'POST', '/cases', {
    suite_id: 7,
    name: 'Login smoke test',
    description: 'critical login path',
    type: 'native',
    content: { steps: [{ action: 'tap', target: 'login' }] },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, 42);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /INSERT INTO test_case/i);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case\s*\(\s*id\s*,/i);
  assert.deepEqual(queries[0].params, [
    7,
    'Login smoke test',
    'critical login path',
    'native',
    JSON.stringify({ steps: [{ action: 'tap', target: 'login' }] }),
    'system',
  ]);
});

test('POST /cases/:id/run returns the generated execution id', async () => {
  const queries = [];
  const app = buildApp(async (sql, params) => {
    queries.push({ sql, params });

    if (/FROM test_case/i.test(sql)) {
      return { rows: [{ id: params[0], suite_id: 7, name: 'Login smoke test' }] };
    }

    if (/FROM test_suite/i.test(sql)) {
      return { rows: [{ id: params[0], name: 'Smoke suite' }] };
    }

    if (/INSERT INTO test_execution/i.test(sql)) {
      return { rows: [{ id: 99 }] };
    }

    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app, 'POST', '/cases/42/run', {
    device_id: 3,
    params: { retries: 1 },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.execution_id, 99);

  const executionInsert = queries.find(({ sql }) => /INSERT INTO test_execution/i.test(sql));
  assert.ok(executionInsert);
  assert.doesNotMatch(
    executionInsert.sql,
    /INSERT INTO test_execution\s*\(\s*id\s*,/i
  );
  assert.match(executionInsert.sql, /RETURNING id/i);
  assert.deepEqual(executionInsert.params, [7, 3]);
});

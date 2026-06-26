const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

function loadRouter() {
  delete require.cache[require.resolve('./cases')];
  return require('./cases');
}

function loadDb() {
  delete require.cache[require.resolve('../db')];
  return require('../db');
}

async function request(app, path, options) {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    return await fetch(`http://127.0.0.1:${port}${path}`, options);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createApp(query) {
  const db = loadDb();
  db.query = query;

  const app = express();
  app.use(express.json());
  app.use('/api/v1', loadRouter());
  return app;
}

test('cases router loads with a database adapter', () => {
  assert.doesNotThrow(() => loadRouter());
});

test('creating a case lets PostgreSQL generate the serial id', async () => {
  const queries = [];
  const app = createApp(async (sql, params) => {
    queries.push({ sql, params });

    assert.match(sql, /INSERT INTO test_case/);
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
  });

  const response = await request(app, '/api/v1/cases', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      suite_id: 7,
      name: 'checkout flow',
      description: 'covers checkout',
      type: 'h5',
      content: { steps: ['open checkout'] },
    }),
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.data.id, 42);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /INSERT INTO test_case\s*\(\s*suite_id,/);
  assert.deepEqual(queries[0].params, [
    7,
    'checkout flow',
    'covers checkout',
    'h5',
    JSON.stringify({ steps: ['open checkout'] }),
    'system',
  ]);
});

test('running a case returns the PostgreSQL-generated execution id', async () => {
  const queries = [];
  const app = createApp(async (sql, params) => {
    queries.push({ sql, params });

    if (/SELECT \* FROM test_case/.test(sql)) {
      return { rows: [{ id: 5, suite_id: 9, name: 'checkout flow' }] };
    }

    if (/SELECT \* FROM test_suite/.test(sql)) {
      return { rows: [{ id: 9, name: 'suite' }] };
    }

    if (/INSERT INTO test_execution/.test(sql)) {
      return { rows: [{ id: 123 }] };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const response = await request(app, '/api/v1/cases/5/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_id: 3, params: { retries: 1 } }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.execution_id, 123);

  const executionInsert = queries.find(({ sql }) => /INSERT INTO test_execution/.test(sql));
  assert.ok(executionInsert);
  assert.match(executionInsert.sql, /INSERT INTO test_execution\s*\(\s*suite_id,/);
  assert.match(executionInsert.sql, /RETURNING id/);
  assert.deepEqual(executionInsert.params, [9, 3]);
});

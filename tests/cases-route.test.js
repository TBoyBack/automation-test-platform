const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');

const db = require('../src/api/db');
const casesRouter = require('../src/api/routes/cases');

function createServer(queryHandler) {
  db.query = queryHandler;

  const app = express();
  app.use(express.json());
  app.use('/api/v1', casesRouter);

  return http.createServer(app);
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, () => resolve(server.address().port));
    server.on('error', reject);
  });
}

async function request(server, path, options) {
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
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

test('POST /cases lets PostgreSQL generate the integer case id', async () => {
  const queries = [];
  const server = createServer(async (sql, params) => {
    queries.push({ sql, params });
    return {
      rows: [{
        id: 101,
        suite_id: 7,
        name: 'Login flow',
        type: 'h5',
      }],
    };
  });

  const response = await request(server, '/api/v1/cases', {
    method: 'POST',
    body: {
      suite_id: 7,
      name: 'Login flow',
      type: 'h5',
      content: { steps: [] },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, 101);
  assert.match(queries[0].sql, /INSERT INTO test_case \(suite_id, name, description, type, content, created_by, created_at, updated_at\)/);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case \(id,/);
  assert.deepEqual(queries[0].params, [
    7,
    'Login flow',
    undefined,
    'h5',
    JSON.stringify({ steps: [] }),
    'system',
  ]);
});

test('POST /cases/:id/run returns the database-generated execution id', async () => {
  const queries = [];
  const server = createServer(async (sql, params) => {
    queries.push({ sql, params });

    if (/SELECT \* FROM test_case/.test(sql)) {
      return { rows: [{ id: 101, suite_id: 7 }] };
    }

    if (/INSERT INTO test_execution/.test(sql)) {
      return { rows: [{ id: 202 }] };
    }

    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(server, '/api/v1/cases/101/run', {
    method: 'POST',
    body: { device_id: 4 },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.execution_id, 202);

  const insert = queries.find((query) => /INSERT INTO test_execution/.test(query.sql));
  assert.ok(insert);
  assert.match(insert.sql, /INSERT INTO test_execution \(suite_id, device_id, status, start_time, created_at\)/);
  assert.doesNotMatch(insert.sql, /INSERT INTO test_execution \(id,/);
  assert.deepEqual(insert.params, [7, 4]);
});

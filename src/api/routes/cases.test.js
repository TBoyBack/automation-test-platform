const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

function clearApiModules() {
  for (const modulePath of ['./cases', '../db']) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // The missing module case is one of the regressions covered below.
    }
  }
}

function loadCasesRouter() {
  clearApiModules();
  return require('./cases');
}

function makeAppWithDb(dbQuery) {
  const router = loadCasesRouter();
  const db = require('../db');
  db.query = dbQuery;

  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);
  return app;
}

async function request(app, method, path, body) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
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

test('cases router loads with its database dependency present', () => {
  assert.doesNotThrow(() => loadCasesRouter());
});

test('creating a case lets PostgreSQL generate the SERIAL id', async () => {
  const calls = [];
  const app = makeAppWithDb(async (sql, params) => {
    calls.push({ sql, params });
    return {
      rows: [{
        id: 101,
        suite_id: params[0],
        name: params[1],
        type: params[3],
        content: params[4],
      }],
    };
  });

  const response = await request(app, 'POST', '/api/v1/cases', {
    suite_id: 7,
    name: 'Checkout flow',
    type: 'h5',
    content: { steps: [{ action: 'tap' }] },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, 101);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO test_case/i);
  assert.doesNotMatch(calls[0].sql, /\(\s*id\s*,/i);
  assert.equal(calls[0].params.length, 6);
  assert.equal(calls[0].params[0], 7);
  assert.equal(calls[0].params[1], 'Checkout flow');
  assert.equal(calls[0].params[3], 'h5');
  assert.deepEqual(JSON.parse(calls[0].params[4]), { steps: [{ action: 'tap' }] });
});

test('running a case lets PostgreSQL generate the execution SERIAL id', async () => {
  const calls = [];
  const app = makeAppWithDb(async (sql, params) => {
    calls.push({ sql, params });

    if (/SELECT \* FROM test_case/i.test(sql)) {
      return { rows: [{ id: 9, suite_id: 12, content: { steps: [] } }] };
    }

    if (/SELECT \* FROM test_suite/i.test(sql)) {
      return { rows: [{ id: 12, name: 'Smoke suite' }] };
    }

    if (/INSERT INTO test_execution/i.test(sql)) {
      return { rows: [{ id: 303 }] };
    }

    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app, 'POST', '/api/v1/cases/9/run', {
    device_id: 5,
    params: { locale: 'zh-CN' },
  });

  const insertCall = calls.find((call) => /INSERT INTO test_execution/i.test(call.sql));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.execution_id, 303);
  assert.ok(insertCall);
  assert.doesNotMatch(insertCall.sql, /\(\s*id\s*,/i);
  assert.match(insertCall.sql, /RETURNING id/i);
  assert.deepEqual(insertCall.params, [12, 5]);
});

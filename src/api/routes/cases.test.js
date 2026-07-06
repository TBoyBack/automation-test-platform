const assert = require('node:assert/strict');
const test = require('node:test');

function loadRouterAndDb() {
  delete require.cache[require.resolve('./cases')];
  const db = require('../db');
  db.query = async () => {
    throw new Error('db.query mock not configured');
  };
  return { router: require('./cases'), db };
}

function findRouteHandler(router, method, path) {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods[method]
  );

  assert.ok(layer, `Expected ${method.toUpperCase()} ${path} route to exist`);
  return layer.route.stack[0].handle;
}

function createJsonResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('cases router loads with its database adapter', () => {
  assert.doesNotThrow(() => loadRouterAndDb());
});

test('POST /cases lets PostgreSQL generate SERIAL case ids', async () => {
  const { router, db } = loadRouterAndDb();
  const handler = findRouteHandler(router, 'post', '/cases');
  let insertCall;

  db.query = async (sql, params) => {
    insertCall = { sql, params };
    return {
      rows: [
        {
          id: 101,
          suite_id: 12,
          name: 'Login case',
          description: 'critical login flow',
          type: 'web',
          content: { steps: [] },
          created_by: 'user-1',
        },
      ],
    };
  };

  const res = createJsonResponse();

  await handler(
    {
      body: {
        suite_id: 12,
        name: 'Login case',
        description: 'critical login flow',
        type: 'web',
        content: { steps: [] },
      },
      user: { id: 'user-1' },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 101);
  assert.doesNotMatch(insertCall.sql, /INSERT INTO test_case\s*\(\s*id\b/i);
  assert.deepEqual(insertCall.params, [
    12,
    'Login case',
    'critical login flow',
    'web',
    JSON.stringify({ steps: [] }),
    'user-1',
  ]);
});

test('POST /cases/:id/run lets PostgreSQL generate SERIAL execution ids', async () => {
  const { router, db } = loadRouterAndDb();
  const handler = findRouteHandler(router, 'post', '/cases/:id/run');
  let executionInsertCall;

  db.query = async (sql, params) => {
    if (/SELECT \* FROM test_case/i.test(sql)) {
      return { rows: [{ id: 5, suite_id: 7, type: 'web', content: {} }] };
    }

    if (/SELECT \* FROM test_suite/i.test(sql)) {
      return { rows: [{ id: 7, name: 'Smoke suite' }] };
    }

    if (/INSERT INTO test_execution/i.test(sql)) {
      executionInsertCall = { sql, params };
      return { rows: [{ id: 55 }] };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const res = createJsonResponse();

  await handler(
    {
      params: { id: '5' },
      body: { device_id: 3 },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.execution_id, 55);
  assert.doesNotMatch(
    executionInsertCall.sql,
    /INSERT INTO test_execution\s*\(\s*id\b/i
  );
  assert.deepEqual(executionInsertCall.params, [7, 3]);
});

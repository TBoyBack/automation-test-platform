const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');

function freshCasesRouter() {
  const routePath = require.resolve('./cases');
  delete require.cache[routePath];
  return require('./cases');
}

function findRouteHandler(router, method, path) {
  const layer = router.stack.find((item) => {
    return item.route?.path === path && item.route.methods[method];
  });

  assert.ok(layer, `expected ${method.toUpperCase()} ${path} route to exist`);
  return layer.route.stack[0].handle;
}

function createResponse() {
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

test('cases route loads with its database dependency', () => {
  const router = freshCasesRouter();

  assert.equal(typeof router, 'function');
});

test('creating a case lets PostgreSQL generate the SERIAL case id', async (t) => {
  const queries = [];
  t.mock.method(db, 'query', async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [{ id: 42, name: 'Login flow' }] };
  });
  const router = freshCasesRouter();
  const handler = findRouteHandler(router, 'post', '/cases');
  const res = createResponse();

  await handler(
    {
      body: {
        suite_id: 7,
        name: 'Login flow',
        description: 'critical path',
        type: 'native',
        content: [{ action: 'tap', target: 'login' }],
      },
      user: { id: 'qa' },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.match(queries[0].sql, /INSERT INTO test_case \(suite_id, name, description, type, content, created_by, created_at, updated_at\)/);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case \(id,/);
  assert.deepEqual(queries[0].params, [
    7,
    'Login flow',
    'critical path',
    'native',
    JSON.stringify([{ action: 'tap', target: 'login' }]),
    'qa',
  ]);
});

test('running a case returns the PostgreSQL generated SERIAL execution id', async (t) => {
  const queries = [];
  t.mock.method(db, 'query', async (sql, params) => {
    queries.push({ sql, params });

    if (/FROM test_case/.test(sql)) {
      return { rows: [{ id: 5, suite_id: 7, name: 'Login flow' }] };
    }

    if (/FROM test_suite/.test(sql)) {
      return { rows: [{ id: 7, name: 'Smoke suite' }] };
    }

    return { rows: [{ id: 99 }] };
  });
  const router = freshCasesRouter();
  const handler = findRouteHandler(router, 'post', '/cases/:id/run');
  const res = createResponse();

  await handler(
    {
      params: { id: 5 },
      body: { device_id: 3 },
    },
    res
  );

  const insertQuery = queries[2];
  assert.match(insertQuery.sql, /INSERT INTO test_execution \(suite_id, device_id, status, start_time, created_at\)/);
  assert.doesNotMatch(insertQuery.sql, /INSERT INTO test_execution \(id,/);
  assert.match(insertQuery.sql, /RETURNING id/);
  assert.deepEqual(insertQuery.params, [7, 3]);
  assert.deepEqual(res.body.data, { execution_id: 99 });
});

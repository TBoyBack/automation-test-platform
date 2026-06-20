const assert = require('node:assert/strict');
const test = require('node:test');

const db = require('../db');

function loadRouterWithQuery(query) {
  db.query = query;
  delete require.cache[require.resolve('./cases')];
  return require('./cases');
}

function getHandler(router, method, path) {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods[method]
  );

  assert.ok(layer, `Expected ${method.toUpperCase()} ${path} route to exist`);
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
  const router = loadRouterWithQuery(async () => ({ rows: [] }));

  assert.equal(typeof router, 'function');
});

test('creating a case lets Postgres generate the SERIAL id', async () => {
  const queries = [];
  const router = loadRouterWithQuery(async (sql, params) => {
    queries.push({ sql, params });
    return {
      rows: [
        {
          id: 42,
          suite_id: 7,
          name: 'checkout flow',
          type: 'webview',
          content: { steps: [] },
        },
      ],
    };
  });
  const handler = getHandler(router, 'post', '/cases');
  const res = createResponse();

  await handler(
    {
      body: {
        suite_id: 7,
        name: 'checkout flow',
        type: 'webview',
        content: { steps: [] },
      },
      user: { id: 'qa-user' },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 42);
  assert.match(queries[0].sql, /INSERT INTO test_case\s+\(suite_id, name, description, type, content, created_by, created_at, updated_at\)/);
  assert.deepEqual(queries[0].params, [
    7,
    'checkout flow',
    undefined,
    'webview',
    JSON.stringify({ steps: [] }),
    'qa-user',
  ]);
});

test('running a case lets Postgres generate the execution SERIAL id', async () => {
  const queries = [];
  const router = loadRouterWithQuery(async (sql, params) => {
    queries.push({ sql, params });

    if (/FROM test_case/.test(sql)) {
      return { rows: [{ id: 3, suite_id: 7, name: 'checkout flow' }] };
    }

    if (/FROM test_suite/.test(sql)) {
      return { rows: [{ id: 7, project_id: 2, name: 'release smoke' }] };
    }

    if (/INSERT INTO test_execution/.test(sql)) {
      return { rows: [{ id: 99 }] };
    }

    throw new Error(`Unexpected query: ${sql}`);
  });
  const handler = getHandler(router, 'post', '/cases/:id/run');
  const res = createResponse();

  await handler(
    {
      params: { id: '3' },
      body: { device_id: 11 },
    },
    res
  );

  const insert = queries.find((query) => /INSERT INTO test_execution/.test(query.sql));
  assert.ok(insert);
  assert.match(insert.sql, /INSERT INTO test_execution\s+\(suite_id, device_id, status, start_time, created_at\)/);
  assert.match(insert.sql, /RETURNING id/);
  assert.deepEqual(insert.params, [7, 11]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, { execution_id: 99 });
});

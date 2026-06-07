const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const routePath = require.resolve('../src/api/routes/cases');

function loadCasesRoute(dbQuery) {
  const routes = {};
  const router = {
    get(path, handler) {
      routes[`GET ${path}`] = handler;
    },
    post(path, handler) {
      routes[`POST ${path}`] = handler;
    },
    put(path, handler) {
      routes[`PUT ${path}`] = handler;
    },
    delete(path, handler) {
      routes[`DELETE ${path}`] = handler;
    },
  };

  const originalLoad = Module._load;
  delete require.cache[routePath];

  Module._load = function mockRouteDependencies(request, parent, isMain) {
    if (request === 'express') {
      return { Router: () => router };
    }
    if (request === '../db') {
      return { query: dbQuery };
    }
    if (request === 'uuid') {
      return { v4: () => '00000000-0000-4000-8000-000000000000' };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(routePath);
  } finally {
    Module._load = originalLoad;
  }

  return routes;
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

test('POST /cases lets PostgreSQL generate the SERIAL case id', async () => {
  const queries = [];
  const routes = loadCasesRoute(async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [{ id: 101, suite_id: 7, name: 'Checkout flow' }] };
  });

  const res = createResponse();
  await routes['POST /cases'](
    {
      body: {
        suite_id: 7,
        name: 'Checkout flow',
        type: 'h5',
        content: { steps: [{ action: 'navigate', url: 'https://example.com' }] },
      },
      user: { id: 'tester-1' },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 101);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case\s*\(\s*id\b/);
  assert.deepEqual(queries[0].params, [
    7,
    'Checkout flow',
    undefined,
    'h5',
    JSON.stringify({ steps: [{ action: 'navigate', url: 'https://example.com' }] }),
    'tester-1',
  ]);
});

test('POST /cases/:id/run lets PostgreSQL generate the SERIAL execution id', async () => {
  const queries = [];
  const routes = loadCasesRoute(async (sql, params) => {
    queries.push({ sql, params });

    if (/FROM test_case WHERE id = \$1/.test(sql)) {
      return { rows: [{ id: 42, suite_id: 7, name: 'Checkout flow' }] };
    }
    if (/FROM test_suite WHERE id = \$1/.test(sql)) {
      return { rows: [{ id: 7, name: 'Smoke suite' }] };
    }
    if (/INSERT INTO test_execution/.test(sql)) {
      return { rows: [{ id: 202 }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  const res = createResponse();
  await routes['POST /cases/:id/run'](
    {
      params: { id: 42 },
      body: { device_id: 3 },
    },
    res
  );

  const executionInsert = queries.find(({ sql }) => /INSERT INTO test_execution/.test(sql));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.execution_id, 202);
  assert.doesNotMatch(executionInsert.sql, /INSERT INTO test_execution\s*\(\s*id\b/);
  assert.deepEqual(executionInsert.params, [7, 3]);
});

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const casesRoutePath = path.join(__dirname, '..', 'src', 'api', 'routes', 'cases.js');

function loadCasesRouter(db) {
  const routes = [];
  const router = {
    get: (routePath, handler) => routes.push({ method: 'GET', path: routePath, handler }),
    post: (routePath, handler) => routes.push({ method: 'POST', path: routePath, handler }),
    put: (routePath, handler) => routes.push({ method: 'PUT', path: routePath, handler }),
    delete: (routePath, handler) => routes.push({ method: 'DELETE', path: routePath, handler }),
  };

  const originalLoad = Module._load;
  delete require.cache[require.resolve(casesRoutePath)];
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === 'express') {
      return { Router: () => router };
    }

    if (request === '../db' && parent?.filename === casesRoutePath) {
      return db;
    }

    if (request === 'uuid') {
      return { v4: () => '00000000-0000-4000-8000-000000000000' };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(casesRoutePath);
  } finally {
    Module._load = originalLoad;
  }

  return routes;
}

function findRoute(routes, method, routePath) {
  return routes.find((route) => route.method === method && route.path === routePath).handler;
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('case creation lets PostgreSQL generate the SERIAL id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ id: 42, name: 'checkout flow' }] };
    },
  };
  const routes = loadCasesRouter(db);
  const createCase = findRoute(routes, 'POST', '/cases');
  const res = createResponse();
  const content = { steps: [{ action: 'tap', target: 'login' }] };

  await createCase({
    body: {
      suite_id: 7,
      name: 'checkout flow',
      description: 'critical path',
      type: 'web',
      content,
    },
    user: { id: 'alice' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 42);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case\s*\([^)]*\bid\b/i);
  assert.deepEqual(queries[0].params, [
    7,
    'checkout flow',
    'critical path',
    'web',
    JSON.stringify(content),
    'alice',
  ]);
});

test('case execution lets PostgreSQL generate and return the SERIAL execution id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (/FROM test_case/i.test(sql)) {
        return { rows: [{ id: 11, suite_id: 3 }] };
      }

      if (/FROM test_suite/i.test(sql)) {
        return { rows: [{ id: 3 }] };
      }

      return { rows: [{ id: 99 }] };
    },
  };
  const routes = loadCasesRouter(db);
  const runCase = findRoute(routes, 'POST', '/cases/:id/run');
  const res = createResponse();

  await runCase({ params: { id: 11 }, body: { device_id: 5 } }, res);

  const insertExecution = queries.find((query) => /INSERT INTO test_execution/i.test(query.sql));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.execution_id, 99);
  assert.doesNotMatch(insertExecution.sql, /INSERT INTO test_execution\s*\([^)]*\bid\b/i);
  assert.match(insertExecution.sql, /RETURNING\s+id/i);
  assert.deepEqual(insertExecution.params, [3, 5]);
});

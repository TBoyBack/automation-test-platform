const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const CASES_ROUTE = './cases';
const DB_MODULE = '../db';

function clearRouteCache() {
  for (const moduleId of [CASES_ROUTE, DB_MODULE]) {
    try {
      delete require.cache[require.resolve(moduleId)];
    } catch {
      // Module may not exist yet in the failing state.
    }
  }
}

function withModuleStubs(stubs, callback) {
  const originalLoad = Module._load;

  Module._load = function loadWithStubs(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    clearRouteCache();
    return callback();
  } finally {
    Module._load = originalLoad;
    clearRouteCache();
  }
}

function createExpressStub() {
  const router = {
    routes: [],
    get(path, handler) {
      this.routes.push({ method: 'GET', path, handler });
    },
    post(path, handler) {
      this.routes.push({ method: 'POST', path, handler });
    },
    put(path, handler) {
      this.routes.push({ method: 'PUT', path, handler });
    },
    delete(path, handler) {
      this.routes.push({ method: 'DELETE', path, handler });
    },
  };

  return {
    Router() {
      return router;
    },
  };
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

function loadRouterWithStubs(stubs) {
  return withModuleStubs(
    {
      express: createExpressStub(),
      uuid: { v4: () => 'generated-uuid' },
      ...stubs,
    },
    () => require(CASES_ROUTE)
  );
}

function findRoute(router, method, path) {
  const route = router.routes.find((candidate) => {
    return candidate.method === method && candidate.path === path;
  });

  assert.ok(route, `${method} ${path} route should be registered`);
  return route;
}

test('cases route loads its production database module', () => {
  assert.doesNotThrow(() => {
    loadRouterWithStubs({
      pg: {
        Pool: class Pool {
          query() {
            throw new Error('not used by this load test');
          }
        },
      },
    });
  });
});

test('POST /cases lets PostgreSQL generate the SERIAL case id', async () => {
  let insert;
  const db = {
    async query(sql, params) {
      insert = { sql, params };
      return {
        rows: [
          {
            id: 42,
            suite_id: 7,
            name: 'Checkout smoke test',
          },
        ],
      };
    },
  };

  const router = loadRouterWithStubs({ [DB_MODULE]: db });
  const route = findRoute(router, 'POST', '/cases');
  const response = createResponse();
  const content = { steps: [{ action: 'tap', target: 'checkout' }] };

  await route.handler(
    {
      body: {
        suite_id: 7,
        name: 'Checkout smoke test',
        description: 'critical path',
        type: 'h5',
        content,
      },
      user: { id: 'qa-user' },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.doesNotMatch(insert.sql, /INSERT\s+INTO\s+test_case\s*\(\s*id\b/i);
  assert.deepEqual(insert.params, [
    7,
    'Checkout smoke test',
    'critical path',
    'h5',
    JSON.stringify(content),
    'qa-user',
  ]);
});

test('POST /cases/:id/run lets PostgreSQL generate the SERIAL execution id', async () => {
  let executionInsert;
  const db = {
    async query(sql, params) {
      if (/FROM\s+test_case/i.test(sql)) {
        return { rows: [{ id: 42, suite_id: 7 }] };
      }

      if (/FROM\s+test_suite/i.test(sql)) {
        return { rows: [{ id: 7, name: 'Checkout suite' }] };
      }

      if (/INSERT\s+INTO\s+test_execution/i.test(sql)) {
        executionInsert = { sql, params };
        return { rows: [{ id: 99 }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const router = loadRouterWithStubs({ [DB_MODULE]: db });
  const route = findRoute(router, 'POST', '/cases/:id/run');
  const response = createResponse();

  await route.handler(
    {
      params: { id: '42' },
      body: { device_id: 3 },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.execution_id, 99);
  assert.match(executionInsert.sql, /\bRETURNING\s+id\b/i);
  assert.doesNotMatch(executionInsert.sql, /INSERT\s+INTO\s+test_execution\s*\(\s*id\b/i);
  assert.deepEqual(executionInsert.params, [7, 3]);
});

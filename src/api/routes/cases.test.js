const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const routePath = path.resolve(__dirname, 'cases.js');
const dbPath = path.resolve(__dirname, '../db.js');

function createRouter() {
  return {
    stack: [],
    get(pathname, handle) {
      this.stack.push({
        route: { path: pathname, methods: { get: true }, stack: [{ handle }] },
      });
    },
    post(pathname, handle) {
      this.stack.push({
        route: { path: pathname, methods: { post: true }, stack: [{ handle }] },
      });
    },
    put(pathname, handle) {
      this.stack.push({
        route: { path: pathname, methods: { put: true }, stack: [{ handle }] },
      });
    },
    delete(pathname, handle) {
      this.stack.push({
        route: { path: pathname, methods: { delete: true }, stack: [{ handle }] },
      });
    },
  };
}

function loadRouteWithModules(dbModule) {
  delete require.cache[routePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'express') {
      return { Router: createRouter };
    }

    if (request === 'uuid') {
      return { v4: () => 'generated-uuid' };
    }

    if (request === 'pg') {
      return {
        Pool: class FakePool {
          query() {
            throw new Error('Unexpected database query in route load test');
          }
        },
      };
    }

    if (request === '../db' && parent?.filename === routePath && dbModule) {
      return dbModule;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(routePath);
  } finally {
    Module._load = originalLoad;
  }
}

function loadCasesRouter(query) {
  return loadRouteWithModules({ query });
}

function findLayer(router, method, routePathname) {
  return router.stack.find(
    (layer) => layer.route?.path === routePathname && layer.route.methods[method],
  );
}

function invokeLayer(layer, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve(this);
      },
    };

    const handler = layer.route.stack[0].handle;
    Promise.resolve(handler(req, res, reject)).catch(reject);
  });
}

test('cases router loads with its database adapter', () => {
  delete require.cache[routePath];
  delete require.cache[dbPath];

  assert.doesNotThrow(() => loadRouteWithModules());
});

test('creating a case lets PostgreSQL generate the SERIAL id', async () => {
  const calls = [];
  const router = loadCasesRouter(async (sql, params) => {
    calls.push({ sql, params });
    return {
      rows: [
        {
          id: 42,
          suite_id: 7,
          name: 'Login smoke',
          type: 'h5',
          content: { steps: [] },
        },
      ],
    };
  });

  const layer = findLayer(router, 'post', '/cases');
  const res = await invokeLayer(layer, {
    body: {
      suite_id: 7,
      name: 'Login smoke',
      description: 'basic login coverage',
      type: 'h5',
      content: { steps: [] },
    },
    user: { id: 'tester' },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 42);
  assert.match(calls[0].sql, /INSERT INTO test_case \(\s*suite_id,/);
  assert.doesNotMatch(calls[0].sql, /INSERT INTO test_case \(\s*id,/);
  assert.deepEqual(calls[0].params, [
    7,
    'Login smoke',
    'basic login coverage',
    'h5',
    JSON.stringify({ steps: [] }),
    'tester',
  ]);
});

test('running a case lets PostgreSQL generate the execution SERIAL id', async () => {
  const calls = [];
  const router = loadCasesRouter(async (sql, params) => {
    calls.push({ sql, params });

    if (/FROM test_case/.test(sql)) {
      return { rows: [{ id: 42, suite_id: 7, name: 'Login smoke' }] };
    }

    if (/FROM test_suite/.test(sql)) {
      return { rows: [{ id: 7, name: 'Smoke suite' }] };
    }

    if (/INSERT INTO test_execution/.test(sql)) {
      return { rows: [{ id: 99 }] };
    }

    return { rows: [] };
  });

  const layer = findLayer(router, 'post', '/cases/:id/run');
  const res = await invokeLayer(layer, {
    params: { id: '42' },
    body: { device_id: 3, params: { browser: 'chromium' } },
  });

  const executionInsert = calls.find((call) => /INSERT INTO test_execution/.test(call.sql));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.execution_id, 99);
  assert.match(executionInsert.sql, /INSERT INTO test_execution \(\s*suite_id,/);
  assert.doesNotMatch(executionInsert.sql, /INSERT INTO test_execution \(\s*id,/);
  assert.deepEqual(executionInsert.params, [7, 3]);
});

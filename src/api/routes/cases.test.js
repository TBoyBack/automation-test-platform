const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const routePath = path.join(__dirname, 'cases.js');
const dbPath = path.join(__dirname, '..', 'db.js');

function createRouterStub() {
  const routes = {
    get: new Map(),
    post: new Map(),
    put: new Map(),
    delete: new Map(),
  };

  const router = {};
  for (const method of Object.keys(routes)) {
    router[method] = (route, handler) => {
      routes[method].set(route, handler);
      return router;
    };
  }

  return { router, routes };
}

function loadCasesRoute({ db, useRealDb = false } = {}) {
  const originalLoad = Module._load;
  const { router, routes } = createRouterStub();

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'express') {
      return { Router: () => router };
    }

    if (request === 'uuid') {
      return { v4: () => '11111111-1111-4111-8111-111111111111' };
    }

    if (request === 'pg') {
      return {
        Pool: class Pool {
          query() {
            throw new Error('Unexpected database query in route load smoke test');
          }
        },
      };
    }

    if (request === 'dotenv/config') {
      return {};
    }

    if (request === '../db' && !useRealDb) {
      return db;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[routePath];
    delete require.cache[dbPath];
    require(routePath);
    return routes;
  } finally {
    Module._load = originalLoad;
    delete require.cache[routePath];
    delete require.cache[dbPath];
  }
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

test('case routes load with the real database module present', () => {
  const routes = loadCasesRoute({ useRealDb: true });

  assert.equal(typeof routes.get.get('/cases'), 'function');
  assert.equal(typeof routes.post.get('/cases'), 'function');
});

test('creating a case lets PostgreSQL generate the serial id', async () => {
  const calls = [];
  const content = { steps: [{ action: 'tap', target: 'login' }] };
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ id: 42, suite_id: 7, name: 'login', type: 'h5', content }] };
    },
  };

  const routes = loadCasesRoute({ db });
  const response = createResponse();

  await routes.post.get('/cases')({
    body: { suite_id: 7, name: 'login', description: 'smoke', type: 'h5', content },
    user: { id: 'alice' },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.id, 42);
  assert.doesNotMatch(calls[0].sql, /INSERT INTO test_case\s*\(\s*id\b/i);
  assert.deepEqual(calls[0].params, [7, 'login', 'smoke', 'h5', content, 'alice']);
});

test('updating a case stores JSONB content as an object', async () => {
  const calls = [];
  const content = { steps: [{ action: 'input', value: 'otp' }] };
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ id: 42, content }] };
    },
  };

  const routes = loadCasesRoute({ db });
  const response = createResponse();

  await routes.put.get('/cases/:id')({
    params: { id: 42 },
    body: { content },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].params[3], content);
});

test('running a case returns the database-generated execution id', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });

      if (/FROM test_case/i.test(sql)) {
        return { rows: [{ id: 42, suite_id: 7, content: { steps: [] } }] };
      }

      if (/FROM test_suite/i.test(sql)) {
        return { rows: [{ id: 7, name: 'smoke' }] };
      }

      return { rows: [{ id: 99 }] };
    },
  };

  const routes = loadCasesRoute({ db });
  const response = createResponse();

  await routes.post.get('/cases/:id/run')({
    params: { id: 42 },
    body: { device_id: 3 },
  }, response);

  const insertCall = calls.find((call) => /INSERT INTO test_execution/i.test(call.sql));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.execution_id, 99);
  assert.doesNotMatch(insertCall.sql, /INSERT INTO test_execution\s*\(\s*id\b/i);
  assert.deepEqual(insertCall.params, [7, 3]);
});

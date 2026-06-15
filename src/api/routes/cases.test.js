const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

function loadCasesRouter(db) {
  const originalLoad = Module._load;
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

  Module._load = function mockLoad(request, parent, isMain) {
    if (request === 'express') {
      return { Router: () => router };
    }

    if (request === '../db') {
      return db;
    }

    if (request === 'uuid') {
      return { v4: () => '00000000-0000-4000-8000-000000000000' };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  const routePath = require.resolve('./cases');
  delete require.cache[routePath];

  try {
    require('./cases');
  } finally {
    Module._load = originalLoad;
  }

  return router;
}

function findRoute(router, method, path) {
  const route = router.routes.find((candidate) => {
    return candidate.method === method && candidate.path === path;
  });

  assert.ok(route, `${method} ${path} route should be registered`);
  return route.handler;
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

test('POST /cases lets PostgreSQL generate the SERIAL id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [{
          id: 123,
          suite_id: 7,
          name: 'Login works',
          type: 'web',
        }],
      };
    },
  };
  const router = loadCasesRouter(db);
  const handler = findRoute(router, 'POST', '/cases');
  const res = createResponse();

  await handler({
    body: {
      suite_id: 7,
      name: 'Login works',
      description: 'Smoke test',
      type: 'web',
      content: { steps: [] },
    },
    user: { id: 'alice' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 123);
  assert.match(queries[0].sql, /INSERT INTO test_case\s+\(suite_id, name, description, type, content, created_by, created_at, updated_at\)/);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case\s+\(id,/);
  assert.deepEqual(queries[0].params, [
    7,
    'Login works',
    'Smoke test',
    'web',
    JSON.stringify({ steps: [] }),
    'alice',
  ]);
});

test('POST /cases/:id/run returns the database-generated execution id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (/FROM test_case/.test(sql)) {
        return { rows: [{ id: 10, suite_id: 7 }] };
      }

      if (/FROM test_suite/.test(sql)) {
        return { rows: [{ id: 7 }] };
      }

      return { rows: [{ id: 456 }] };
    },
  };
  const router = loadCasesRouter(db);
  const handler = findRoute(router, 'POST', '/cases/:id/run');
  const res = createResponse();

  await handler({
    params: { id: '10' },
    body: { device_id: 3 },
  }, res);

  const insert = queries.find((query) => /INSERT INTO test_execution/.test(query.sql));
  assert.ok(insert, 'execution insert should be issued');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.execution_id, 456);
  assert.match(insert.sql, /INSERT INTO test_execution\s+\(suite_id, device_id, status, start_time, created_at\)/);
  assert.doesNotMatch(insert.sql, /INSERT INTO test_execution\s+\(id,/);
  assert.match(insert.sql, /RETURNING id/);
  assert.deepEqual(insert.params, [7, 3]);
});

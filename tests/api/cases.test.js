const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const casesRoutePath = path.join(__dirname, '../../src/api/routes/cases.js');

function loadCasesRoute(db) {
  const routes = {
    get: new Map(),
    post: new Map(),
    put: new Map(),
    delete: new Map(),
  };
  const fakeRouter = {
    get(route, handler) {
      routes.get.set(route, handler);
      return this;
    },
    post(route, handler) {
      routes.post.set(route, handler);
      return this;
    },
    put(route, handler) {
      routes.put.set(route, handler);
      return this;
    },
    delete(route, handler) {
      routes.delete.set(route, handler);
      return this;
    },
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'express') {
      return { Router: () => fakeRouter };
    }
    if (request === '../db') {
      return db;
    }
    if (request === 'uuid') {
      return { v4: () => '00000000-0000-4000-8000-000000000000' };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve(casesRoutePath)];
    require(casesRoutePath);
    return routes;
  } finally {
    Module._load = originalLoad;
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
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('POST /cases lets PostgreSQL generate the serial case id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: [{
          id: 42,
          suite_id: 7,
          name: 'Login flow',
          type: 'h5',
          content: { steps: [] },
        }],
      };
    },
  };
  const routes = loadCasesRoute(db);
  const handler = routes.post.get('/cases');
  const res = createResponse();

  await handler({
    body: {
      suite_id: 7,
      name: 'Login flow',
      type: 'h5',
      content: { steps: [] },
    },
    user: { id: 'tester' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.id, 42);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case\s*\(\s*id\b/i);
  assert.match(queries[0].sql, /RETURNING \*/i);
  assert.deepEqual(queries[0].params, [
    7,
    'Login flow',
    undefined,
    'h5',
    JSON.stringify({ steps: [] }),
    'tester',
  ]);
});

test('POST /cases/:id/run lets PostgreSQL generate the serial execution id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM test_case/i.test(sql)) {
        return { rows: [{ id: 12, suite_id: 7, name: 'Login flow' }] };
      }
      if (/FROM test_suite/i.test(sql)) {
        return { rows: [{ id: 7, project_id: 3, name: 'Smoke' }] };
      }
      return { rows: [{ id: 99 }] };
    },
  };
  const routes = loadCasesRoute(db);
  const handler = routes.post.get('/cases/:id/run');
  const res = createResponse();

  await handler({
    params: { id: '12' },
    body: { device_id: 5 },
  }, res);

  const executionInsert = queries.find(({ sql }) => /INSERT INTO test_execution/i.test(sql));
  assert.ok(executionInsert, 'expected a test_execution insert');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, { execution_id: 99 });
  assert.doesNotMatch(executionInsert.sql, /INSERT INTO test_execution\s*\(\s*id\b/i);
  assert.match(executionInsert.sql, /RETURNING id/i);
  assert.deepEqual(executionInsert.params, [7, 5]);
});

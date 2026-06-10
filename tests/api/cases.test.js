const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

function loadCasesRouter(dbQuery) {
  const handlers = [];
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'express') {
      return {
        Router: () => ({
          get: (path, handler) => handlers.push({ method: 'GET', path, handler }),
          post: (path, handler) => handlers.push({ method: 'POST', path, handler }),
          put: (path, handler) => handlers.push({ method: 'PUT', path, handler }),
          delete: (path, handler) => handlers.push({ method: 'DELETE', path, handler }),
        }),
      };
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
    delete require.cache[require.resolve('../../src/api/routes/cases')];
    require('../../src/api/routes/cases');
  } finally {
    Module._load = originalLoad;
  }

  return {
    handler(method, path) {
      const route = handlers.find((entry) => entry.method === method && entry.path === path);
      assert.ok(route, `Missing ${method} ${path} handler`);
      return route.handler;
    },
  };
}

function createResponse() {
  const response = {
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
  return response;
}

test('POST /cases lets PostgreSQL generate the integer case id', async () => {
  const calls = [];
  const router = loadCasesRouter(async (query, params) => {
    calls.push({ query, params });
    return {
      rows: [{
        id: 42,
        suite_id: 7,
        name: 'checkout',
        type: 'h5',
        content: { steps: [] },
      }],
    };
  });

  const response = createResponse();
  await router.handler('POST', '/cases')({
    body: {
      suite_id: 7,
      name: 'checkout',
      type: 'h5',
      content: { steps: [] },
    },
    user: { id: 'alice' },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.id, 42);
  assert.match(calls[0].query, /INSERT INTO test_case/i);
  assert.doesNotMatch(calls[0].query, /\(\s*id\s*,/i);
  assert.deepEqual(calls[0].params, [
    7,
    'checkout',
    undefined,
    'h5',
    JSON.stringify({ steps: [] }),
    'alice',
  ]);
});

test('POST /cases/:id/run lets PostgreSQL generate the integer execution id', async () => {
  const calls = [];
  const router = loadCasesRouter(async (query, params) => {
    calls.push({ query, params });

    if (/FROM test_case/i.test(query)) {
      return { rows: [{ id: 3, suite_id: 7, name: 'checkout' }] };
    }

    if (/FROM test_suite/i.test(query)) {
      return { rows: [{ id: 7, name: 'smoke' }] };
    }

    if (/INSERT INTO test_execution/i.test(query)) {
      return { rows: [{ id: 99 }] };
    }

    throw new Error(`Unexpected query: ${query}`);
  });

  const response = createResponse();
  await router.handler('POST', '/cases/:id/run')({
    params: { id: '3' },
    body: { device_id: 11 },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.execution_id, 99);

  const insertExecution = calls.find((call) => /INSERT INTO test_execution/i.test(call.query));
  assert.ok(insertExecution);
  assert.doesNotMatch(insertExecution.query, /\(\s*id\s*,/i);
  assert.match(insertExecution.query, /RETURNING id/i);
  assert.deepEqual(insertExecution.params, [7, 11]);
});

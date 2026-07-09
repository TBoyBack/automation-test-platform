const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const routePath = require.resolve('./cases');

function createExpressStub() {
  const handlers = {
    get: new Map(),
    post: new Map(),
    put: new Map(),
    delete: new Map(),
  };

  return {
    express: {
      Router() {
        return {
          get(path, handler) {
            handlers.get.set(path, handler);
          },
          post(path, handler) {
            handlers.post.set(path, handler);
          },
          put(path, handler) {
            handlers.put.set(path, handler);
          },
          delete(path, handler) {
            handlers.delete.set(path, handler);
          },
        };
      },
    },
    handlers,
  };
}

function loadCasesRoute({ db, stubDb = true } = {}) {
  const { express, handlers } = createExpressStub();
  const originalLoad = Module._load;

  delete require.cache[routePath];

  Module._load = function load(request, parent, isMain) {
    if (request === 'express') {
      return express;
    }

    if (request === 'uuid') {
      return { v4: () => 'generated-uuid' };
    }

    if (request === 'pg') {
      return { Pool: class Pool {} };
    }

    if (stubDb && request === '../db' && parent?.filename === routePath) {
      return db;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(routePath);
    return handlers;
  } finally {
    Module._load = originalLoad;
    delete require.cache[routePath];
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

test('cases route loads with the repository database adapter', () => {
  assert.doesNotThrow(() => loadCasesRoute({ stubDb: false }));
});

test('creating a case lets PostgreSQL generate the SERIAL id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ id: 123, name: 'Login flow' }] };
    },
  };
  const handlers = loadCasesRoute({ db });
  const response = createResponse();

  await handlers.post.get('/cases')(
    {
      body: {
        suite_id: 7,
        name: 'Login flow',
        description: 'happy path',
        type: 'webview',
        content: [{ action: 'tap' }],
      },
      user: { id: 'alice' },
    },
    response
  );

  const insert = queries.find((query) => query.sql.includes('INSERT INTO test_case'));

  assert.equal(response.statusCode, 201);
  assert.ok(insert, 'expected test_case insert to run');
  assert.doesNotMatch(insert.sql, /INSERT INTO test_case\s*\(\s*id\b/i);
  assert.deepEqual(insert.params, [
    7,
    'Login flow',
    'happy path',
    'webview',
    JSON.stringify([{ action: 'tap' }]),
    'alice',
  ]);
  assert.equal(response.body.data.id, 123);
});

test('running a case lets PostgreSQL generate and return the execution id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (sql.includes('FROM test_case')) {
        return { rows: [{ id: 5, suite_id: 7, name: 'Login flow' }] };
      }

      if (sql.includes('FROM test_suite')) {
        return { rows: [{ id: 7, name: 'Smoke' }] };
      }

      if (sql.includes('INSERT INTO test_execution')) {
        return { rows: [{ id: 456 }] };
      }

      return { rows: [] };
    },
  };
  const handlers = loadCasesRoute({ db });
  const response = createResponse();

  await handlers.post.get('/cases/:id/run')(
    { params: { id: 5 }, body: { device_id: 9, params: { retry: 1 } } },
    response
  );

  const insert = queries.find((query) => query.sql.includes('INSERT INTO test_execution'));

  assert.equal(response.statusCode, 200);
  assert.ok(insert, 'expected test_execution insert to run');
  assert.doesNotMatch(insert.sql, /INSERT INTO test_execution\s*\(\s*id\b/i);
  assert.match(insert.sql, /RETURNING\s+id/i);
  assert.deepEqual(insert.params, [7, 9]);
  assert.deepEqual(response.body.data, { execution_id: 456 });
});

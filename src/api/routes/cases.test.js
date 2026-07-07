const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const routePath = path.join(__dirname, 'cases.js');

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

function loadCasesRoute(db) {
  const routes = [];
  const router = {};

  for (const method of ['get', 'post', 'put', 'delete']) {
    router[method] = (route, handler) => {
      routes.push({ method: method.toUpperCase(), route, handler });
    };
  }

  const originalLoad = Module._load;
  delete require.cache[require.resolve(routePath)];

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'express') {
      return { Router: () => router };
    }

    if (request === '../db' && parent?.filename === routePath) {
      return db;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(routePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve(routePath)];
  }

  return routes;
}

test('cases route has a database adapter module', () => {
  assert.doesNotThrow(() => require.resolve('../db', { paths: [__dirname] }));
});

test('creating a case lets PostgreSQL generate the SERIAL id', async () => {
  let insert;
  const db = {
    async query(sql, params) {
      insert = { sql, params };
      return { rows: [{ id: 42, name: 'checkout flow' }] };
    },
  };
  const routes = loadCasesRoute(db);
  const route = routes.find((item) => item.method === 'POST' && item.route === '/cases');
  const res = createResponse();

  await route.handler(
    {
      body: {
        suite_id: 7,
        name: 'checkout flow',
        description: 'critical checkout smoke',
        type: 'h5',
        content: { steps: ['open cart'] },
      },
      user: { id: 'qa-user' },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.doesNotMatch(insert.sql, /INSERT\s+INTO\s+test_case\s*\(\s*id\s*,/i);
  assert.match(insert.sql, /RETURNING\s+\*/i);
  assert.deepEqual(insert.params, [
    7,
    'checkout flow',
    'critical checkout smoke',
    'h5',
    JSON.stringify({ steps: ['open cart'] }),
    'qa-user',
  ]);
});

test('running a case returns the database-generated execution id', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (/FROM\s+test_case/i.test(sql)) {
        return { rows: [{ id: 11, suite_id: 7, content: { steps: [] } }] };
      }

      if (/FROM\s+test_suite/i.test(sql)) {
        return { rows: [{ id: 7, project_id: 3 }] };
      }

      return { rows: [{ id: 501 }] };
    },
  };
  const routes = loadCasesRoute(db);
  const route = routes.find((item) => item.method === 'POST' && item.route === '/cases/:id/run');
  const res = createResponse();

  await route.handler({ params: { id: 11 }, body: { device_id: 3, params: {} } }, res);

  const insert = queries.find((query) => /INSERT\s+INTO\s+test_execution/i.test(query.sql));
  assert.ok(insert, 'expected an execution insert query');
  assert.doesNotMatch(insert.sql, /INSERT\s+INTO\s+test_execution\s*\(\s*id\s*,/i);
  assert.match(insert.sql, /RETURNING\s+id/i);
  assert.deepEqual(insert.params, [7, 3]);
  assert.deepEqual(res.body, {
    success: true,
    message: '执行任务已创建',
    data: { execution_id: 501 },
  });
});

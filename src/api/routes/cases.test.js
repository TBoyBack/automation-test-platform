const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const routePath = path.join(__dirname, 'cases.js');

function loadRouterWithDb(db) {
  delete require.cache[require.resolve(routePath)];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../db' && parent?.filename === routePath) {
      return db;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(routePath);
  } finally {
    Module._load = originalLoad;
  }
}

function findRoute(router, method, routePathname) {
  const layer = router.stack.find((item) => {
    return item.route?.path === routePathname && item.route.methods[method];
  });

  assert.ok(layer, `Expected ${method.toUpperCase()} ${routePathname} route to exist`);
  return layer.route.stack[0].handle;
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

test('provides a shared database module required by case routes', () => {
  const db = require('../db');

  assert.equal(typeof db.query, 'function');
});

test('creating a case lets PostgreSQL generate the SERIAL id', async () => {
  const queries = [];
  const db = {
    async query(text, params) {
      queries.push({ text, params });
      return {
        rows: [
          {
            id: 42,
            suite_id: 7,
            name: '登录用例',
          },
        ],
      };
    },
  };
  const router = loadRouterWithDb(db);
  const handler = findRoute(router, 'post', '/cases');
  const req = {
    body: {
      suite_id: 7,
      name: '登录用例',
      description: '验证登录',
      type: 'webview',
      content: { steps: [{ action: 'tap' }] },
    },
    user: { id: 'qa-user' },
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /INSERT INTO test_case \(\s*suite_id,\s*name,\s*description,\s*type,\s*content,\s*created_by,\s*created_at,\s*updated_at\s*\)/);
  assert.doesNotMatch(queries[0].text, /INSERT INTO test_case \(\s*id,/);
  assert.match(queries[0].text, /RETURNING \*/);
  assert.deepEqual(queries[0].params, [
    7,
    '登录用例',
    '验证登录',
    'webview',
    req.body.content,
    'qa-user',
  ]);
});

test('running a case lets PostgreSQL generate the execution id returned to callers', async () => {
  const queries = [];
  const db = {
    async query(text, params) {
      queries.push({ text, params });

      if (text.includes('FROM test_case')) {
        return { rows: [{ id: 42, suite_id: 7, name: '登录用例' }] };
      }

      if (text.includes('FROM test_suite')) {
        return { rows: [{ id: 7, name: '冒烟套件' }] };
      }

      if (text.includes('INSERT INTO test_execution')) {
        return { rows: [{ id: 314 }] };
      }

      throw new Error(`Unexpected query: ${text}`);
    },
  };
  const router = loadRouterWithDb(db);
  const handler = findRoute(router, 'post', '/cases/:id/run');
  const req = {
    params: { id: '42' },
    body: { device_id: 9, params: { retries: 1 } },
  };
  const res = createResponse();

  await handler(req, res);

  const insert = queries.find((query) => query.text.includes('INSERT INTO test_execution'));

  assert.equal(res.statusCode, 200);
  assert.ok(insert, 'Expected an execution insert query');
  assert.match(insert.text, /INSERT INTO test_execution \(\s*suite_id,\s*device_id,\s*status,\s*start_time,\s*created_at\s*\)/);
  assert.doesNotMatch(insert.text, /INSERT INTO test_execution \(\s*id,/);
  assert.match(insert.text, /RETURNING id/);
  assert.deepEqual(insert.params, [7, 9]);
  assert.equal(res.body.data.execution_id, 314);
});

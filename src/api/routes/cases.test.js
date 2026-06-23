const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

function clearCasesRoute() {
  delete require.cache[require.resolve('./cases')];
}

function loadCasesRouteWithDb(mockDb) {
  clearCasesRoute();

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../db' && parent?.filename.endsWith('/src/api/routes/cases.js')) {
      return mockDb;
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    return require('./cases');
  } finally {
    Module._load = originalLoad;
  }
}

function findRouteHandler(router, method, path) {
  const layer = router.stack.find((item) => item.route?.path === path && item.route.methods[method]);
  assert.ok(layer, `expected ${method.toUpperCase()} ${path} route to be registered`);
  return layer.route.stack.find((item) => item.method === method).handle;
}

async function invoke(handler, { params = {}, body = {}, user } = {}) {
  const res = {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await handler({ params, body, user }, res);
  return res;
}

test('cases route module loads with its database dependency', () => {
  assert.doesNotThrow(() => {
    clearCasesRoute();
    require('./cases');
  });
});

test('creating a case lets PostgreSQL generate the SERIAL id', async () => {
  const queries = [];
  const router = loadCasesRouteWithDb({
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ id: 101, name: 'checkout' }] };
    },
  });

  const handler = findRouteHandler(router, 'post', '/cases');
  const res = await invoke(handler, {
    body: {
      suite_id: 12,
      name: 'checkout',
      type: 'h5',
      content: [{ action: 'tap', target: 'buy' }],
    },
    user: { id: 'qa-user' },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.id, 101);
  assert.match(queries[0].sql, /INSERT INTO test_case \(suite_id, name, description, type, content, created_by, created_at, updated_at\)/);
  assert.doesNotMatch(queries[0].sql, /INSERT INTO test_case \(id,/);
  assert.deepEqual(queries[0].params, [
    12,
    'checkout',
    undefined,
    'h5',
    JSON.stringify([{ action: 'tap', target: 'buy' }]),
    'qa-user',
  ]);
});

test('running a case returns the database-generated execution id', async () => {
  const queries = [];
  const router = loadCasesRouteWithDb({
    async query(sql, params) {
      queries.push({ sql, params });

      if (/FROM test_case/.test(sql)) {
        return { rows: [{ id: 55, suite_id: 12, name: 'checkout' }] };
      }

      if (/FROM test_suite/.test(sql)) {
        return { rows: [{ id: 12, name: 'smoke' }] };
      }

      return { rows: [{ id: 202 }] };
    },
  });

  const handler = findRouteHandler(router, 'post', '/cases/:id/run');
  const res = await invoke(handler, {
    params: { id: '55' },
    body: { device_id: 7, params: { locale: 'zh-CN' } },
  });

  const insert = queries.find((query) => /INSERT INTO test_execution/.test(query.sql));
  assert.ok(insert, 'expected a test_execution insert');
  assert.match(insert.sql, /INSERT INTO test_execution \(suite_id, device_id, status, start_time, created_at\)/);
  assert.doesNotMatch(insert.sql, /INSERT INTO test_execution \(id,/);
  assert.match(insert.sql, /RETURNING id/);
  assert.deepEqual(insert.params, [12, 7]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.execution_id, 202);
});

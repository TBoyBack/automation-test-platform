const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

function createExpressStub() {
  return {
    Router() {
      const routes = [];
      const router = { routes };

      for (const method of ['get', 'post', 'put', 'delete']) {
        router[method] = (path, handler) => {
          routes.push({ method, path, handler });
        };
      }

      return router;
    },
  };
}

function withMockedModules(mocks, callback) {
  const originalLoad = Module._load;

  Module._load = function load(request, parent, isMain) {
    for (const mock of mocks) {
      if (mock.matches(request, parent)) {
        return mock.value;
      }
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    return callback();
  } finally {
    Module._load = originalLoad;
  }
}

function clearCasesRouteCache() {
  delete require.cache[require.resolve('./cases')];
  try {
    delete require.cache[require.resolve('../db')];
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
  }
}

function loadCasesRoute(db) {
  clearCasesRouteCache();

  return withMockedModules(
    [
      {
        matches: request => request === 'express',
        value: createExpressStub(),
      },
      {
        matches: request => request === 'uuid',
        value: { v4: () => '00000000-0000-4000-8000-000000000000' },
      },
      {
        matches: (request, parent) =>
          request === '../db' && parent?.filename.endsWith('/src/api/routes/cases.js'),
        value: db,
      },
    ],
    () => require('./cases')
  );
}

async function invoke(handler, request = {}) {
  const response = {
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

  await handler(
    {
      body: {},
      params: {},
      query: {},
      ...request,
    },
    response
  );

  return response;
}

test('cases router loads with its real database adapter', () => {
  clearCasesRouteCache();

  assert.doesNotThrow(() =>
    withMockedModules(
      [
        {
          matches: request => request === 'express',
          value: createExpressStub(),
        },
        {
          matches: request => request === 'uuid',
          value: { v4: () => '00000000-0000-4000-8000-000000000000' },
        },
      ],
      () => require('./cases')
    )
  );
});

test('creating a case uses the database-generated case id', async () => {
  let insert;
  const db = {
    async query(sql, params) {
      insert = { sql, params };
      return { rows: [{ id: 42, name: 'login case' }] };
    },
  };
  const router = loadCasesRoute(db);
  const route = router.routes.find(entry => entry.method === 'post' && entry.path === '/cases');

  const response = await invoke(route.handler, {
    body: {
      suite_id: 7,
      name: 'login case',
      description: 'critical path',
      type: 'web',
      content: [{ action: 'tap' }],
    },
    user: { id: 'tester' },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.id, 42);
  assert.doesNotMatch(insert.sql, /INSERT\s+INTO\s+test_case\s*\(\s*id\s*,/i);
  assert.match(insert.sql, /RETURNING\s+\*/i);
  assert.deepEqual(insert.params, [
    7,
    'login case',
    'critical path',
    'web',
    JSON.stringify([{ action: 'tap' }]),
    'tester',
  ]);
});

test('running a case uses the database-generated execution id', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });

      if (/FROM test_case/i.test(sql)) {
        return { rows: [{ id: 12, suite_id: 7, name: 'login case' }] };
      }

      if (/FROM test_suite/i.test(sql)) {
        return { rows: [{ id: 7, name: 'smoke suite' }] };
      }

      if (/INSERT INTO test_execution/i.test(sql)) {
        return { rows: [{ id: 99 }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const router = loadCasesRoute(db);
  const route = router.routes.find(entry => entry.method === 'post' && entry.path === '/cases/:id/run');

  const response = await invoke(route.handler, {
    params: { id: 12 },
    body: { device_id: 3 },
  });

  const executionInsert = calls.find(call => /INSERT INTO test_execution/i.test(call.sql));
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.data.execution_id, 99);
  assert.doesNotMatch(executionInsert.sql, /INSERT\s+INTO\s+test_execution\s*\(\s*id\s*,/i);
  assert.match(executionInsert.sql, /RETURNING\s+id/i);
  assert.deepEqual(executionInsert.params, [7, 3]);
});

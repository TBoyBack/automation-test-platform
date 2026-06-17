const test = require('node:test');
const assert = require('node:assert/strict');

function freshCasesRouter() {
  const routePath = require.resolve('./cases');
  delete require.cache[routePath];
  return require('./cases');
}

test('cases route loads with its database dependency', () => {
  const router = freshCasesRouter();

  assert.equal(typeof router, 'function');
});

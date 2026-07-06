const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('default Midscene suite does not publish to real social media accounts', () => {
  const specPath = path.join(__dirname, 'web_test.spec.ts');
  const source = readFileSync(specPath, 'utf8');

  assert.doesNotMatch(source, /https:\/\/(twitter|x)\.com/i);
  assert.doesNotMatch(source, /发布按钮/);
  assert.doesNotMatch(source, /新发布的帖子出现在时间线中/);
});

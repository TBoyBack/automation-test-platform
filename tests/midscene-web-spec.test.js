const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = readFileSync(
  path.join(__dirname, '..', 'scripts', 'midscene', 'web_test.spec.ts'),
  'utf8'
);

test('Midscene examples do not publish content to live social networks', () => {
  assert.doesNotMatch(source, /page\.goto\(['"]https:\/\/(?:www\.)?(?:twitter|x)\.com/i);
  assert.doesNotMatch(source, /aiTap\(['"]发布按钮['"]\)/);
  assert.doesNotMatch(source, /帖子发布成功/);
});

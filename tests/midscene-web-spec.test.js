const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const specPath = path.join(__dirname, '..', 'scripts', 'midscene', 'web_test.spec.ts');

test('web Midscene sample does not publish to a live social network', () => {
  const source = readFileSync(specPath, 'utf8');

  assert.doesNotMatch(source, /page\.goto\(\s*['"]https?:\/\/(?:www\.)?(?:twitter|x)\.com/i);
  assert.doesNotMatch(source, /aiTap\(\s*['"][^'"]*发布按钮/);
  assert.doesNotMatch(source, /帖子发布成功/);
});

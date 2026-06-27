const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const specPath = path.resolve(__dirname, 'web_test.spec.ts');

test('web Midscene examples do not publish to live social media', () => {
  const source = fs.readFileSync(specPath, 'utf8');

  assert.doesNotMatch(source, /https:\/\/(?:www\.)?(?:twitter|x)\.com/);
  assert.doesNotMatch(source, /aiTap\(['"`]发布按钮['"`]\)/);
  assert.doesNotMatch(source, /帖子发布成功/);
});

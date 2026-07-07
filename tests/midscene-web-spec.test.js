const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const webSpecPath = path.join(__dirname, '..', 'scripts', 'midscene', 'web_test.spec.ts');

test('Midscene web sample does not publish content to a live social platform', () => {
  const source = fs.readFileSync(webSpecPath, 'utf8');

  assert.doesNotMatch(source, /https:\/\/(?:www\.)?(?:twitter|x)\.com/i);
  assert.doesNotMatch(source, /aiTap\(['"]发布按钮['"]\)/);
  assert.doesNotMatch(source, /帖子发布成功/);
  assert.doesNotMatch(source, /新发布的帖子出现在时间线中/);
});

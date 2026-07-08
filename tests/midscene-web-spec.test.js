const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('default Midscene web spec does not publish to live Twitter or X', () => {
  const specPath = path.join(__dirname, '..', 'scripts', 'midscene', 'web_test.spec.ts');
  const source = fs.readFileSync(specPath, 'utf8');

  assert.doesNotMatch(source, /https?:\/\/(?:www\.)?(?:twitter|x)\.com/i);
  assert.doesNotMatch(source, /aiTap\(['"`]发布按钮['"`]\)/);
  assert.doesNotMatch(source, /帖子发布成功/);
});

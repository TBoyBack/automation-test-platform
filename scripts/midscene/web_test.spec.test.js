const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

test('Midscene sample tests do not publish to live social media', () => {
  const spec = readFileSync(join(__dirname, 'web_test.spec.ts'), 'utf8');

  assert.doesNotMatch(spec, /https:\/\/(?:www\.)?(twitter|x)\.com/i);
  assert.doesNotMatch(spec, /aiTap\(['"]发布按钮['"]\)/);
  assert.doesNotMatch(spec, /帖子发布成功/);
});

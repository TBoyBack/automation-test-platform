const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Midscene web examples do not target live social publishing', () => {
  const source = fs.readFileSync(path.join(__dirname, 'web_test.spec.ts'), 'utf8');

  assert.doesNotMatch(
    source,
    /https:\/\/(?:www\.)?(?:twitter|x)\.com/i,
    'runnable examples must not navigate to a live social network'
  );
  assert.doesNotMatch(
    source,
    /这是一条使用 AI 自动化测试发布的推文/,
    'runnable examples must not contain real-post sample content'
  );
});

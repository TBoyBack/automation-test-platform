const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('the default Midscene suite cannot publish to a live social network', () => {
  const specPath = path.join(
    __dirname,
    '..',
    'scripts',
    'midscene',
    'web_test.spec.ts'
  );
  const source = fs.readFileSync(specPath, 'utf8');

  assert.doesNotMatch(source, /https?:\/\/(?:www\.)?(?:twitter|x)\.com/i);
  assert.doesNotMatch(source, /社交媒体\s*-\s*发布图文帖子/);
});

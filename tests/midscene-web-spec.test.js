const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const specPath = path.join(__dirname, '..', 'scripts', 'midscene', 'web_test.spec.ts');

test('social media posting sample is skipped by default', () => {
  const source = readFileSync(specPath, 'utf8');

  assert.match(
    source,
    /midsceneTest\.skip\(['"]社交媒体 - 发布图文帖子['"]/,
    'live social-media publishing must not run in the default Playwright suite'
  );
});

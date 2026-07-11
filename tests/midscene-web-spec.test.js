const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const specPath = path.join(__dirname, '..', 'scripts', 'midscene', 'web_test.spec.ts');

test('Midscene web sample does not publish to a live social account by default', () => {
  const source = fs.readFileSync(specPath, 'utf8');

  assert.doesNotMatch(source, /https:\/\/twitter\.com/i);
  assert.doesNotMatch(source, /aiTap\(['"]发布按钮['"]\)/);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const specPath = path.join(__dirname, '..', 'scripts', 'midscene', 'web_test.spec.ts');

test('default Midscene web sample does not publish to live Twitter', () => {
  const source = fs.readFileSync(specPath, 'utf8');

  assert.doesNotMatch(source, /page\.goto\(['"]https:\/\/twitter\.com['"]\)/);
  assert.doesNotMatch(source, /aiTap\(['"]发布按钮['"]\)/);
  assert.doesNotMatch(source, /使用 AI 自动化测试发布的推文/);
});

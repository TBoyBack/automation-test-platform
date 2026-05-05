const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const webSpecPath = path.join(repoRoot, 'scripts', 'midscene', 'web_test.spec.ts');
const productionSocialHosts = /https?:\/\/(?:www\.)?(?:twitter|x)\.com/i;
const destructivePublishAction = /aiTap\(\s*['"][^'"]*(?:发布|post|tweet)[^'"]*['"]\s*\)/i;

test('default Midscene specs do not publish to production social media', () => {
  const webSpec = fs.readFileSync(webSpecPath, 'utf8');

  assert.doesNotMatch(
    webSpec,
    productionSocialHosts,
    'default test specs must not target real Twitter/X hosts',
  );
  assert.doesNotMatch(
    webSpec,
    destructivePublishAction,
    'default test specs must not click production publish/post/tweet controls',
  );
});

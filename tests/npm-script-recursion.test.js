/**
 * Root npm scripts must not `cd` into a directory that has no package.json
 * and then `npm run` a script that also exists on the root package.
 *
 * npm walks upward when the current directory has no package.json, so
 * `cd src/api && npm run dev` executes the root `dev` script. That script
 * starts `dev:server` again. After `npm install`, `npm run dev:server`
 * (the README start command) spawns `concurrently` forever and exhausts
 * the process table.
 *
 * `--prefix` stays on the given directory and fails immediately when that
 * package.json is absent.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const dangerous = [];
for (const [name, body] of Object.entries(pkg.scripts)) {
  const re = /cd\s+(\S+)\s+&&\s+npm run\s+([^\s&;]+)/g;
  let match;
  while ((match = re.exec(body))) {
    const dir = match[1];
    const script = match[2];
    const childPkg = path.join(root, dir, 'package.json');
    if (!fs.existsSync(childPkg) && Object.prototype.hasOwnProperty.call(pkg.scripts, script)) {
      dangerous.push(
        `${name} runs "cd ${dir} && npm run ${script}" but ${dir}/package.json is missing, so npm executes the root "${script}" script`
      );
    }
  }
}

assert.deepStrictEqual(dangerous, []);

function runScript(script, expectedDir) {
  const started = Date.now();
  const result = spawnSync('timeout', ['--signal=KILL', '5', 'npm', 'run', script], {
    cwd: root,
    encoding: 'utf8',
  });
  const elapsed = Date.now() - started;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  assert.ok(elapsed < 5000, `${script} ran for ${elapsed}ms`);
  assert.ok(result.status !== 0 && result.status !== 124 && result.status !== 137, `${script} status ${result.status}\n${output}`);
  assert.match(output, new RegExp(`${expectedDir}/package\\.json`));
  assert.doesNotMatch(output, /concurrently "npm run dev:server"/);
  assert.doesNotMatch(output, /can't cd to src\/web/);
}

runScript('dev:server', 'src/api');
runScript('dev:web', 'src/web');
runScript('build:server', 'src/api');
runScript('build:web', 'src/web');

console.log('npm script recursion checks passed');

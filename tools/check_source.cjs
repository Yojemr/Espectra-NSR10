const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML identifiers');
assert.ok(
  html.indexOf('<noscript>') < html.indexOf('<header'),
  'JavaScript notice must precede the header',
);
for (const match of html.matchAll(/(?:src|href)="(assets\/[^"#]+|data\/[^"#]+)"/g)) {
  assert.ok(fs.existsSync(path.join(root, match[1])), `Missing asset: ${match[1]}`);
}
for (const name of fs.readdirSync(path.join(root, 'assets'))) {
  const file = path.join(root, 'assets', name);
  if (name.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
  assert.ok(!fs.readFileSync(file, 'utf8').includes('\uFFFD'), `Invalid Unicode in ${name}`);
}
assert.ok(!html.includes('\uFFFD'), 'Invalid Unicode in HTML');
assert.ok(
  fs
    .readFileSync(path.join(root, 'README.md'), 'utf8')
    .includes('https://yojemr.github.io/Espectra-NSR10/'),
  'Missing deployment link in README',
);
console.log('Source integrity, HTML identifiers, asset paths and JavaScript syntax verified.');

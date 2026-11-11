const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const pkg = path.join(root, 'node_modules/three');
assert.equal(JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'))).version, '0.187.0');
const target = path.join(root, 'assets/vendor/three');
const files = {
  'three.module.js': 'build/three.module.js',
  'three.core.js': 'build/three.core.js',
  'OrbitControls.js': 'examples/jsm/controls/OrbitControls.js',
  LICENSE: 'LICENSE',
};
if (!process.argv.includes('--check')) fs.mkdirSync(target, { recursive: true });
for (const [name, source] of Object.entries(files)) {
  const bytes = fs.readFileSync(path.join(pkg, source));
  if (process.argv.includes('--check'))
    assert.deepEqual(fs.readFileSync(path.join(target, name)), bytes, `Vendor mismatch: ${name}`);
  else fs.writeFileSync(path.join(target, name), bytes);
}
console.log('Three.js 0.187.0: local runtime files and license verified.');

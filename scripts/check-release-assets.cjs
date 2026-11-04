'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8'));
const version = config.version;
assert.match(version, /^\d+\.\d+\.\d+$/, 'Expected a semantic version');

for (const [file, readme, language] of [
  ['screenshot.png', 'README.ja.md', '日本語'],
  ['screenshot-en.png', 'README.md', 'English'],
]) {
  const png = fs.readFileSync(path.join(root, 'assets', file));
  assert.ok(png.length > 8000, file + ': image unexpectedly small');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file + ': PNG signature');
  assert.equal(png.toString('ascii', 12, 16), 'IHDR', file + ': PNG header');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.ok(width >= 320 && height >= 640 && height <= 3000, file + ': smartphone-sized screenshot is required');
  const content = fs.readFileSync(path.join(root, readme), 'utf8');
  assert.ok(content.includes('v' + version) && content.includes('assets/' + file), readme + ': screenshot/version reference');
  assert.ok(content.includes('docs/releases/v' + version + '.md'), readme + ': release notes link');
  console.log('[OK]', language, file, width + 'x' + height, png.length + ' bytes');
}
for (const file of ['src/index.template.html', 'pass-the-phone-vote.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(html.includes('id="versionBadge">v' + version + '</span>'), file + ': app version badge');
}
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
assert.ok(changelog.includes('## ' + version), 'Changelog release section must match app version');
assert.ok(fs.existsSync(path.join(root, 'docs', 'releases', 'v' + version + '.md')), 'Release notes must exist');
console.log('[OK] Release screenshots, version labels and release documentation match v' + version);

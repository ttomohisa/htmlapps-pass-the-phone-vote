'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { assertReleaseAlias } = require('./verify-release-alias.cjs');
const html = time => `<!doctype html>\n<script>const BUILD_MANIFEST={"generatedAtUtc":"${time}","app":{"version":"1.0.0"}};const text='result';</script>\n`;
test('identical alias bytes pass', () => assert.doesNotThrow(() => assertReleaseAlias(html('A'), html('A'))));
test('only generated build timestamp may differ', () => assert.doesNotThrow(() => assertReleaseAlias(html('A'), html('B'))));
test('CRLF checkout normalization is allowed', () => assert.doesNotThrow(() => assertReleaseAlias(html('A'), html('B').replaceAll('\n', '\r\n'))));
test('stale runtime code is rejected', () => assert.throws(() => assertReleaseAlias(html('A'), html('B').replace("text='result'", "text='stale'")), /differs/));
test('version changes are rejected', () => assert.throws(() => assertReleaseAlias(html('A'), html('B').replace('1.0.0', '0.9.0')), /differs/));
test('extra timestamp outside manifest is not normalized', () => assert.throws(() => assertReleaseAlias(html('A')+'{"generatedAtUtc":"x"}', html('A')+'{"generatedAtUtc":"y"}'), /differs/));
test('missing or duplicate manifest is rejected', () => { assert.throws(() => assertReleaseAlias('', ''), /manifest/); assert.throws(() => assertReleaseAlias(html('A')+html('B'), html('A')+html('B')), /manifest/); });
test('validation covers Node.js 22 and 24 while preview pins Node.js 24', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const workflows = path.join(__dirname, '..', '.github', 'workflows');
  const validation = fs.readFileSync(path.join(workflows, 'build-standalone.yml'), 'utf8');
  const preview = fs.readFileSync(path.join(workflows, 'preview.yml'), 'utf8');
  assert.match(validation, /node: \[22, 24\]/);
  assert.match(validation, /node-version: \$\{\{ matrix\.node \}\}/);
  assert.match(validation, /name: standalone-html-.*matrix\.node/);
  assert.match(preview, /uses: actions\/setup-node@(?:v6|249970729cb0ef3589644e2896645e5dc5ba9c38)\s+with:\s+node-version: 24\b/);
});

test('release workflow verifies stable versions, existing releases and assets before publishing', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const release = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'release-on-main.yml'), 'utf8');
  assert.match(release, /branches: \[main\]/);
  assert.match(release, /app\.config\.json/);
  assert.match(release, /should_release/);
  assert.match(release, /getReleaseByTag/);
  assert.match(release, /sha256sum -c SHA256SUMS\.txt/);
  assert.match(release, /gh release create/);
  assert.match(release, /\.self-extract\.html/);
  assert.match(release, /--target "\$GITHUB_SHA"/);
  assert.match(release, /contents: write/);
});

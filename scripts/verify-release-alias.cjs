'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// Build time is intentionally variable. Every other release byte must match,
// apart from Git's LF/CRLF checkout conversion.
function normalizeBuildTime(html) {
  const normalized = html.replaceAll('\r\n', '\n');
  const manifests = [...normalized.matchAll(/const BUILD_MANIFEST=(\{[^\r\n]*?\});/g)];
  assert.equal(manifests.length, 1, 'Expected exactly one build manifest.');
  const [statement, json] = manifests[0];
  const manifest = JSON.parse(json);
  assert.equal(typeof manifest.generatedAtUtc, 'string', 'Build manifest needs a timestamp.');
  const timestamp = '"generatedAtUtc":' + JSON.stringify(manifest.generatedAtUtc);
  assert.equal(json.split(timestamp).length, 2, 'Expected one build manifest timestamp.');
  return normalized.replace(statement, statement.replace(timestamp, '"generatedAtUtc":"<build-time>"'));
}
function assertReleaseAlias(readable, alias) {
  assert.equal(normalizeBuildTime(alias), normalizeBuildTime(readable), 'Root download differs from the current readable build. Rebuild and copy dist/index.html to pass-the-phone-vote.html.');
}
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  assertReleaseAlias(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8'), fs.readFileSync(path.join(root, 'pass-the-phone-vote.html'), 'utf8'));
  console.log('[OK] Root download matches the readable release (build time excluded).');
}
module.exports = { assertReleaseAlias };

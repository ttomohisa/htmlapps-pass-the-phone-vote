'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp, loadHtml } = require('./voting-test-harness.cjs');
const filename = path.resolve(__dirname, '..', process.env.PASS_THE_PHONE_VOTE_SOURCE || 'src/index.template.html');
const html = loadHtml(filename);

// Source contracts complement native wheel, geometry, and keyboard checks.
test('native modal root and body locks are scoped to an open modal', () => {
  assert.match(html, /html:has\(dialog:modal\),\s*body:has\(dialog:modal\)\s*\{\s*overflow:\s*hidden;?\s*\}/);
});

test('JA and EN Help document the temporary background lock', () => {
  assert.match(html, /data-i18n="helpModalScroll"/);
  assert.match(html, /ダイアログを開いている間は背景のスクロールが止まります。/);
  assert.match(html, /Background scrolling is paused while a dialog is open\./);
});

test('the existing decorative local-processing shield is retained', () => {
  const badge = html.match(/<div class="local-badge">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(badge, /aria-hidden="true"/);
  assert.match(badge, /d="M12 3 5 6v5c0 4\.6 2\.8 8 7 10 4\.2-2 7-5\.4 7-10V6z"/);
  assert.match(badge, /d="m9 12 2 2 4-5"/);
});

test('Help retains its bounded shell, fixed header, and scrollable reading body', () => {
  const shell = html.match(/#helpDialog\[open\]\s*\{([^}]+)\}/)?.[1] || '';
  const header = html.match(/\.dialog-header\s*\{([^}]+)\}/)?.[1] || '';
  const body = html.match(/\.dialog-body\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(shell, /display:\s*flex/);
  assert.match(shell, /flex-direction:\s*column/);
  assert.match(shell, /max-height:\s*calc\(100dvh - 28px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)/);
  assert.match(header, /flex:\s*0 0 auto/);
  assert.match(body, /min-height:\s*0/);
  assert.match(body, /flex:\s*1 1 auto/);
  assert.match(body, /overflow:\s*auto/);
  assert.match(body, /overscroll-behavior:\s*contain/);
  assert.match(body, /env\(safe-area-inset-bottom\)/);
});

test('confirmation and recovery share an open-only bounded flex shell', () => {
  const shell = html.match(/\.app-confirm-dialog\[open\]\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(shell, /display:\s*flex/);
  assert.match(shell, /flex-direction:\s*column/);
  assert.match(shell, /max-height:\s*min\(760px,calc\(100dvh - 28px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)\)/);
  for (const id of ['appConfirmDialog', 'sessionRecoveryDialog']) {
    assert.match(html, new RegExp(`<dialog class="app-confirm-dialog" id="${id}"`));
  }
});

test('confirmation and recovery headers cannot shrink away', () => {
  const header = html.match(/\.app-confirm-dialog \.app-confirm-header\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(header, /flex:\s*0 0 auto/);
});

test('confirmation and recovery bodies scroll through both existing actions', () => {
  const body = html.match(/\.app-confirm-dialog \.app-confirm-body\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(body, /min-height:\s*0/);
  assert.match(body, /flex:\s*1 1 auto/);
  assert.match(body, /overflow:\s*auto/);
  assert.match(body, /overscroll-behavior:\s*contain/);
  for (const [dialogId, firstAction, lastAction] of [
    ['appConfirmDialog', 'appConfirmCancel', 'appConfirmOk'],
    ['sessionRecoveryDialog', 'sessionRecoveryDiscard', 'sessionRecoveryContinue'],
  ]) {
    const dialog = html.match(new RegExp(`<dialog[^>]*id="${dialogId}"[^>]*>([\\s\\S]*?)<\\/dialog>`))?.[1] || '';
    assert.match(dialog, new RegExp(`<div class="app-confirm-body">[\\s\\S]*?<div class="app-confirm-actions">[\\s\\S]*?id="${firstAction}"[\\s\\S]*?id="${lastAction}"`));
  }
});

test('recovery still requires an explicit Continue or Discard decision', async () => {
  const previous = createApp(filename);
  previous.input(previous.el('questionInput'), 'Synthetic recovery');
  previous.inputs().forEach((input, index) => previous.input(input, `Choice ${index + 1}`));
  previous.el('startVoteButton').click();
  previous.el('appConfirmOk').click();
  await previous.settle();
  assert.equal(previous.screen(), 'readyScreen');

  for (const action of ['sessionRecoveryContinue', 'sessionRecoveryDiscard']) {
    const app = createApp(filename, { storage: previous.storage });
    const dialog = app.el('sessionRecoveryDialog');
    assert.equal(dialog.open, true);
    assert.equal(dialog.dispatch('cancel').defaultPrevented, true);
    dialog.dispatch('click', { clientX: -1, clientY: -1 });
    assert.equal(dialog.open, true);
    assert.equal(app.screen(), 'setupScreen');
    app.el(action).click();
    assert.equal(dialog.open, false);
    assert.equal(app.screen(), action === 'sessionRecoveryContinue' ? 'readyScreen' : 'setupScreen');
  }
});

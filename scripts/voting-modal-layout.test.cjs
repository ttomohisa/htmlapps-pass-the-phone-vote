'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp, loadHtml } = require('./voting-test-harness.cjs');
const filename = path.resolve(__dirname, '..', process.env.PASS_THE_PHONE_VOTE_SOURCE || 'src/index.template.html');
const html = loadHtml(filename);

test('build information and footer are hidden only at the existing phone breakpoint', () => {
  const mobileCss = html.match(/@media\(max-width:680px\)\{([\s\S]*?)\n\s*@media/)?.[1] || '';
  assert.match(mobileCss, /\.build-section,footer\{display:none\}/);
  const desktopCss = html.split('@media(max-width:680px)')[0];
  assert.doesNotMatch(desktopCss, /\.build-section,footer\{display:none\}/);
  assert.match(html, /<section class="build-section">/);
  assert.match(html, /<footer>/);
});

// Source contracts complement native wheel, geometry, and keyboard checks.
test('native modal root and body locks are scoped to an open modal', () => {
  assert.match(html, /html:has\(dialog:modal\),\s*body:has\(dialog:modal\)\s*\{\s*overflow:\s*hidden;?\s*\}/);
});

test('Help omits internal layout and focus audit prose', () => {
  assert.match(html, /data-i18n="helpModalScroll"/);
  assert.doesNotMatch(html, /ダイアログを開いている間は背景のスクロールが止まります。/);
  assert.doesNotMatch(html, /Background scrolling is paused while a dialog is open\./);
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

const recoveryKey = 'pass-the-phone-vote:vote-session:v1';
async function oneVoteSession(language = 'en') {
  const app = createApp(filename, { language });
  app.input(app.el('questionInput'), 'Synthetic recovery');
  app.inputs().forEach((input, index) => app.input(input, `Choice ${index + 1}`));
  app.input(app.el('participantCount'), '2');
  app.el('startVoteButton').click();
  app.el('appConfirmOk').click();
  await app.settle();
  app.el('beginVoteButton').click();
  app.el('voteOptions').children[0].click();
  app.el('confirmVoteButton').click();
  assert.equal(app.screen(), 'handoffScreen');
  assert.equal(JSON.parse(app.storage.get(recoveryKey)).state.completed, 1);
  return app;
}

// Model native default actions after running the actual application listeners.
// Close requests can be non-cancelable; this does not substitute for browser QA.
function platformCloseRequest(dialog, { closedBySupported = true, cancelable = true } = {}) {
  if (!dialog.open || (closedBySupported && dialog.getAttribute('closedby') === 'none')) return;
  const cancel = dialog.dispatch('cancel', { cancelable });
  if (!cancel.defaultPrevented && dialog.open) dialog.close();
  return cancel;
}
function pressEscape(dialog, options) {
  const keydown = dialog.dispatch('keydown', { key: 'Escape' });
  if (!keydown.defaultPrevented) platformCloseRequest(dialog, options);
  return keydown;
}

for (const language of ['en', 'ja']) {
  test(`recovery requires an explicit Continue or Discard decision in ${language}`, async () => {
    const previous = await oneVoteSession(language);
    for (const action of ['sessionRecoveryContinue', 'sessionRecoveryDiscard']) {
      const app = createApp(filename, { language, storage: previous.storage });
      const dialog = app.el('sessionRecoveryDialog');
      const saved = app.storage.get(recoveryKey);
      assert.equal(dialog.open, true);
      assert.equal(dialog.dispatch('cancel').defaultPrevented, true);
      assert.equal(dialog.dispatch('cancel', { cancelable: false }).defaultPrevented, false);
      dialog.dispatch('click', { clientX: -1, clientY: -1 });
      assert.equal(dialog.open, true);
      assert.equal(app.screen(), 'setupScreen');
      assert.equal(app.storage.get(recoveryKey), saved);
      app.el(action).click();
      assert.equal(dialog.open, false);
      if (action === 'sessionRecoveryContinue') {
        assert.equal(app.screen(), 'handoffScreen');
        assert.equal(app.run('state.completed'), 1);
        assert.equal(app.run('state.options[0].votes'), 1);
        assert.equal(app.storage.get(recoveryKey), saved);
      } else {
        assert.equal(app.screen(), 'setupScreen');
        assert.equal(app.run('state'), null);
        assert.equal(app.storage.has(recoveryKey), false);
      }
    }
  });

  test(`recovery rejects repeated platform close requests without activation in ${language}`, async () => {
    const previous = await oneVoteSession(language);
    const app = createApp(filename, { language, storage: previous.storage });
    const dialog = app.el('sessionRecoveryDialog');
    const saved = app.storage.get(recoveryKey);
    for (let attempt = 0; attempt < 3; attempt++) {
      platformCloseRequest(dialog, { cancelable: false });
      assert.equal(dialog.open, true);
      assert.equal(app.run('state'), null);
      assert.equal(app.storage.get(recoveryKey), saved);
    }
    app.el('sessionRecoveryContinue').click();
    assert.equal(app.screen(), 'handoffScreen');
    assert.equal(app.run('state.completed'), 1);
  });

  test(`recovery Escape fallback blocks dismissal when closedby is unsupported in ${language}`, async () => {
    const previous = await oneVoteSession(language);
    const app = createApp(filename, { language, storage: previous.storage });
    const dialog = app.el('sessionRecoveryDialog');
    const saved = app.storage.get(recoveryKey);
    for (let attempt = 0; attempt < 3; attempt++) {
      const keydown = pressEscape(dialog, { closedBySupported: false, cancelable: false });
      assert.equal(keydown.defaultPrevented, true);
      assert.equal(dialog.open, true);
      assert.equal(app.run('state'), null);
      assert.equal(app.storage.get(recoveryKey), saved);
    }
    assert.equal(dialog.dispatch('keydown', { key: 'Tab' }).defaultPrevented, false);
    assert.equal(dialog.dispatch('keydown', { key: 'Enter' }).defaultPrevented, false);
    app.el('sessionRecoveryDiscard').click();
    assert.equal(dialog.open, false);
    assert.equal(app.storage.has(recoveryKey), false);
  });

  for (const cancelable of [true, false]) {
    test(`Help and ordinary confirmation retain Escape dismissal in ${language}, cancelable=${cancelable}`, async () => {
      const app = createApp(filename, { language });
      app.el('helpButton').click();
      pressEscape(app.el('helpDialog'), { cancelable });
      assert.equal(app.el('helpDialog').open, false);
      const result = app.run("AppConfirm.ask({title:'Synthetic confirm',message:'Cancel safely'})");
      pressEscape(app.el('appConfirmDialog'), { cancelable });
      assert.equal(app.el('appConfirmDialog').open, false);
      assert.equal(await result, false);
      assert.equal(app.screen(), 'setupScreen');
    });
  }
}

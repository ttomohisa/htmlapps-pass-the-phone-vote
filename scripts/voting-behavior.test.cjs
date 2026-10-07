'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp } = require('./voting-test-harness.cjs');
const filename = path.resolve(process.argv[2] || path.join(__dirname, '..', 'src', 'index.template.html'));
const tests = [];
const test = (name, body) => tests.push({ name, body });
const key = 'pass-the-phone-vote:vote-session:v1';
function setup(app, choices = ['Rice', 'Pasta', 'Salad'], participants = 2) {
  app.input(app.el('questionInput'), 'Dinner "投票" 🍚');
  while (app.inputs().length < choices.length) app.el('addOptionButton').click();
  while (app.inputs().length > choices.length) app.document.querySelectorAll('.remove-option').at(-1).click();
  choices.forEach((choice, index) => app.input(app.inputs()[index], choice));
  app.input(app.el('participantCount'), String(participants));
}
async function start(app, choices, participants) { setup(app, choices, participants); app.el('startVoteButton').click(); app.el('appConfirmOk').click(); await app.settle(); assert.equal(app.screen(), 'readyScreen'); }
function vote(app, index = 0) { if (app.screen() === 'handoffScreen') app.el('nextVoterButton').click(); app.el('beginVoteButton').click(); app.el('voteOptions').children[index].click(); app.el('confirmVoteButton').click(); }
async function completed(app) { await start(app); vote(app, 0); vote(app, 1); assert.equal(app.screen(), 'revealScreen'); }
function hold(app, extra = {}) { app.el('revealButton').focus(); return app.el('revealButton').dispatch('keydown', { key: ' ', ...extra }); }
function hidden(app) { assert.equal(app.screen(), 'revealScreen'); assert.equal(app.el('resultList').children.length, 0); }
const state = app => JSON.parse(app.run('JSON.stringify(state)'));
const warning = app => app.el('recoveryWarning');

test('normal voting remains aggregate-only with duplicate-submit and private-DOM guards', async () => {
  const app = createApp(filename); await start(app); app.el('beginVoteButton').click(); app.el('voteOptions').children[1].click();
  assert.equal(state(app).completed, 0); assert.equal(app.el('confirmChoice').textContent, 'Pasta'); app.el('confirmVoteButton').click(); app.el('confirmVoteButton').click();
  assert.equal(state(app).completed, 1); assert.equal(app.el('confirmChoice').textContent, ''); assert.equal(app.el('voteOptions').children.length, 0);
  app.el('nextVoterButton').click(); app.el('nextVoterButton').click(); assert.equal(state(app).completed, 1);
  assert.deepEqual(Object.keys(JSON.parse(app.storage.get(key)).state).sort(), ['completed', 'options', 'participants', 'question']);
});
for (const target of ['question', 'first', 'middle', 'last']) for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
  test(`IME Enter ignores ${target}: ${JSON.stringify(composition)}`, () => { const app = createApp(filename); setup(app); const input = target === 'question' ? app.el('questionInput') : app.inputs()[{ first: 0, middle: 1, last: 2 }[target]]; input.focus(); const event = input.dispatch('keydown', { key: 'Enter', ...composition }); assert.equal(event.defaultPrevented, false); assert.equal(app.document.activeElement, input); assert.equal(app.inputs().length, 3); });
}
test('ordinary Enter navigates and appends once with ten-choice cap', () => { const app = createApp(filename); setup(app); app.el('questionInput').dispatch('keydown', { key: 'Enter' }); assert.equal(app.document.activeElement, app.inputs()[0]); app.inputs()[0].dispatch('keydown', { key: 'Enter' }); assert.equal(app.document.activeElement, app.inputs()[1]); app.inputs().at(-1).dispatch('keydown', { key: 'Enter' }); app.frame(20); assert.equal(app.inputs().length, 4); assert.equal(app.document.activeElement, app.inputs()[3]); setup(app, Array.from({ length: 10 }, (_, i) => 'Choice ' + i)); app.inputs().at(-1).dispatch('keydown', { key: 'Enter' }); assert.equal(app.inputs().length, 10); });
for (const kind of ['keyboard', 'pointer']) test(`continuous ${kind} hold reveals exactly once after 1200 ms, including clock zero`, async () => { const app = createApp(filename); await completed(app); if (kind === 'keyboard') hold(app); else app.el('revealButton').dispatch('pointerdown'); app.frame(1199); hidden(app); app.frame(1200); assert.equal(app.screen(), 'resultScreen'); const writes = app.controls.writes; app.frame(9000); app.el('revealButton').dispatch('keyup', { key: ' ' }); assert.equal(app.controls.writes, writes); });
const interruptions = {
  'early release': app => app.el('revealButton').dispatch('keyup', { key: ' ' }),
  'button blur': app => app.el('alternateRevealButton').focus(),
  'keyup elsewhere': app => app.el('alternateRevealButton').dispatch('keyup', { key: ' ' }),
  'window blur': app => app.window.dispatch('blur'),
  'hidden page': app => { app.document.hidden = true; app.document.visibilityState = 'hidden'; app.document.dispatch('visibilitychange'); app.document.hidden = false; app.document.visibilityState = 'visible'; app.document.dispatch('visibilitychange'); },
  'help modal': app => app.el('helpButton').click(),
  'confirmation modal': app => app.el('alternateRevealButton').click(),
  'history navigation': app => app.window.dispatch('popstate'),
  'pagehide': app => app.window.dispatch('pagehide'),
};
for (const [name, interrupt] of Object.entries(interruptions)) test(`hold canceled by ${name}, including an already queued callback`, async () => { const app = createApp(filename); await completed(app); app.frame(100); hold(app); const stale = [...app.frames.values()][0]; interrupt(app); stale(1500); app.frame(3000); hidden(app); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) test(`pointer hold canceled by ${event}`, async () => { const app = createApp(filename); await completed(app); app.frame(100); app.el('revealButton').dispatch('pointerdown', { pointerId: 7 }); const stale = [...app.frames.values()][0]; app.el('revealButton').dispatch(event, { pointerId: 7 }); stale(2000); hidden(app); });
test('stale frame cannot advance a newer reveal gesture', async () => { const app = createApp(filename); await completed(app); app.frame(100); hold(app); const stale = [...app.frames.values()][0]; app.el('revealButton').dispatch('keyup', { key: ' ' }); app.frame(200); hold(app); stale(9999); hidden(app); app.frame(1399); hidden(app); app.frame(1400); assert.equal(app.screen(), 'resultScreen'); });
test('unrelated pointer/key releases do not complete or cancel the held gesture', async () => { const app = createApp(filename); await completed(app); app.frame(100); app.el('revealButton').dispatch('pointerdown', { pointerId: 7 }); app.el('revealButton').dispatch('pointerup', { pointerId: 8 }); app.frame(1300); assert.equal(app.screen(), 'resultScreen'); });

test('choice deletion has immediate Undo that restores labels and preset', () => { const app = createApp(filename); setup(app); app.document.querySelectorAll('.remove-option')[1].click(); assert.deepEqual(app.inputs().map(el => el.value), ['Rice', 'Salad']); assert.equal(app.el('appToastAction').hidden, false); app.el('appToastAction').click(); assert.deepEqual(app.inputs().map(el => el.value), ['Rice', 'Pasta', 'Salad']); app.el('appToastAction').click(); assert.equal(app.inputs().length, 3); });
test('preset replacement Undo restores literal labels and original preset', () => { const app = createApp(filename); setup(app, ['はい "A"', '二択 🐈', 'Ω']); app.el('presetYesNo').click(); app.el('appToastAction').click(); assert.deepEqual(app.inputs().map(el => el.value), ['はい "A"', '二択 🐈', 'Ω']); assert.equal(app.el('presetCustom').getAttribute('aria-pressed'), 'true'); });
for (const edit of ['choice', 'question', 'participants', 'add', 'preset', 'language']) test(`setup Undo cannot overwrite newer ${edit} revision`, () => { const app = createApp(filename); setup(app); app.document.querySelectorAll('.remove-option')[1].click(); if (edit === 'choice') { app.input(app.inputs()[0], 'New'); app.input(app.inputs()[0], 'Rice'); } else if (edit === 'question') app.input(app.el('questionInput'), 'New question'); else if (edit === 'participants') app.input(app.el('participantCount'), '8'); else if (edit === 'add') app.el('addOptionButton').click(); else if (edit === 'preset') app.el('presetYesNo').click(); else app.el('languageButton').click(); const before = app.inputs().map(el => el.value); if (edit !== 'preset') { app.el('appToastAction').click(); assert.deepEqual(app.inputs().map(el => el.value), before); } else { app.el('appToastAction').click(); assert.deepEqual(app.inputs().map(el => el.value), ['Rice', 'Salad']); } });
test('Undo is invalidated when starting even if start confirmation is canceled', async () => { const app = createApp(filename); setup(app); app.document.querySelectorAll('.remove-option')[1].click(); app.el('startVoteButton').click(); app.el('appConfirmCancel').click(); await app.settle(); app.el('appToastAction').click(); assert.deepEqual(app.inputs().map(el => el.value), ['Rice', 'Salad']); });

test('failed save preserves accepted vote, invalidates stale snapshot, and persistently warns', async () => { const app = createApp(filename); await start(app); app.controls.failWrite = true; vote(app); assert.equal(state(app).completed, 1); assert.equal(app.screen(), 'handoffScreen'); assert.equal(app.storage.has(key), false); assert.ok(warning(app), 'persistent recovery warning exists'); assert.equal(warning(app).hidden, false); assert.match(warning(app).textContent, /reload|recover/i); app.flushTimers(); assert.equal(warning(app).hidden, false); app.el('languageButton').click(); assert.match(warning(app).textContent, /再読み込み|復旧/); app.controls.failWrite = false; app.el('nextVoterButton').click(); assert.equal(warning(app).hidden, true); assert.equal(JSON.parse(app.storage.get(key)).state.completed, 1); });
test('initial save failure and total write/remove failure are visible and honest', async () => { const app = createApp(filename); app.controls.failWrite = true; await start(app); assert.equal(warning(app)?.hidden, false); app.controls.failWrite = false; app.el('beginVoteButton').click(); app.el('voteOptions').children[0].click(); app.controls.failWrite = true; app.controls.failRemove = true; app.el('confirmVoteButton').click(); assert.equal(state(app).completed, 1); assert.equal(JSON.parse(app.storage.get(key)).state.completed, 0); assert.match(warning(app).textContent, /older|stale/i); });
test('discard handles failed removal by invalidating the old recovery payload', async () => { const previous = createApp(filename); await start(previous); const app = createApp(filename, { storage: previous.storage }); app.controls.failRemove = true; app.el('sessionRecoveryDiscard').click(); assert.equal(app.run('validateStoredSession(readSessionStorage(SESSION_STORAGE_KEY))'), null); assert.equal(app.screen(), 'setupScreen'); });
test('failed discard of unreadable data does not falsely say it was cleared', () => { const app = createApp(filename, { storage: [[key, '{bad']] }); assert.equal(app.storage.has(key), false); const later = createApp(filename); later.storage.set(key, '{bad'); later.controls.failRemove = true; later.controls.failWrite = true; later.run('initializeSessionRecovery()'); assert.equal(warning(later)?.hidden, false); assert.doesNotMatch(later.el('appToastMessage').textContent, /was discarded|cleared/); });

test('only revealed completed result can save aggregate UTF-8 text with edited filename', async () => { const app = createApp(filename); assert.ok(app.el('saveResultButton'), 'Save result button exists'); await start(app, ['"Rice" 🍚', "Pasta's Ω", 'ゼロ'], 2); app.el('saveResultButton').click(); assert.equal(app.downloads.length, 0); vote(app, 0); vote(app, 1); app.el('saveResultButton').click(); assert.equal(app.downloads.length, 0); hold(app); app.frame(1200); app.input(app.el('outputFilename'), '会議/"結果":?*\\.TXT'); app.el('saveResultButton').click(); assert.equal(app.downloads.length, 1); const saved = app.downloads[0]; assert.equal(saved.name, '会議結果.txt'); assert.equal(await saved.blob.text(), 'Dinner "投票" 🍚\n\n"Rice" 🍚: 1 vote (50%)\nPasta\'s Ω: 1 vote (50%)\nゼロ: 0 votes (0%)\n\nTotal votes: 2'); assert.equal(saved.blob.type, 'text/plain;charset=utf-8'); app.el('copyResultButton').click(); await app.settle(); assert.equal(app.globals.clipboard, await saved.blob.text()); app.flushTimers(); assert.ok(app.revoked.includes(saved.href)); });
for (const [value, expected] of [['../\\:*?"<>|\u0001', 'pass-the-phone-vote-results.txt'], ['CON', 'pass-the-phone-vote-results.txt'], ['report.txt.txt', 'report.txt'], ['  votes.TXT.  ', 'votes.txt'], ['会議 結果.txt', '会議 結果.txt']]) test(`safe filename ${JSON.stringify(value)}`, async () => { const app = createApp(filename); await completed(app); hold(app); app.frame(1200); assert.ok(app.el('outputFilename')); app.input(app.el('outputFilename'), value); app.el('saveResultButton').click(); assert.equal(app.downloads[0].name, expected); });
test('language refresh preserves edited export name and localizes export', async () => { const app = createApp(filename); await completed(app); hold(app); app.frame(1200); app.input(app.el('outputFilename'), '自分の名前.txt'); app.el('languageButton').click(); assert.equal(app.el('outputFilename').value, '自分の名前.txt'); app.el('saveResultButton').click(); assert.match(await app.downloads[0].blob.text(), /合計票数: 2/); });

test('recovery returns unconfirmed ballot to ready and revealed result to result', async () => { const app = createApp(filename); await start(app); app.el('beginVoteButton').click(); app.el('voteOptions').children[0].click(); app.window.dispatch('pagehide'); const reloaded = createApp(filename, { storage: app.storage }); reloaded.el('sessionRecoveryContinue').click(); assert.equal(reloaded.screen(), 'readyScreen'); assert.equal(reloaded.el('confirmChoice').textContent, ''); assert.equal(state(reloaded).completed, 0); vote(reloaded); vote(reloaded); hold(reloaded); reloaded.frame(1200); const result = createApp(filename, { storage: reloaded.storage }); result.el('sessionRecoveryContinue').click(); assert.equal(result.screen(), 'resultScreen'); assert.equal(state(result).completed, 2); result.el('saveResultButton')?.click(); assert.equal(result.downloads.length, 1); });
test('cancel keeps reveal/result/active vote and repeated flow resets only confirmed counts', async () => { const app = createApp(filename); await completed(app); app.el('alternateRevealButton').click(); app.el('appConfirmCancel').click(); await app.settle(); hidden(app); app.el('alternateRevealButton').click(); app.el('appConfirmOk').click(); await app.settle(); assert.equal(app.screen(), 'resultScreen'); const before = state(app); for (const id of ['repeatVoteButton', 'newVoteButton']) { app.el(id).click(); app.el('appConfirmCancel').click(); await app.settle(); assert.equal(app.screen(), 'resultScreen'); assert.deepEqual(state(app), before); } app.el('repeatVoteButton').click(); app.el('appConfirmOk').click(); await app.settle(); assert.equal(app.screen(), 'readyScreen'); assert.equal(state(app).completed, 0); app.document.querySelector('.abort-vote-button').click(); app.el('appConfirmCancel').click(); await app.settle(); assert.equal(app.screen(), 'readyScreen'); app.document.querySelector('.abort-vote-button').click(); app.el('appConfirmOk').click(); await app.settle(); assert.equal(app.screen(), 'setupScreen'); assert.equal(app.storage.has(key), false); });
test('100-person/10-choice flow remains bounded and percentages total 100', async () => { const app = createApp(filename); await start(app, Array.from({ length: 10 }, (_, index) => 'Choice ' + index), 100); for (let i = 0; i < 100; i++) vote(app, i % 3); hold(app); app.frame(1200); assert.equal(app.screen(), 'resultScreen'); const percentages = JSON.parse(app.run('JSON.stringify(resultPercentages())')); assert.equal(percentages.reduce((a, b) => a + b), 100); assert.deepEqual(percentages.slice(0, 3), [34, 33, 33]); });
test('stale start confirmation cannot overwrite an edited setup', async () => { const app = createApp(filename); setup(app); app.el('startVoteButton').click(); app.input(app.el('questionInput'), 'New question'); app.el('appConfirmOk').click(); await app.settle(); assert.equal(app.screen(), 'setupScreen'); assert.equal(state(app), null); });
for (const action of ['repeatVoteButton', 'newVoteButton', 'alternateRevealButton', 'abort']) test(`stale ${action} confirmation cannot change a restored session`, async () => { const app = createApp(filename); await completed(app); if (action !== 'alternateRevealButton' && action !== 'abort') { app.el('alternateRevealButton').click(); app.el('appConfirmOk').click(); await app.settle(); } if (action === 'abort') app.document.querySelector('.abort-vote-button').click(); else app.el(action).click(); const restored = { phase: action === 'alternateRevealButton' || action === 'abort' ? 'reveal' : 'result', state: { question: 'New source', options: [{ label: 'A', votes: 0 }, { label: 'B', votes: 2 }], participants: 2, completed: 2 } }; app.run('restoreVoteSession(' + JSON.stringify(restored) + ')'); app.el('appConfirmOk').click(); await app.settle(); assert.deepEqual(state(app), restored.state); assert.equal(app.screen(), restored.phase + 'Screen'); });
test('old setup Undo cannot overwrite restored data after returning to setup', () => { const app = createApp(filename); setup(app); app.document.querySelectorAll('.remove-option')[1].click(); app.run('restoreVoteSession({phase:"ready",state:{question:"Restored",options:[{label:"A",votes:0},{label:"B",votes:0}],participants:2,completed:0}})'); app.run('returnToSetupFromCurrentState()'); app.el('appToastAction').click(); assert.deepEqual(app.inputs().map(el => el.value), ['A', 'B']); assert.equal(app.el('questionInput').value, 'Restored'); });
test('closed confirm dialog autofocus cannot steal current workflow focus', async () => { const app = createApp(filename); await start(app); app.el('beginVoteButton').focus(); app.frame(50); assert.ok(app.document.activeElement === app.el('beginVoteButton'), 'focus remains on current workflow'); });
test('filename with extension only falls back and long Unicode remains byte-bounded', async () => { const app = createApp(filename); await completed(app); app.frame(100); hold(app); app.frame(1300); for (const value of ['.txt', '.TXT.txt', '. ', '']) { app.input(app.el('outputFilename'), value); app.el('saveResultButton').click(); assert.equal(app.downloads.at(-1).name, 'pass-the-phone-vote-results.txt'); } app.input(app.el('outputFilename'), '結果🐈'.repeat(100)); app.el('saveResultButton').click(); const name = app.downloads.at(-1).name; assert.ok(Buffer.byteLength(name, 'utf8') <= 200); assert.ok(!name.includes('\uFFFD')); assert.match(name, /\.txt$/); });
for (const phase of ['reveal', 'result', 'repeat']) test(`save failure at ${phase} retains live counts and removes stale recovery`, async () => { const app = createApp(filename); await start(app); vote(app); if (phase === 'reveal') app.controls.failWrite = true; vote(app); if (phase === 'result') app.controls.failWrite = true; app.el('alternateRevealButton').click(); app.el('appConfirmOk').click(); await app.settle(); if (phase === 'repeat') { app.controls.failWrite = true; app.el('repeatVoteButton').click(); app.el('appConfirmOk').click(); await app.settle(); } assert.equal(state(app).completed, phase === 'repeat' ? 0 : 2); assert.equal(app.storage.has(key), false); assert.equal(warning(app).hidden, false); });
test('recovery prompt warns saved progress might be older after total storage failure', async () => { const app = createApp(filename); await start(app); app.controls.failWrite = true; app.controls.failRemove = true; vote(app); const reload = createApp(filename, { storage: app.storage }); assert.match(reload.el('sessionRecoveryMessage').textContent, /older/); assert.equal(reload.screen(), 'setupScreen'); assert.equal(reload.el('sessionRecoveryDialog').open, true); });
test('a successful invalidation downgrades the stale warning without hiding recovery failure', async () => { const app = createApp(filename); await start(app); app.controls.failWrite = true; app.controls.failRemove = true; vote(app); app.controls.failRemove = false; app.run('clearVoteSession()'); assert.equal(app.storage.has(key), false); assert.equal(warning(app).hidden, false); assert.doesNotMatch(warning(app).textContent, /older/); });
test('late old confirmation cannot unlock a newer pending confirmation', async () => { const app = createApp(filename); await completed(app); app.el('alternateRevealButton').click(); const replacement = { phase: 'reveal', state: state(app) }; app.run('restoreVoteSession(' + JSON.stringify(replacement) + ')'); app.el('alternateRevealButton').click(); await app.settle(); assert.equal(app.run('revealConfirmPending'), true); app.el('appConfirmOk').click(); await app.settle(); assert.equal(app.screen(), 'resultScreen'); });
test('hold interrupted by reset cannot reveal a restored newer poll', async () => { const app = createApp(filename); await completed(app); app.frame(100); hold(app); const stale = [...app.frames.values()][0]; app.run('returnToSetupFromCurrentState()'); app.run('restoreVoteSession({phase:"reveal",state:{question:"New",options:[{label:"A",votes:2},{label:"B",votes:0}],participants:2,completed:2}})'); stale(9000); hidden(app); });
test('unrelated keyboard keyup and repeated keydown do not shorten continuous hold', async () => { const app = createApp(filename); await completed(app); app.frame(100); hold(app); app.el('revealButton').dispatch('keyup', { key: 'Enter' }); app.el('revealButton').dispatch('keydown', { key: ' ', repeat: true }); app.frame(1299); hidden(app); app.frame(1300); assert.equal(app.screen(), 'resultScreen'); });
test('invalid aggregate fails closed without private DOM or stale recovery', async () => { const app = createApp(filename); await start(app); app.el('beginVoteButton').click(); app.el('voteOptions').children[0].click(); app.run('state.completed=1'); app.el('confirmVoteButton').click(); assert.equal(app.screen(), 'setupScreen'); assert.equal(state(app), null); assert.equal(app.storage.has(key), false); assert.equal(app.el('confirmChoice').textContent, ''); assert.equal(app.el('voteOptions').children.length, 0); assert.equal(app.el('saveResultButton').disabled, true); });
test('queued Enter-add focus cannot reach a newer workflow', async () => { const app = createApp(filename); setup(app); app.inputs().at(-1).dispatch('keydown', { key: 'Enter' }); const stale = [...app.frames.values()][0]; app.input(app.inputs().at(-1), 'Soup'); app.el('startVoteButton').click(); app.el('appConfirmOk').click(); await app.settle(); app.el('beginVoteButton').focus(); stale(20); assert.ok(app.document.activeElement === app.el('beginVoteButton'), 'stale Enter callback cannot focus hidden setup'); });
test('queued return-to-setup focus cannot reach a restored session', async () => { const app = createApp(filename); await completed(app); app.frame(100); const restored = { phase: 'reveal', state: state(app) }; app.run('returnToSetupFromCurrentState()'); const stale = [...app.frames.values()][0]; app.run('restoreVoteSession(' + JSON.stringify(restored) + ')'); app.el('revealButton').focus(); stale(500); assert.ok(app.document.activeElement === app.el('revealButton'), 'stale return callback cannot focus hidden setup'); });
test('persistent recovery warning stays inside the mobile workflow scroll target', () => { const app = createApp(filename); assert.ok(warning(app).closest('.app-shell'), 'warning must be included when mobile scroll targets the workflow shell'); });
for (const language of ['en', 'ja']) for (const action of ['discard', 'abort', 'new']) test(`failed ${action} cleanup is honest in ${language}`, async () => { let app = createApp(filename, { language }); if (action === 'discard') { await start(app); app = createApp(filename, { language, storage: app.storage }); } else if (action === 'new') { await completed(app); app.el('alternateRevealButton').click(); app.el('appConfirmOk').click(); await app.settle(); } else await start(app); app.controls.failWrite = true; app.controls.failRemove = true; if (action === 'discard') app.el('sessionRecoveryDiscard').click(); else { if (action === 'new') app.el('newVoteButton').click(); else app.document.querySelector('.abort-vote-button').click(); app.el('appConfirmOk').click(); await app.settle(); } assert.equal(state(app), null); assert.equal(app.screen(), 'setupScreen'); assert.equal(warning(app).hidden, false); assert.match(warning(app).textContent, language === 'en' ? /discarded or rejected/ : /破棄・拒否/); assert.match(warning(app).textContent, language === 'en' ? /reappear/ : /古い投票/); });
for (const kind of ['copy', 'share']) test(`stale ${kind} completion cannot unlock or notify a newer result action`, async () => { const app = createApp(filename); await completed(app); app.el('alternateRevealButton').click(); app.el('appConfirmOk').click(); await app.settle(); const pending = []; if (kind === 'copy') app.globals.navigator.clipboard.writeText = () => new Promise(resolve => pending.push({ resolve })); else { app.globals.navigator.share = () => new Promise((resolve, reject) => pending.push({ resolve, reject })); app.run('renderResults()'); } const button = app.el(kind === 'copy' ? 'copyResultButton' : 'shareResultButton'); button.click(); const restored = { phase: 'result', state: { ...state(app), question: 'Different result' } }; app.run('restoreVoteSession(' + JSON.stringify(restored) + ')'); button.click(); assert.equal(pending.length, 2); if (kind === 'copy') pending[0].resolve(); else pending[0].reject(new Error('Old share failed')); await app.settle(); assert.equal(app.run('resultActionPending'), true); assert.equal(app.el('appToastMessage').textContent, ''); pending[1].resolve(); await app.settle(); assert.equal(app.run('resultActionPending'), false); if (kind === 'copy') assert.equal(app.el('appToastMessage').textContent, 'Result copied.'); });
for (const language of ['en', 'ja']) for (const index of [0, 1, 2]) {
  test(`deleting focused choice ${index + 1} focuses its next survivor or previous last (${language})`, () => {
    const app = createApp(filename, { language }); setup(app);
    const remove = app.document.querySelectorAll('.remove-option')[index];
    remove.focus(); remove.click(); app.frame(50);
    assert.equal(app.document.activeElement, app.inputs()[Math.min(index, 1)]);
    assert.ok(app.document.querySelectorAll('input').includes(app.document.activeElement));
    assert.equal(app.el('appToastAction').hidden, false);
    app.el('appToastAction').click();
    assert.deepEqual(app.inputs().map(input => input.value), ['Rice', 'Pasta', 'Salad']);
  });
}
for (const interruption of ['edit', 'modal', 'restored session']) {
  test(`queued choice-deletion focus respects ${interruption}`, () => {
    const app = createApp(filename); setup(app);
    app.document.querySelectorAll('.remove-option')[1].click();
    if (interruption === 'edit') { app.input(app.el('questionInput'), 'New question'); app.el('questionInput').focus(); }
    if (interruption === 'modal') { app.el('helpButton').click(); app.el('closeHelpButton').focus(); }
    if (interruption === 'restored session') { app.run('restoreVoteSession({phase:"ready",state:{question:"New",options:[{label:"A",votes:0},{label:"B",votes:0}],participants:2,completed:0}})'); app.el('beginVoteButton').focus(); }
    const expected = app.document.activeElement; app.frame(50);
    assert.equal(app.document.activeElement, expected);
  });
}
function pasteChoices(app, text) {
  assert.ok(app.el('choiceListInput'), 'setup provides an editable list textarea');
  app.el('choiceListDetails').open = true;
  app.input(app.el('choiceListInput'), text);
}
for (const language of ['en', 'ja']) {
  test(`choice list starts collapsed, uses manual entry, and has localized accessible guidance (${language})`, () => {
    const app = createApp(filename, { language });
    assert.ok(app.el('choiceListDetails'), 'setup offers Paste a list');
    assert.equal(app.el('choiceListDetails').open, false);
    assert.equal(app.el('choiceListInput').tagName, 'TEXTAREA');
    assert.equal(app.document.querySelector('label[for="choiceListInput"]').textContent, language === 'en' ? 'One choice per line' : '1行に1つの選択肢');
    assert.equal(app.el('choiceListInput').getAttribute('aria-describedby'), 'choiceListHelp choiceListError');
    assert.match(app.el('choiceListHelp').textContent, language === 'en' ? /replace/i : /置き換え/);
    assert.equal(/clipboard\.read|addEventListener\(['"]paste['"]/.test(app.html), false);
  });
  test(`valid choice list trims blank lines, preserves literals and poll settings, and supports Undo (${language})`, () => {
    const app = createApp(filename, { language }); setup(app);
    app.el('presetYesNo').click(); const original = app.inputs().map(input => input.value);
    const question = app.el('questionInput').value, participants = app.el('participantCount').value;
    pasteChoices(app, ' \r\n  <b>Rice</b>  \r\n\r\n パスタ 🍝 \n  "Soup, salad"\r');
    app.el('applyChoiceListButton').click(); app.frame(50);
    assert.deepEqual(app.inputs().map(input => input.value), ['<b>Rice</b>', 'パスタ 🍝', '"Soup, salad"']);
    assert.equal(app.run('selectedPreset'), 'custom');
    assert.equal(app.el('questionInput').value, question); assert.equal(app.el('participantCount').value, participants);
    assert.equal(app.document.activeElement, app.inputs()[0]);
    assert.equal(app.el('choiceListInput').value, ''); assert.equal(app.el('choiceListDetails').open, false);
    assert.equal(app.storage.size, 0); assert.equal(state(app), null);
    app.el('applyChoiceListButton').click(); // An already queued second action cannot replace the Undo.
    app.el('appToastAction').click();
    assert.deepEqual(app.inputs().map(input => input.value), original); assert.equal(app.run('selectedPreset'), 'yesno');
    assert.equal(app.el('choiceListInput').value, '');
  });
  for (const [name, text, error] of [
    ['empty', ' \n\t\r\n', 'choiceRange'], ['one', 'A', 'choiceRange'],
    ['eleven', Array.from({ length: 11 }, (_, i) => String(i)).join('\n'), 'choiceRange'],
    ['duplicate', ' Rice \n rICE ', 'choiceDuplicate'], ['overlong', 'x'.repeat(81) + '\nB', 'choiceListTooLong'],
    ['emoji overlong', '🐈'.repeat(40) + 'a\nB', 'choiceListTooLong'],
    ['comma separated', 'Rice,Pasta,Salad', 'choiceRange'],
  ]) test(`invalid ${name} list is rejected atomically with field-local error (${language})`, () => {
    const app = createApp(filename, { language }); setup(app);
    const before = app.run('setupSignature()'); pasteChoices(app, text);
    const options = app.inputs(); app.el('applyChoiceListButton').click();
    assert.deepEqual(app.inputs(), options); assert.equal(app.run('setupSignature()'), before);
    assert.equal(app.el('choiceListInput').value, text); assert.equal(app.el('choiceListInput').getAttribute('aria-invalid'), 'true');
    assert.equal(app.el('choiceListError').hidden, false); assert.equal(app.el('choiceListError').textContent, app.run(`t('${error}')`));
    assert.equal(app.document.activeElement, app.el('choiceListInput')); assert.equal(app.storage.size, 0); assert.equal(state(app), null);
  });
}
for (const labels of [['A', 'B'], Array.from({ length: 10 }, (_, index) => index === 0 ? '🐈'.repeat(40) : String(index))]) {
  test(`choice list accepts ${labels.length} entries at exact limits`, () => {
    const app = createApp(filename); setup(app); pasteChoices(app, labels.join('\n')); app.el('applyChoiceListButton').click();
    assert.deepEqual(app.inputs().map(input => input.value), labels); assert.equal(app.el('choiceListError').hidden, true);
  });
}
test('editing a list draft invalidates older setup Undo without applying it', () => {
  const app = createApp(filename); setup(app); app.document.querySelectorAll('.remove-option')[1].click();
  pasteChoices(app, 'A\nB'); app.el('appToastAction').click();
  assert.deepEqual(app.inputs().map(input => input.value), ['Rice', 'Salad']); assert.equal(app.el('appToastAction').hidden, true);
});
test('invalid-list correction clears the field error and language switches translate it without changing the draft', () => {
  const app = createApp(filename); setup(app); pasteChoices(app, 'A'); app.el('applyChoiceListButton').click();
  app.el('languageButton').click(); assert.equal(app.el('choiceListInput').value, 'A');
  assert.equal(app.el('choiceListError').textContent, app.run("t('choiceRange')"));
  pasteChoices(app, 'A\nB'); assert.equal(app.el('choiceListInput').getAttribute('aria-invalid'), null); assert.equal(app.el('choiceListError').hidden, true);
});
test('list draft is not saved on reload and is cleared when voting starts or a session is restored', async () => {
  const app = createApp(filename); setup(app); pasteChoices(app, 'Unapplied\nDraft');
  assert.equal(app.storage.size, 0); const reload = createApp(filename, { storage: app.storage }); assert.equal(reload.el('choiceListInput').value, '');
  app.el('startVoteButton').click(); app.el('appConfirmCancel').click(); await app.settle();
  assert.equal(app.el('choiceListInput').value, 'Unapplied\nDraft');
  app.el('startVoteButton').click(); app.el('appConfirmOk').click(); await app.settle();
  assert.equal(app.screen(), 'readyScreen'); assert.equal(app.el('choiceListInput').value, ''); assert.equal(app.el('choiceListDetails').open, false);
  assert.ok(!app.storage.get(key).includes('Unapplied')); assert.deepEqual(state(app).options.map(option => option.label), ['Rice', 'Pasta', 'Salad']);
  app.run('returnToSetupFromCurrentState()'); pasteChoices(app, 'Private draft\nNot a vote');
  app.run('restoreVoteSession({phase:"ready",state:{question:"Saved",options:[{label:"A",votes:0},{label:"B",votes:0}],participants:2,completed:0}})');
  assert.equal(app.el('choiceListInput').value, ''); assert.equal(app.el('choiceListDetails').open, false);
});
test('new list edits invalidate a pending start confirmation', async () => {
  const app = createApp(filename); setup(app); app.el('startVoteButton').click(); pasteChoices(app, 'A\nB');
  app.el('applyChoiceListButton').click(); assert.deepEqual(app.inputs().map(input => input.value), ['Rice', 'Pasta', 'Salad']);
  app.el('appConfirmOk').click(); await app.settle(); assert.equal(app.screen(), 'setupScreen'); assert.equal(state(app), null);
});
for (const interruption of ['edit', 'modal', 'restored session']) test(`queued list-apply focus respects ${interruption}`, () => {
  const app = createApp(filename); setup(app); pasteChoices(app, 'A\nB'); app.el('applyChoiceListButton').click();
  if (interruption === 'edit') { app.input(app.el('questionInput'), 'New question'); app.el('questionInput').focus(); }
  if (interruption === 'modal') { app.el('helpButton').click(); app.el('closeHelpButton').focus(); }
  if (interruption === 'restored session') { app.run('restoreVoteSession({phase:"ready",state:{question:"New",options:[{label:"A",votes:0},{label:"B",votes:0}],participants:2,completed:0}})'); app.el('beginVoteButton').focus(); }
  const expected = app.document.activeElement; app.frame(50); assert.equal(app.document.activeElement, expected);
});
test('applying a list is blocked outside setup and while a dialog is open', async () => {
  const app = createApp(filename); setup(app); pasteChoices(app, 'A\nB'); app.el('helpButton').click(); app.el('applyChoiceListButton').click();
  assert.deepEqual(app.inputs().map(input => input.value), ['Rice', 'Pasta', 'Salad']); app.el('closeHelpButton').click();
  app.el('startVoteButton').click(); app.el('appConfirmOk').click(); await app.settle();
  pasteChoices(app, 'Different\nOptions'); app.el('applyChoiceListButton').click(); assert.deepEqual(state(app).options.map(option => option.label), ['Rice', 'Pasta', 'Salad']);
});
test('list textarea Enter and IME Enter stay in the draft without changing choices', () => {
  const app = createApp(filename); setup(app); pasteChoices(app, 'A'); const input = app.el('choiceListInput'); input.focus();
  for (const extra of [{}, { isComposing: true }, { keyCode: 229 }]) {
    const event = input.dispatch('keydown', { key: 'Enter', ...extra });
    assert.equal(event.defaultPrevented, false); assert.equal(app.document.activeElement, input); assert.deepEqual(app.inputs().map(input => input.value), ['Rice', 'Pasta', 'Salad']);
  }
});
for (const initialLanguage of ['en', 'ja']) test(`header language controls stay localized from ${initialLanguage} across repeated switches`, () => {
  const app = createApp(filename, { language: initialLanguage });
  setup(app, ['A', '投票 B'], 3);
  for (let index = 0; index < 5; index++) {
    const language = app.document.documentElement.lang;
    const target = language === 'ja' ? '英語に切り替え' : 'Switch to Japanese';
    const button = app.el('languageButton');
    assert.equal(button.textContent, language === 'ja' ? 'EN' : 'JA');
    assert.equal(button.getAttribute('aria-label'), target);
    assert.equal(button.title, target);
    for (const [id, expected] of [['helpButton', language === 'ja' ? '使い方と注意事項' : 'How to use & notes'], ['closeHelpButton', language === 'ja' ? '閉じる' : 'Close']]) {
      assert.equal(app.el(id).getAttribute('aria-label'), expected);
      assert.equal(app.el(id).title, expected);
    }
    assert.equal(app.document.querySelector('[data-i18n="localBadge"]').textContent, language === 'ja' ? '完全ローカル処理' : 'Fully local processing');
    assert.deepEqual(app.inputs().map(input => input.value), ['A', '投票 B']);
    assert.equal(app.el('participantCount').value, '3');
    app.el('helpButton').click();
    assert.equal(app.el('helpDialog').open, true);
    app.el('closeHelpButton').click();
    assert.equal(app.el('helpDialog').open, false);
    button.click();
    assert.equal(app.document.documentElement.lang, language === 'ja' ? 'en' : 'ja');
  }
});

(async () => { let failed = 0; console.log('Behavior target: ' + filename); for (const item of tests) { try { await item.body(); console.log('PASS ' + item.name); } catch (error) { failed++; console.error('FAIL ' + item.name + '\n' + (error.stack || error)); } } console.log(`${tests.length - failed}/${tests.length} behavior tests passed`); process.exitCode = failed ? 1 : 0; })();

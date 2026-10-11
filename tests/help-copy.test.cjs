const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');

const rejected = [
  "ダイアログを開いている間は背景のスクロールが止まります。高さの低い画面でも、ヘルプ本文や確認・復旧ダイアログの本文と操作ボタンまでスクロールできます。復旧はEscキーや背景クリックでは閉じず、「続ける」か「破棄する」を選んで進めます。ダイアログを閉じると通常のページスクロールに戻ります。",
  "Background scrolling is paused while a dialog is open. On short screens, scroll Help content or the confirmation/recovery body to reach its actions. Recovery stays open on Escape or backdrop clicks; choose Continue or Discard. Closing the dialog restores normal page scrolling.",
  "投票内容はブラウザ内だけで処理され、外部サーバーへ送信されません。誰がどれを選んだかという個別の回答履歴は作らず、確定時に選択肢ごとの票数だけを加算します。確定済みの回答表示はDOMからも削除します。",
  "Votes are processed only in the browser and are not sent to a server. The app does not keep individual voter-to-choice records; confirmation only increments the aggregate count, and the confirmed answer display is removed from the DOM.",
  "投票確定・次の人へ・開票などは連打しても1回だけ処理します。途中で投票を中止する場合は確認してから確定済みの票を破棄します。",
  "Vote confirmation, handoff, and reveal actions are guarded so repeated taps are processed only once. Stopping an in-progress vote requires confirmation before confirmed counts are discarded.",
  "選択肢を削除すると次の選択肢へ、最後なら1つ前へフォーカスが移ります。",
  "Deleting a choice moves focus to the next choice, or the previous choice if it was last. "
];

test('help contains user guidance rather than implementation or layout audit prose', () => {
  const root = path.join(__dirname, '..');
  const files = ['src/index.template.html', 'dist/index.html', 'dist/index.self-extract.html',
    ...fs.readdirSync(root).filter(name => name.endsWith('.html'))];
  for (const file of files) {
    const filename = path.join(root, file);
    if (!fs.existsSync(filename)) continue;
    let html = fs.readFileSync(filename, 'utf8');
    const payload = html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/);
    if (payload) html = gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64')).toString('utf8');
    for (const copy of rejected) assert.ok(!html.includes(copy), `${file}: remove internal-facing help copy: ${copy}`);
  }
});

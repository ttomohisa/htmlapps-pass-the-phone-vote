'use strict';
// Full end-to-end voting smoke against the official generated HTML and checked-in root copy.
// Runs in the unprivileged PR build job; no site or user data is sent to a server.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function runCase(browser, file, language, width) {
  const height = width <= 390 ? 740 : 900;
  const context = await browser.newContext({
    viewport: { width, height }, locale: language, reducedMotion: 'reduce', acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [], requests = [];
  const label = `${file} ${language} ${width}px`;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', file)).href);
    await page.locator('#questionInput').waitFor();
    if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
    assert.equal(await page.locator('.page-intro').isVisible(), true, label + ': setup hero');
    const plus = await page.locator('#increaseParticipants').evaluate(el => ({
      border: getComputedStyle(el).borderTopWidth,
      background: getComputedStyle(el).backgroundColor,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }));
    assert.equal(plus.border, '0px', label + ': borderless plus control');
    assert.equal(plus.background, 'rgba(0, 0, 0, 0)', label + ': transparent plus control');
    assert.ok(plus.width >= 44 && plus.height >= 44, label + ': participant touch target');
    assert.equal(await page.locator('[data-i18n="setupEyebrow"]').count(), 0, label + ': removed setup eyebrow');
    assert.equal(await page.locator('#choiceListDetails').evaluate(el => getComputedStyle(el).borderTopWidth), '0px', label + ': borderless paste list');
    const presetWidths = await page.locator('.preset-button').evaluateAll(buttons => buttons.map(el => el.getBoundingClientRect().width));
    assert.ok(Math.max(...presetWidths) - Math.min(...presetWidths) < 1, label + ': equal preset widths');
    assert.equal(await page.locator('#choiceListDetails summary svg').count(), 1, label + ': clipboard icon');
    assert.equal(await page.locator('#questionInput').evaluate(el => el.tagName), 'TEXTAREA');
    assert.equal(await page.locator('.option-input').first().evaluate(el => el.tagName), 'TEXTAREA');
    if (language === 'ja' && width === 320 && file === 'dist/index.html') {
      await page.locator('#questionInput').fill('長い質問'.repeat(35));
      await page.locator('.option-input').first().fill('長い選択肢'.repeat(10));
      assert.ok(await page.locator('#questionInput').evaluate(el => el.clientHeight >= 72));
      assert.ok(await page.locator('.option-input').first().evaluate(el => el.scrollHeight <= el.clientHeight + 2));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': long input fits');
    }
    if (language === 'ja' && width === 1440 && file === 'dist/index.html') {
      // A tablet/phone rotation changes wrapping width without a new input event.
      await page.locator('#questionInput').fill('長い質問'.repeat(35));
      await page.locator('.option-input').first().fill('長い選択肢'.repeat(10));
      await page.setViewportSize({ width: 320, height: 568 });
      // Chromium delivers the resize event asynchronously; wait for textareas to reflow.
      await page.waitForFunction(() => {
        const fits = el => el.scrollHeight <= el.clientHeight + 2 || el.clientHeight >= 316;
        return fits(document.querySelector('#questionInput')) && fits(document.querySelector('.option-input'));
      }, null, { timeout: 3000 });
      const questionDims = await page.locator('#questionInput').evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight }));
      const optionDims = await page.locator('.option-input').first().evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight }));
      assert.ok(questionDims.scroll <= questionDims.client + 2 || questionDims.client >= 316, label + ': resize adjusts question textarea height ' + JSON.stringify(questionDims));
      assert.ok(optionDims.scroll <= optionDims.client + 2 || optionDims.client >= 316, label + ': resize adjusts choice textarea height ' + JSON.stringify(optionDims));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': resized setup has no horizontal overflow');
      await page.setViewportSize({ width, height });
    }
    if (language === 'ja' && width === 320) {
      const heroLines = await page.locator('#heroTitle').evaluate(el => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
      assert.ok(heroLines < 1.2, label + ': Japanese hero has no orphan last character');
      const presetHeight = await page.locator('#presetYesNo').evaluate(el => el.getBoundingClientRect().height);
      assert.ok(presetHeight <= 48, label + ': Yes/No shortcut stays on one line');
    }
    if (width <= 390) {
      await page.locator('#helpButton').click();
      const close = await page.locator('#closeHelpButton').boundingBox();
      assert.ok(close && close.width >= 44 && close.height >= 44, label + ': help close touch target');
      await page.locator('#closeHelpButton').click();
    }

    await page.locator('#presetYesNo').click();
    await page.locator('#questionInput').fill(language === 'ja' ? '今日の昼食は？' : 'What should we eat?');
    await page.locator('#participantCount').fill('101');
    await page.locator('#startVoteButton').click();
    assert.equal(await page.locator('#appConfirmDialog').evaluate(el => el.open), false, label + ': invalid count rejected');
    assert.equal(await page.locator('#participantCount').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#participantCount').inputValue(), '101', label + ': no silent clamping');
    await page.locator('#participantCount').fill('2');
    await page.locator('#startVoteButton').click();
    assert.equal(await page.locator('#appConfirmDialog').evaluate(el => el.open), true, label + ': start confirmation');
    await page.locator('#appConfirmOk').click();
    assert.equal(await page.locator('#readyScreen').isVisible(), true, label + ': first ready screen');
    const readyMessageLines = await page.locator('[data-i18n="readyMessage"]').evaluate(el => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
    assert.ok(readyMessageLines < 1.2, label + ': ready hint stays one line');
    assert.equal(await page.locator('.page-intro').isVisible(), false, label + ': hero hidden after setup');

    await page.locator('#beginVoteButton').click();
    assert.equal(await page.locator('#voteScreen').isVisible(), true);
    assert.equal(await page.locator('#voteScreen .question-card').evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
    assert.equal(await page.locator('[data-i18n="votePrivacy"]').count(), 0);
    await page.locator('.vote-option').first().click();
    assert.equal(await page.locator('#confirmVoteScreen').isVisible(), true);
    assert.equal(await page.locator('#confirmVoteScreen .question-card').evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
    await page.locator('#confirmVoteButton').click();
    assert.equal(await page.locator('#handoffScreen').isVisible(), true);

    assert.equal(await page.locator('#nextVoterButton').innerText(), language === 'ja' ? '2人目が投票する' : 'Person 2: vote now');
    await page.locator('#nextVoterButton').click();
    assert.equal(await page.locator('#voteScreen').isVisible(), true, label + ': one-tap handoff opens ballot');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#privacyScreen').isVisible(), true, label + ': curtain during voting');
    await page.locator('#privacyResumeButton').click();
    assert.equal(await page.locator('#voteScreen').isVisible(), true);
    await page.locator('.vote-option').last().click();
    await page.locator('#confirmVoteButton').click();
    assert.equal(await page.locator('#revealScreen').isVisible(), true);

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#revealScreen').isVisible(), true, label + ': no curtain after voting');
    const reveal = page.locator('#revealButton');
    if (file === 'dist/index.html' && width === 320) {
      await reveal.hover(); await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.up();
      assert.equal(await page.locator('#revealScreen').isVisible(), true, label + ': short hold does not reveal');
      await reveal.hover(); await page.mouse.down(); await page.waitForTimeout(1400); await page.mouse.up();
    } else {
      await page.locator('#alternateRevealButton').click();
      await page.locator('#appConfirmOk').click();
    }
    assert.equal(await page.locator('#resultScreen').isVisible(), true, label + ': results visible');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#resultScreen').isVisible(), true, label + ': no curtain on results');
    assert.equal(await page.locator('#totalVotesValue').innerText(), '2', label + ': exactly two votes');
    assert.equal(await page.locator('#resultExportDetails summary').isVisible(), true, label + ': optional export disclosure visible');
    assert.equal(await page.locator('#resultExportDetails').getAttribute('open'), null, label + ': export initially collapsed');
    assert.equal(await page.locator('#saveResultButton').isVisible(), false, label + ': save controls hidden by default');
    await page.locator('#resultExportDetails summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#resultExportDetails').getAttribute('open'), '', label + ': keyboard Enter opens export');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#resultExportDetails').getAttribute('open'), null, label + ': keyboard Space closes export');
    await page.locator('#resultExportDetails summary').click();
    assert.equal(await page.locator('#saveResultButton').isVisible(), true, label + ': save controls visible after expanding');
    assert.equal(await page.locator('#outputFilename').inputValue(), language === 'ja' ? '投票結果' : 'vote-results');
    assert.equal(await page.locator('.filename-extension').innerText(), '.txt');
    assert.equal(await page.locator('#saveResultButton svg').count(), 1, label + ': save icon');
    assert.equal(await page.locator('#saveResultButton span').innerText(), language === 'ja' ? '結果を保存' : 'Save result');
    const filenameBox = await page.locator('#outputFilename').boundingBox();
    const saveBox = await page.locator('#saveResultButton').boundingBox();
    assert.ok(filenameBox && saveBox && Math.abs(filenameBox.y - saveBox.y) <= 2 && filenameBox.x + filenameBox.width <= saveBox.x + 2, label + ': filename and save button share a row');
    const repeatBox = await page.locator('#repeatVoteButton').boundingBox();
    const newVoteBox = await page.locator('#newVoteButton').boundingBox();
    const copyBox = await page.locator('#copyResultButton').boundingBox();
    assert.ok(repeatBox && newVoteBox && copyBox && Math.abs(repeatBox.y - newVoteBox.y) < 1, label + ': primary actions share a row');
    assert.ok(copyBox.y + copyBox.height <= repeatBox.y + 1, label + ': copy/share above repeat controls');
    assert.ok(Math.abs(repeatBox.width - newVoteBox.width) < 1, label + ': primary action widths match');
    if (language === 'ja' && width === 320) {
      const lineCount = await page.locator('#newVoteButton span').evaluate(el => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
      assert.ok(lineCount < 1.2, label + ': Change setup label has no orphan last character');
    }

    if (file === 'dist/index.html') {
      const results = path.resolve(__dirname, '..', 'test-results', 'voting-ui');
      fs.mkdirSync(results, { recursive: true });
      await page.screenshot({ path: path.join(results, `result-${language}-${width}.png`), fullPage: true });
    }
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#saveResultButton').click()]);
    assert.equal(download.suggestedFilename(), language === 'ja' ? '投票結果.txt' : 'vote-results.txt', label + ': localized default filename');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': no horizontal overflow');
    await page.locator('#newVoteButton').click(); await page.locator('#appConfirmOk').click();
    assert.equal(await page.locator('#setupScreen').isVisible(), true);
    assert.equal(await page.locator('.page-intro').isVisible(), true, label + ': hero restored on new vote');
    assert.deepEqual(errors, [], label + ': no browser errors');
    assert.deepEqual(requests, [], label + ': no HTTP requests');
    console.log('PASS ' + label);
  } catch (error) {
    const dir = path.resolve(__dirname, '..', 'test-results', 'voting-ui');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `failure-${file.replace(/[^a-z0-9]/gi, '-')}-${language}-${width}.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
async function runStressCase(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, locale: 'ja', reducedMotion: 'reduce', acceptDownloads: true,
  });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'dist/index.html')).href);
    await page.locator('#presetCustom').click();
    await page.locator('#questionInput').fill('質問'.repeat(100));
    for (let i = 0; i < 10; i++) {
      if (i >= 3) await page.locator('#addOptionButton').click();
      await page.locator('.option-input').nth(i).fill('候補' + (i + 1) + '長'.repeat(73));
    }
    await page.locator('#participantCount').fill('3');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '10 long choices: setup does not overflow');

    await page.locator('#startVoteButton').click();
    assert.equal(await page.locator('#appConfirmDialog').evaluate(el => el.open), true, 'long start confirmation opens');
    await page.locator('#appConfirmOk').scrollIntoViewIfNeeded();
    const ok = await page.locator('#appConfirmOk').boundingBox();
    assert.ok(ok && ok.y >= 0 && ok.y + ok.height <= 568, 'long confirmation remains actionable at 320x568');
    await page.setViewportSize({ width: 393, height: 252 });
    await page.locator('#appConfirmOk').scrollIntoViewIfNeeded();
    const narrow = await page.locator('#appConfirmOk').boundingBox();
    assert.ok(narrow && narrow.y >= -1 && narrow.y + narrow.height <= 253, 'long confirmation controls reachable at 393x252');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'short confirm dialog has no overflow');
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('#appConfirmOk').click();

    for (let voter = 0; voter < 3; voter++) {
      if (voter === 0) await page.locator('#beginVoteButton').click();
      else await page.locator('#nextVoterButton').click();
      assert.equal(await page.locator('#voteScreen').isVisible(), true);
      await page.locator('.vote-option').nth(voter === 0 ? 9 : voter).click();
      await page.locator('#confirmVoteButton').click();
    }
    assert.equal(await page.locator('#revealScreen').isVisible(), true);
    await page.locator('#alternateRevealButton').click();
    await page.locator('#appConfirmOk').click();
    assert.equal(await page.locator('#resultList .result-item').count(), 10, 'all long results retained');
    assert.equal(await page.locator('#totalVotesValue').innerText(), '3');
    assert.equal(await page.locator('#resultExportDetails').getAttribute('open'), null, 'optional save initially collapsed');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'long result labels do not overflow');

    await page.locator('#resultExportDetails summary').click();
    const saveBox = await page.locator('#saveResultButton').boundingBox();
    const nameBox = await page.locator('#outputFilename').boundingBox();
    assert.ok(saveBox && nameBox && nameBox.x + nameBox.width <= saveBox.x + 2, 'expanded export stays inline');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'expanded export does not overflow');
    await page.locator('#languageButton').click();
    assert.equal(await page.locator('#totalVotesValue').innerText(), '3', 'language switch preserves totals');
    assert.equal(await page.locator('#resultExportDetails').getAttribute('open'), '', 'language switch preserves open disclosure');
    assert.deepEqual(errors, [], 'long-text stress has no JavaScript errors');
    assert.deepEqual(requests, [], 'long-text stress sends no network requests');
    console.log('PASS 10 long choices, 200-character question, 320x568, three votes, and result export');
  } finally { await context.close(); }
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'pass-the-phone-vote.html']) {
      for (const language of ['ja', 'en']) {
        for (const width of [320, 1440]) await runCase(browser, file, language, width);
      }
    }
    await runStressCase(browser);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

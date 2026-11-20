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

    await page.locator('#nextVoterButton').click();
    await page.locator('#beginVoteButton').click();
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
    assert.equal(await page.locator('#resultExportDetails').isVisible(), true, label + ': save controls always available');
    assert.equal(await page.locator('#saveResultButton svg').count(), 1, label + ': save icon');
    assert.equal(await page.locator('#saveResultButton span').innerText(), language === 'ja' ? '結果を保存' : 'Save result');
    const filenameBox = await page.locator('#outputFilename').boundingBox();
    const saveBox = await page.locator('#saveResultButton').boundingBox();
    assert.ok(filenameBox && saveBox && Math.abs(filenameBox.y - saveBox.y) <= 2 && filenameBox.x + filenameBox.width <= saveBox.x + 2, label + ': filename and save button share a row');
    const repeatBox = await page.locator('#repeatVoteButton').boundingBox();
    const newVoteBox = await page.locator('#newVoteButton').boundingBox();
    const copyBox = await page.locator('#copyResultButton').boundingBox();
    assert.ok(repeatBox && newVoteBox && copyBox && Math.abs(repeatBox.y - newVoteBox.y) < 1, label + ': primary actions share a row');
    assert.ok(copyBox.y >= repeatBox.y + repeatBox.height - 1, label + ': copy utility below primary actions');
    assert.ok(Math.abs(repeatBox.width - newVoteBox.width) < 1, label + ': primary action widths match');

    if (file === 'dist/index.html') {
      const results = path.resolve(__dirname, '..', 'test-results', 'voting-ui');
      fs.mkdirSync(results, { recursive: true });
      await page.screenshot({ path: path.join(results, `result-${language}-${width}.png`), fullPage: true });
    }
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#saveResultButton').click()]);
    assert.match(download.suggestedFilename(), /\.txt$/i, label + ': exported text');
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
async function main() {
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'pass-the-phone-vote.html']) {
      for (const language of ['ja', 'en']) {
        for (const width of [320, 1440]) await runCase(browser, file, language, width);
      }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

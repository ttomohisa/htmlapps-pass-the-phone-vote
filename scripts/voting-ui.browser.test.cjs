'use strict';
// Runs against generated HTML, not src/index.template.html.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const evidence = path.join(root, 'test-results', 'voting-ui');
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch();
  const widths = [[320, 700], [390, 844], [768, 880], [1440, 900]];
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'pass-the-phone-vote.html']) {
      for (const language of ['ja', 'en']) {
        for (const [width, height] of widths) {
          const key = `${path.basename(file)}-${language}-${width}`;
          const context = await browser.newContext({
            viewport: { width, height }, locale: language, acceptDownloads: true,
            reducedMotion: 'reduce'
          });
          const page = await context.newPage();
          const errors = [], external = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()); });
          page.on('request', req => { if (/^https?:/.test(req.url())) external.push(req.url()); });
          const checkWidth = async phase => {
            const stats = await page.evaluate(() => ({
              doc: document.documentElement.scrollWidth, body: document.body.scrollWidth,
              viewport: innerWidth
            }));
            assert.ok(stats.doc <= stats.viewport + 1 && stats.body <= stats.viewport + 1,
              `${key}: horizontal overflow in ${phase}: ${JSON.stringify(stats)}`);
          };
          try {
            await page.goto(pathToFileURL(path.join(root, file)).href);
            await page.locator('#startVoteButton').waitFor();
            if (await page.locator('html').getAttribute('lang') !== language) {
              await page.locator('#languageButton').click();
            }
            assert.ok(await page.locator('.page-intro').isVisible(), key + ': intro on setup');
            assert.ok(await page.locator('#setupScreen').isVisible(), key + ': setup is active');
            await checkWidth('setup');
            if (file === 'dist/index.html') {
              await page.screenshot({ path: path.join(evidence, `setup-${language}-${width}.png`), fullPage: true });
            }

            await page.locator('#helpButton').click();
            assert.ok(await page.locator('#helpDialog').isVisible(), key + ': Help opens');
            assert.match(await page.locator('#helpDialog').innerText(), /MIT License/);
            await page.locator('#helpDialog .dialog-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
            await checkWidth('help');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#helpDialog').isVisible(), false, key + ': Help closes');
            await page.locator('#presetYesNo').click();
            await page.locator('#questionInput').fill(language === 'ja' ? '明日は公園に行く？' : 'Visit the park tomorrow?');
            await page.locator('#participantCount').fill('2');
            await page.locator('#startVoteButton').click();
            assert.ok(await page.locator('#appConfirmDialog').isVisible(), key + ': start confirms');
            await page.locator('#appConfirmOk').click();
            await page.locator('#readyScreen').waitFor({ state: 'visible' });
            assert.equal(await page.locator('.page-intro').isVisible(), false, key + ': intro hidden during voting');

            for (let index = 0; index < 2; index += 1) {
              if (index) {
                await page.locator('#nextVoterButton').click();
                await page.locator('#readyScreen').waitFor({ state: 'visible' });
              }
              await page.locator('#beginVoteButton').click();
              await page.locator('#voteScreen').waitFor({ state: 'visible' });
              const choices = page.locator('#voteOptions .vote-option');
              assert.equal(await choices.count(), 2, key + ': choices');
              const box = await choices.first().boundingBox();
              assert.ok(box && box.height >= 44, key + ': touch target');
              await choices.nth(index).click();
              await page.locator('#confirmVoteScreen').waitFor({ state: 'visible' });
              await page.locator('#confirmVoteButton').click();
              if (index === 0) {
                await page.locator('#handoffScreen').waitFor({ state: 'visible' });
                assert.equal(await page.locator('#confirmChoice').innerText(), '', key + ': private answer gone');
                await checkWidth('handoff');
              }
            }
            await page.locator('#revealScreen').waitFor({ state: 'visible' });
            await page.locator('#revealButton').focus();
            await page.keyboard.down('Space');
            await page.waitForTimeout(1500);
            await page.keyboard.up('Space');
            await page.locator('#resultScreen').waitFor({ state: 'visible' });
            assert.equal(await page.locator('#totalVotesValue').innerText(), '2', key + ': tally');
            const keep = await page.locator('.result-keep').boundingBox();
            const again = await page.locator('.result-again').boundingBox();
            assert.ok(keep && again && keep.y < again.y, key + ': preserve before restart');
            assert.ok(await page.locator('#saveResultButton').isEnabled(), key + ': save enabled');
            await checkWidth('result');
            if (file === 'dist/index.html') {
              await page.screenshot({ path: path.join(evidence, `result-${language}-${width}.png`), fullPage: true });
            }
            const [download] = await Promise.all([
              page.waitForEvent('download'), page.locator('#saveResultButton').click()
            ]);
            assert.match(download.suggestedFilename(), /\.txt$/i, key + ': extension');
            const downloaded = fs.readFileSync(await download.path(), 'utf8');
            assert.match(downloaded, /2/, key + ': downloaded tally');
            await page.locator('#repeatVoteButton').click();
            assert.ok(await page.locator('#appConfirmDialog').isVisible(), key + ': restart confirms');
            await page.locator('#appConfirmCancel').click();
            assert.ok(await page.locator('#resultScreen').isVisible(), key + ': cancel keeps results');
            assert.deepEqual(errors, [], key + ': browser errors');
            assert.deepEqual(external, [], key + ': remote requests');
            console.log('PASS ' + key + ': setup, Help, vote, handoff, reveal, result, save, cancel');
          } catch (error) {
            await page.screenshot({ path: path.join(evidence, `FAIL-${key}.png`), fullPage: true }).catch(() => {});
            throw error;
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

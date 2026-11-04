'use strict';
// Run against the official generated files in the unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const results = path.resolve(__dirname, '..', 'test-results', 'mobile-help');
  fs.mkdirSync(results, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'pass-the-phone-vote.html']) {
      for (const language of ['ja', 'en']) {
        for (const [width, height] of [[1360, 900], [681, 568], [680, 568], [360, 640], [320, 568], [393, 252]]) {
          const context = await browser.newContext({ viewport: { width, height }, locale: language, reducedMotion: 'reduce' });
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
          page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
          const label = `${file} ${language} ${width}x${height}`;
          try {
            await page.goto(pathToFileURL(path.resolve(__dirname, '..', file)).href);
            await page.locator('#helpButton').waitFor();
            if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
            assert.equal(await page.locator('[data-i18n="localBadge"]').innerText(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label);
            assert.ok(await page.locator('.local-badge').evaluate(el => {
              const box = el.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(el.querySelector('[data-i18n="localBadge"]'));
              return box.left >= 0 && box.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1
                && [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
            }), label + ': badge text fits');
            assert.equal(await page.locator('main .build-section').count(), 0, label);
            assert.equal(await page.locator('footer').isVisible(), width > 680, label);
            if (language === 'en') assert.match(await page.locator('footer').textContent(), /Fully local processing · Single HTML/);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');

            await page.locator('#helpButton').click();
            const body = page.locator('#helpDialog .dialog-body');
            assert.ok(await body.evaluate(el => el.lastElementChild.classList.contains('build-section')), label);
            assert.equal(await page.locator('.build-section').count(), 1, label);
            assert.equal(await page.locator('.build-section').isVisible(), width > 680, label);
            for (const id of ['buildVersion', 'builtAt', 'dependencyCount']) assert.equal(await page.locator('#' + id).count(), 1, label);

            if (width > 680) {
              const summary = page.locator('.build-section summary');
              await summary.focus();
              await page.keyboard.press('Enter');
              assert.equal(await page.locator('.build-section details').getAttribute('open'), '', label);
              assert.notEqual(await page.locator('#buildVersion').innerText(), '—', label);
              assert.notEqual(await page.locator('#builtAt').innerText(), '—', label);
            }
            await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
            const finalItem = page.locator(width > 680 ? '#dependencyCount' : '[data-i18n="helpOffline"]');
            const finalBox = await finalItem.boundingBox(), bodyBox = await body.boundingBox();
            assert.ok(finalBox && bodyBox && finalBox.y >= bodyBox.y - 1 && finalBox.y + finalBox.height <= bodyBox.y + bodyBox.height + 1, label + ': final Help item reachable');
            assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
            const headerBox = await page.locator('#helpDialog .dialog-header').boundingBox();
            assert.ok(headerBox && headerBox.y >= 0 && headerBox.y + headerBox.height <= height, label + ': header visible');
            if (file === 'dist/index.html' && [1360, 320].includes(width)) {
              await page.screenshot({ path: path.join(results, `help-${language}-${width}.png`) });
            }
            const beforeScroll = await page.evaluate(() => scrollY);
            await page.mouse.move(2, Math.floor(height / 2));
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': background locked');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape');
            await page.locator('#helpButton').click();
            await page.locator('#closeHelpButton').click();
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': reopen and Close');
            // Exercise the actual mobile result layout in Chromium, not just a CSS text contract.
            if (file === 'dist/index.html' && width <= 360 && height >= 568) {
              await page.locator('#questionInput').fill(language === 'ja' ? 'テスト投票' : 'Test vote');
              const inputs = page.locator('.option-input');
              for (let i = 0, count = await inputs.count(); i < count; i += 1) {
                await inputs.nth(i).fill(language === 'ja' ? '候補' + (i + 1) : 'Choice ' + (i + 1));
              }
              await page.locator('#participantCount').fill('2');
              await page.locator('#startVoteButton').click();
              await page.locator('#appConfirmOk').click();
              await page.locator('#beginVoteButton').click();
              await page.locator('#voteOptions .vote-option').first().click();
              await page.locator('#confirmVoteButton').click();
              await page.locator('#nextVoterButton').click();
              await page.locator('#voteOptions .vote-option').nth(1).click();
              await page.locator('#confirmVoteButton').click();
              assert.ok(await page.locator('#revealScreen').evaluate(el => el.classList.contains('active')), label + ': reveal screen');
              const reveal = page.locator('#revealButton');
              await reveal.scrollIntoViewIfNeeded();
              const rect = await reveal.boundingBox();
              assert.ok(rect, label + ': hold button visible');
              await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
              await page.mouse.down();
              await page.waitForTimeout(1350);
              await page.mouse.up();
              assert.ok(await page.locator('#resultScreen').evaluate(el => el.classList.contains('active')), label + ': hold reveals results');
              assert.equal(await page.locator('#resultSaveHeading').innerText(), language === 'ja' ? '結果を残す' : 'Keep the results', label);
              assert.equal(await page.locator('#resultNextHeading').innerText(), language === 'ja' ? '続けて投票する' : 'Vote again', label);
              assert.equal(await page.locator('#resultExportDetails').evaluate(el => el.open), false, label + ': file save is collapsed');
              assert.ok(await page.locator('.result-action-note').evaluate(el => {
                const parts = el.querySelectorAll('span');
                return parts.length === 2 && parts[1].getBoundingClientRect().top > parts[0].getBoundingClientRect().top;
              }), label + ': explanatory sentences have clean breaks');
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': results have no horizontal scroll');
              for (const id of ['copyResultButton', 'repeatVoteButton', 'newVoteButton', 'resultExportDetails']) {
                assert.ok(await page.locator('#' + id).evaluate(el => {
                  const box = el.getBoundingClientRect();
                  return box.left >= -1 && box.right <= innerWidth + 1;
                }), label + ': ' + id + ' fits phone width');
              }
              await page.screenshot({ path: path.join(results, `result-${language}-${width}.png`), fullPage: true });
            }
            assert.deepEqual(errors, [], label + ': console errors');
            assert.deepEqual(requests, [], label + ': external runtime requests');
            console.log('PASS ' + label);
          } catch (error) {
            await page.screenshot({ path: path.join(results, `failure-${file.replace(/[^a-z0-9]/gi, '-')}-${language}-${width}x${height}.png`) }).catch(() => {});
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

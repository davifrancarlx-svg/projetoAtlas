'use strict';
const { firefox, webkit } = require('playwright');
const axe = require('axe-core');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const reportDir = path.join(root, 'reports/compatibility');
const files = new Set(['atlas-195.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png']);
const server = http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (!files.has(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'application/manifest+json');
  res.end(fs.readFileSync(path.join(root, file)));
});
async function main() {
  fs.mkdirSync(reportDir, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/atlas-195.html`;
  const results = [];
  try {
    for (const [name, engine] of Object.entries({ firefox, webkit })) {
      const browser = await engine.launch();
      try {
        for (const width of [1280, 360]) {
          const context = await browser.newContext({ viewport: { width, height: width === 360 ? 640 : 900 },
            hasTouch: width === 360, ...(name === 'webkit' ? { isMobile: width === 360 } : {}),
            reducedMotion: 'reduce', locale: 'pt-BR' });
          try {
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(url);
            await page.waitForFunction(() => document.getElementById('questionTitle') && !document.getElementById('appShell').classList.contains('is-initializing'));
            await page.locator('.skip-link').focus();
            await page.keyboard.press('Enter');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
            const activate = async selector => {
              const locator = page.locator(selector).first();
              if (width === 360) await locator.tap(); else await locator.click();
            };
            if (!await page.locator('[data-mode=cap]').isVisible()) await activate('#filterToggle');
            await activate('[data-mode=cap]');
            if (width === 360 && await page.locator('#filterToggle').getAttribute('aria-expanded') === 'true') await activate('#filterToggle');
            await activate('[data-answer]');
            await page.locator('.verdict').waitFor();
            await activate('#nextQuestion');
            await activate('[data-view=atlas]');
            await page.locator('input[type=search]').fill('Portugal');
            await page.locator('[data-country=PT]').waitFor();
            await activate('[data-country=PT]');
            assert.equal(await page.locator('.atlas-detail h3').innerText(), 'Portugal');
            if (width === 360) {
              assert.equal(await page.locator('.atlas-results').evaluate(el => el.open), false);
              assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Portugal');
            }
            await page.evaluate(() => {
              let p = AtlasCore.resetProgress(JSON.parse(localStorage.getItem('atlas195:v2')));
              for (const [session, day, correct] of [['audit-old', 1, 2], ['audit-new', 2, 4]]) {
                for (let i = 0; i < 5; i++) p = AtlasCore.recordAnswer(p, 'BR', 'cap', i < correct, {
                  now: `2026-10-0${day}T12:00:00.000Z`,
                  learning: { device: 'audit-device', session, event: `${session}-${i}`, ms: 1000 },
                });
              }
              const envelope = AtlasCore.serializeProgress(p);
              localStorage.setItem('atlas195:v2', envelope);
              dispatchEvent(new StorageEvent('storage', { key: 'atlas195:v2', newValue: envelope }));
            });
            for (const theme of ['light', 'dark']) {
              for (let i = 0; i < 3 && await page.locator('html').getAttribute('data-theme') !== theme; i++) await activate('#themeToggle');
              assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
              for (const view of ['quiz', 'atlas', 'prog']) {
                await activate(`[data-view=${view}]`);
                if (view === 'prog') {
                  await page.locator('[data-progress-details=historyTitle] > summary').click();
                  await page.locator('.learning-trend').first().scrollIntoViewIfNeeded();
                  await page.waitForFunction(() => document.querySelector('.learning-trend')?.innerText.includes('40%'));
                  assert.match(await page.locator('.learning-trend').first().innerText(), /40% \(2\/5\) → 80% \(4\/5\)/);
                  if (width === 360) await page.locator('#evolutionTitle').locator('..').screenshot({ path: path.join(reportDir, `${name}-evolution-${theme}.png`) });
                  const summary = page.locator('.mastery-details summary');
                  assert.equal(await page.locator('.mastery-tile').count(), 0);
                  await summary.focus();
                  await page.keyboard.press('Enter');
                  await page.waitForFunction(() => document.querySelectorAll('.mastery-tile').length === 195);
                  await page.keyboard.press('Tab');
                  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('mastery-tile')), true);
                }
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}/${width}/${view}: transbordamento`);
                await page.evaluate(axe.source);
                const audit = await page.evaluate(async () => {
                  const { violations, incomplete } = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } });
                  const compact = items => items.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
                  return { violations: compact(violations), incomplete: compact(incomplete) };
                });
                results.push({ browser: name, version: browser.version(), width, theme, view, ...audit });
                console.log(`${name} ${width} ${theme} ${view}: ${audit.violations.length} violações, ${audit.incomplete.length} verificações manuais`);
              }
            }
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.activeElement !== document.body), true);
            assert.deepEqual(errors, [], `${name}/${width}: erros de execução`);
            await page.screenshot({ path: path.join(reportDir, `${name}-${width}.png`) });
          } finally { await context.close(); }
        }
      } finally { await browser.close(); }
    }
    assert.equal(results.flatMap(item => item.violations).length, 0, 'Confira as violações em reports/compatibility/results.json');
  } finally {
    fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify(results, null, 2));
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

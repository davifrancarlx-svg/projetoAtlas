'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');
const root = path.join(__dirname, '..');
const countries = require('../src/countries.base.json');
const server = http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (!['atlas-195.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','icon-maskable-512.png'].includes(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'application/manifest+json');
  res.end(fs.readFileSync(path.join(root, file)));
});
async function main() {
  let progress = Core.createProgress();
  for (let i = 0; i < 1000; i++) {
    progress = Core.recordAnswer(progress, countries[i % 195].id, 'cap', false, {
      now: new Date(Date.UTC(2026, 8, 1) + i * 1000).toISOString(),
      learning: { device: 'bench-device', session: 'bench-session-' + Math.floor(i / 5), event: 'bench-event-' + i,
        ms: 1000, chosen: countries[(i + 1) % 195].id, reason: 'other' },
    });
  }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' });
    await page.addInitScript(envelope => {
      localStorage.setItem('atlas195:v2', envelope);
      localStorage.setItem('atlas195:prefs:v2', JSON.stringify({ mode: 'cap', region: 'Mundo inteiro', includeVisual: false }));
    }, Core.serializeProgress(progress));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const start = Date.now();
    await page.goto(`http://127.0.0.1:${server.address().port}/atlas-195.html`);
    await page.waitForFunction(() => document.querySelector('[data-answer]') && !document.getElementById('appShell').classList.contains('is-initializing'));
    const readyMs = Date.now() - start;
    const heapReady = await cdp.send('Runtime.getHeapUsage');
    const timings = [];
    for (let i = 0; i < 5; i++) {
      timings.push(await page.evaluate(() => {
        const start = performance.now();
        document.querySelector('[data-view=prog]').click();
        return { ms: performance.now() - start, nodes: document.querySelectorAll('#panel *').length,
          tiles: document.querySelectorAll('.mastery-tile').length, pairs: document.querySelectorAll('[data-practice-pair]').length };
      }));
      await page.locator('[data-view=quiz]').click();
    }
    assert.ok(timings.every(row => row.tiles === 0 && row.pairs === 0));
    await page.locator('[data-view=prog]').click();
    const summary = page.locator('.mastery-details summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.mastery-tile').length === 195);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('mastery-tile')), true);
    const expanded = await page.evaluate(() => ({ nodes: document.querySelectorAll('#panel *').length, tiles: document.querySelectorAll('.mastery-tile').length }));
    await page.keyboard.press('Enter');
    await page.locator('.atlas-detail h3').waitFor();
    assert.equal(await page.evaluate(() => document.body.dataset.view), 'atlas');
    await page.locator('[data-show-country-map]').click();
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const map = await page.locator('#map').boundingBox();
    const point = { x: map.x + map.width / 2, y: map.y + map.height / 2 };
    await page.evaluate(() => {
      window.benchFrames = [];
      window.benchCollecting = true;
      let previous = performance.now();
      const collect = now => {
        window.benchFrames.push(now - previous); previous = now;
        if (window.benchCollecting) requestAnimationFrame(collect);
      };
      requestAnimationFrame(collect);
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let i = 0; i < 30; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + i, y: point.y + i / 2 }] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const frameMs = await page.evaluate(() => { window.benchCollecting = false; return window.benchFrames; });
    const heapAfter = await cdp.send('Runtime.getHeapUsage');
    const report = { browser: browser.version(), viewport: '360×640', cpuSlowdown: 4,
      fixture: { answers: 1000, sessions: 200, confusions: 1000 }, readyMs, timings, expanded,
      heapBytes: { ready: heapReady.usedSize, afterInteractions: heapAfter.usedSize }, mapDragFrameMs: frameMs,
      note: 'Medições locais de laboratório; CPU reduzida não representa um aparelho físico específico. Tempos de renderização síncrona não são INP.' };
    fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reports/performance.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

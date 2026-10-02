'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const folder = path.join(root, 'reports/guidance');
const server = http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (!['atlas-195.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','icon-maskable-512.png'].includes(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'application/manifest+json');
  res.end(fs.readFileSync(path.join(root, file)));
});
async function main() {
  fs.mkdirSync(folder, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
    for (const width of [360, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        await page.addInitScript(() => localStorage.setItem('atlas195:prefs:v2', JSON.stringify({ mode: 'cap', region: 'Mundo inteiro', includeVisual: false })));
        await page.goto(`http://127.0.0.1:${server.address().port}/atlas-195.html`);
        await page.waitForFunction(() => document.querySelector('[data-answer]') && !document.getElementById('appShell').classList.contains('is-initializing'));
        await page.locator('[data-view=prog]').click();
        assert.equal(await page.locator('#recommendedTraining').getAttribute('data-recommendation'), 'fresh');
        await page.locator('#progressTitle').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(folder, `progress-${width}.png`) });
        await page.locator('#recommendedTraining').click();
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('atlas195:serie:v1')).kind), 'fresh');
        const answer = await page.evaluate(() => {
          const title = document.getElementById('questionTitle').textContent;
          const country = DATA.find(c => title.includes(c.n + '?') || title.startsWith(c.cap + ' é '));
          if (!country) throw new Error('Alvo não identificado: ' + title);
          return [...document.querySelectorAll('[data-answer]')].find(b => b.dataset.answer !== country.id).dataset.answer;
        });
        await page.locator(`[data-answer="${answer}"]`).click();
        await page.locator('.note-confusion').waitFor();
        assert.match(await page.locator('.note-confusion').first().innerText(), /Associe os dois pares/);
        assert.ok(await page.locator('.capital-difference').count() > 0);
        await page.locator('.answer-comparison').screenshot({ path: path.join(folder, `capital-${width}.png`) });
        await page.locator('[data-view=atlas]').click();
        await page.locator('input[type=search]').fill('Nova Zelândia');
        await page.locator('[data-country=NZ]').click();
        await page.locator('.editorial-sources > summary').click();
        assert.ok(await page.locator('.editorial-sources a').count() >= 3);
        assert.match(await page.locator('.editorial-sources').innerText(), /Inglês: estatuto oficial/);
        await page.locator('.editorial-sources').screenshot({ path: path.join(folder, `sources-${width}.png`) });
        await page.locator('input[type=search]').fill('Argentina');
        await page.locator('[data-country=AR]').click();
        await page.locator('.editorial-sources > summary').click();
        assert.match(await page.locator('.editorial-sources').innerText(), /Arquivo histórico; não confirma mudanças posteriores/);
        await page.locator('.editorial-sources').screenshot({ path: path.join(folder, `archive-${width}.png`) });
        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Exportar ficha (.txt)', exact: true }).click();
        const download = await downloaded;
        assert.equal(download.suggestedFilename(), 'atlas-195-AR.txt');
        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const exported = Buffer.concat(chunks).toString('utf8');
        assert.match(exported, /Idiomas: espanhol/);
        assert.match(exported, /consulta: 2026-10-02/);
        assert.match(exported, /Arquivo histórico; não confirma mudanças posteriores/);
        assert.doesNotMatch(exported, /Idiomas oficiais:/);
        console.log(`${width}px: recomendação, erro de capital, fontes e aviso histórico na ficha e exportação aprovados.`);
      } finally { await context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

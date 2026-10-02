'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async (client, evaluate, until) => {
  const ev = code => evaluate(client, code);
  await ev(`(() => {
    history.replaceState(null, '', location.pathname);
    localStorage.removeItem('atlas195:serie:v1');
    localStorage.setItem('atlas195:prefs:v2', JSON.stringify({mode:'cap',region:'Mundo inteiro',includeVisual:false}));
    let p = AtlasCore.resetProgress(JSON.parse(localStorage.getItem('atlas195:v2')) || AtlasCore.createProgress());
    DATA.slice(0,16).forEach(c => { p = AtlasCore.recordAnswer(p,c.id,'cap',false,{now:'2026-09-01T12:00:00.000Z'}); });
    localStorage.setItem('atlas195:v2', AtlasCore.serializeProgress(p));
    window.dispatchEvent(new StorageEvent('storage', { key:'atlas195:v2',newValue:AtlasCore.serializeProgress(p) }));
  })()`);
  await client.send('Page.reload');
  await until('nova versão pronta', () => ev("Boolean(document.querySelector('[data-answer]'))"));
  await ev("document.querySelector('[data-view=prog]').click()");
  assert.equal(await ev("document.getElementById('recommendedTraining').dataset.recommendation"), 'due');
  assert.equal(await ev("document.querySelector('[data-progress-details=reviewTitle]').open"), false);
  assert.ok(await ev("document.getElementById('panel').textContent.includes('Atalhos de teclado')"));
  assert.ok(await ev("document.getElementById('panel').textContent.includes('ainda não estudados')"));
  assert.equal(await ev("document.getElementById('reviewTitle').parentElement.querySelectorAll('.chip').length"), 16);
  assert.equal(await ev("document.getElementById('reviewTitle').parentElement.querySelector('details').open"), false);
  await ev("document.getElementById('reviewTitle').parentElement.querySelector('summary').click()");
  assert.equal(await ev("document.getElementById('reviewTitle').parentElement.querySelector('details').open"), true);
  await ev("document.getElementById('freshTraining').click()");
  const cards = JSON.parse(await ev("JSON.stringify(JSON.parse(localStorage.getItem('atlas195:serie:v1')).cards)"));
  assert.equal(cards.length, 30);
  assert.ok(await ev(`JSON.parse(localStorage.getItem('atlas195:serie:v1')).cards.every(c => !AtlasCore.skillOf(JSON.parse(localStorage.getItem('atlas195:v2')),c.id,c.direction).attempts)`));
  await ev(`(() => {
    window.originalNow = Date.now; let offset = 1000; Date.now = () => originalNow() + offset;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'));
    offset += 60000;
    delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));
    offset += 2000;
    const id = JSON.parse(localStorage.getItem('atlas195:serie:v1')).cards[0].id;
    [...document.querySelectorAll('[data-answer]')].find(b => b.dataset.answer !== id).click();
    Date.now = originalNow;
  })()`);
  await until('histórico gravado', () => ev("Object.keys(JSON.parse(localStorage.getItem('atlas195:v2')).learning.errors).length===1"));
  const ms = await ev("AtlasCore.Learning.summary(JSON.parse(localStorage.getItem('atlas195:v2')).learning).ms");
  assert.ok(ms >= 3000 && ms < 10000, `Tempo oculto não deve contar: ${ms}`);
  await client.send('Page.reload');
  await until('retomada de novidades', () => ev("[...document.querySelectorAll('button')].some(b=>b.textContent==='Retomar')"));
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Retomar').click()");
  assert.match(await ev("document.querySelector('.plate').textContent"), /Novidades/);
  assert.equal(await ev("JSON.parse(localStorage.getItem('atlas195:serie:v1')).done"), 1);
  // Descarta a série com uma troca de modo, o mesmo fluxo público dos demais treinos.
  await ev("document.querySelector('[data-mode=reg]').click();document.querySelector('[data-view=prog]').click()");
  await ev("document.querySelector('.learning-confusions summary').click()");
  await until('confusões expandidas', () => ev("Boolean(document.querySelector('[data-compare-pair]'))"));
  assert.ok(await ev("document.getElementById('historyTitle').parentElement.textContent.includes('1×')"));
  await ev("document.querySelector('[data-compare-pair]').click()");
  assert.equal(await ev("document.querySelector('.atlas-comparison').open"), true);
  assert.ok(await ev("document.getElementById('compareCountry').value.length===2"));
  await ev("document.querySelector('[data-view=prog]').click();document.querySelector('.learning-confusions summary').click()");
  await until('treino do par disponível', () => ev("Boolean(document.querySelector('[data-practice-pair]'))"));
  await ev("document.querySelector('[data-practice-pair]').click()");
  const pair = JSON.parse(await ev("JSON.stringify(JSON.parse(localStorage.getItem('atlas195:serie:v1')).cards)"));
  assert.equal(pair.length, 6);
  assert.equal(await ev("JSON.parse(localStorage.getItem('atlas195:serie:v1')).kind"), 'pair');
  assert.equal(new Set(pair.map(c=>c.id)).size, 2);
  for (let i=0;i<6;i++) {
    assert.ok(await ev(`Boolean(document.querySelector('[data-answer="${pair[i].opponent}"]'))`));
    await ev(`document.querySelector('[data-answer="${pair[i].id}"]').click()`);
    if(i===0) {
      await client.send('Page.reload');
      await until('retomada do par', () => ev("Boolean(document.getElementById('resumeExam'))"));
      await ev("document.getElementById('resumeExam').click()");
      assert.equal(await ev("JSON.parse(localStorage.getItem('atlas195:serie:v1')).done"), 1);
    } else await ev("document.getElementById('nextQuestion').click()");
  }
  assert.ok(await ev("document.getElementById('panel').textContent.includes('Treino do par concluído')"));
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Treinar este par novamente').click()");
  assert.equal(await ev("JSON.parse(localStorage.getItem('atlas195:serie:v1')).done"), 0);
  await ev("document.querySelector('[data-mode=cap]').click()");
  await ev("location.hash='pais=BR'");
  await until('link Brasil', () => ev("document.querySelector('.atlas-detail h3')?.textContent==='Brasil'"));
  await client.send('Page.reload');
  await until('ficha retomada pelo link', () => ev("document.querySelector('.atlas-detail h3')?.textContent==='Brasil'"));
  assert.equal(await ev("document.querySelectorAll('.indicator-sources:not(.editorial-sources) a').length"), 6);
  assert.equal(await ev("document.querySelectorAll('.editorial-sources a').length"), 3);
  await ev("document.querySelector('.indicator-sources summary').click()");
  assert.ok(await ev("document.querySelector('.indicator-sources').textContent.includes('consulta: '+INDICATOR_META.gerado)"));
  assert.ok(await ev("[...document.querySelectorAll('.indicator-sources a')].every(a=>a.target==='_blank'&&a.rel.includes('noreferrer')&&a.href.startsWith('https://'))"));
  await ev("document.getElementById('atlasOrder').value='population';document.getElementById('atlasOrder').dispatchEvent(new Event('change'))");
  assert.equal(await ev("document.querySelector('[data-country]').dataset.country"),
    await ev("DATA.filter(c=>Number.isFinite(c.pop)).sort((a,b)=>b.pop-a.pop)[0].id"));
  await ev("document.querySelector('[data-area=Europa]').click();document.querySelector('[data-area=\"Europa Meridional\"]').click()");
  const filtered = await ev("new Set([...document.querySelectorAll('.cty.filtered')].map(n=>n.dataset.id)).size");
  assert.equal(filtered, await ev("DATA.filter(c=>c.sr==='Europa Meridional').length"));
  await client.send('Emulation.setEmulatedMedia', {features:[{name:'forced-colors',value:'active'}]});
  assert.notEqual(await ev("getComputedStyle(document.querySelector('.cty.filtered')).strokeDasharray"),'none');
  await client.send('Emulation.setEmulatedMedia', {features:[]});
  assert.ok(await ev("document.getElementById('map').viewBox.baseVal.width < MAP_META.viewBox.w"));
  await ev("document.querySelector('[data-area=\"Europa Meridional\"]').click()");
  assert.equal(await ev("document.querySelectorAll('.cty.filtered').length"), 0);
  await ev(`(() => {
    let p = AtlasCore.resetProgress(JSON.parse(localStorage.getItem('atlas195:v2')) || AtlasCore.createProgress());
    for (const [session, day, correct] of [['history-old', 1, 2], ['history-new', 2, 4]]) {
      for (let i=0;i<5;i++) p=AtlasCore.recordAnswer(p,'BR','cap',i<correct,{
        now:'2026-10-0'+day+'T12:00:00.000Z',
        learning:{device:'history-device',session,event:session+'-'+i,ms:1000}
      });
    }
    localStorage.setItem('atlas195:v2',AtlasCore.serializeProgress(p));
    window.dispatchEvent(new StorageEvent('storage',{key:'atlas195:v2',newValue:AtlasCore.serializeProgress(p)}));
    document.querySelector('[data-view=prog]').click();
  })()`);
  assert.match(await ev("document.querySelector('.learning-trend').textContent"), /40% \(2\/5\) → 80% \(4\/5\)/);
  assert.match(await ev("document.querySelector('.learning-trend').textContent"), /\+40,0 pontos percentuais/);
  await ev("document.querySelector('[data-view=atlas]').click()");
  await ev("[...document.querySelectorAll('.atlas-detail .idiomas button')].find(b=>b.textContent==='português').click()");
  assert.ok(await ev("document.querySelectorAll('.cty.filtered').length > 1"));
  await ev("document.querySelector('.atlas-facet').click();document.querySelector('.atlas-comparison summary').click();document.getElementById('compareCountry').value='PT';document.getElementById('compareCountry').dispatchEvent(new Event('change'))");
  assert.match(await ev("document.querySelector('.comparison-result').textContent"), /Brasil e Portugal/);
  assert.match(await ev("document.querySelector('.comparison-result').textContent"), /População/);
  // Exporta o arquivo real para um diretório temporário sob controle do teste.
  const output = path.join(require('node:os').tmpdir(), 'atlas-feature-downloads-' + Date.now());
  fs.mkdirSync(output, { recursive: true });
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
  await ev("[...document.querySelectorAll('.ficha-actions button')].find(b=>b.textContent==='Exportar ficha (.txt)').click()");
  await until('ficha baixada', () => fs.existsSync(path.join(output,'atlas-195-BR.txt')));
  const exported = fs.readFileSync(path.join(output,'atlas-195-BR.txt'),'utf8');
  assert.match(exported, /Capital: Brasília/); assert.match(exported, /Fontes dos indicadores:/);
  assert.match(exported, /https:\/\/data.worldbank.org\/indicator\/SP.POP.TOTL/);
  fs.unlinkSync(path.join(output,'atlas-195-BR.txt')); fs.rmdirSync(output);
  await client.send('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(await ev("getComputedStyle(document.querySelector('.stage')).display"), 'block');
  assert.equal(await ev("getComputedStyle(document.querySelector('.map-region')).display"), 'none');
  assert.ok(await ev("document.querySelector('.atlas-detail').getBoundingClientRect().height>100"));
  await client.send('Emulation.setEmulatedMedia', { media: '' });
  const screenshots = path.join(__dirname, '..', 'docs', 'features-review'); fs.mkdirSync(screenshots, { recursive: true });
  for (const [width, theme] of [[1280, 'light'], [360, 'dark']]) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:false });
    await ev(`document.documentElement.dataset.theme='${theme}'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { document.querySelector('.atlas-comparison').scrollIntoView(); resolve(); })))`);
    await ev("new Promise(resolve=>setTimeout(resolve,250))");
    await until('comparação visível', () => ev("(() => {const block=document.querySelector('.atlas-comparison');block.scrollIntoView({behavior:'instant',block:'start'});return block.getBoundingClientRect().top<300;})()"));
    assert.equal(await ev('document.documentElement.scrollWidth > innerWidth'), false, 'Comparação não transborda a página.');
    const image = await client.send('Page.captureScreenshot', { format:'png' });
    fs.writeFileSync(path.join(screenshots,`comparison-${width}-${theme}.png`),Buffer.from(image.data,'base64'));
  }
  await client.send('Emulation.setDeviceMetricsOverride', { width:1280,height:900,deviceScaleFactor:1,mobile:false });
  await ev("document.querySelector('[data-view=quiz]').click();document.getElementById('focusToggle').click();navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{atlas:'versao-nova'}}))");
  assert.equal(await ev("getComputedStyle(document.getElementById('updateNotice')).display==='none'"), false);
  // A atualização aguarda o encerramento e não perde a resposta gravada.
  await ev("window.beforeAutomaticUpdate=true;document.querySelector('[data-answer]').click();document.querySelector('.session-finish').click()");
  const beforeReload = await ev("AtlasCore.Learning.summary(JSON.parse(localStorage.getItem('atlas195:v2')).learning).ms");
  await until('atualização automática depois do encerramento', () => ev("!window.beforeAutomaticUpdate && Boolean(document.querySelector('[data-answer]'))"), {timeout:20000});
  assert.equal(await ev("AtlasCore.Learning.summary(JSON.parse(localStorage.getItem('atlas195:v2')).learning).ms"), beforeReload);
  await ev("document.documentElement.dataset.theme='light'");
};

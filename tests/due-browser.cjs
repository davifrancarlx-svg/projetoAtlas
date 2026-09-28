'use strict';
const assert = require('node:assert/strict');

module.exports = async (client, evaluate, until) => {
  const ev = code => evaluate(client, code);
  // Fixture local do navegador de teste: 35 revisões antigas de regiões.
  await ev(`(() => {
    let p = AtlasCore.resetProgress(JSON.parse(localStorage.getItem('atlas195:v2')) || AtlasCore.createProgress());
    for (const c of DATA.slice(0,35)) p = AtlasCore.recordAnswer(p,c.id,'reg',true,{now:Date.now()-10*86400000});
    localStorage.setItem('atlas195:v2',AtlasCore.serializeProgress(p));
    window.dispatchEvent(new StorageEvent('storage',{key:'atlas195:v2',newValue:AtlasCore.serializeProgress(p)}));
    localStorage.removeItem('atlas195:serie:v1');
    localStorage.setItem('atlas195:prefs:v2',JSON.stringify({mode:'reg',region:'Mundo inteiro',includeVisual:true}));
  })()`);
  await client.send('Page.reload');
  await until('início da revisão de pendências',()=>ev("Boolean(document.getElementById('questionTitle'))"));
  await ev("document.querySelector('[data-view=prog]').click();document.getElementById('dueTraining').click()");
  const draft = () => ev("JSON.parse(localStorage.getItem('atlas195:serie:v1'))");
  const first = await draft();
  assert.equal(first.kind,'due');
  assert.equal(first.total,30);
  assert.equal(new Set(first.cards.map(c=>c.id+':'+c.direction)).size,30);
  await client.send('Page.reload');
  await until('oferta de retomada',()=>ev("document.getElementById('panel').textContent.includes('Retomar')"));
  await ev("[...document.querySelectorAll('button')].find(b=>/^Retomar/.test(b.textContent)).click()");
  assert.deepEqual((await draft()).cards,first.cards);
  for(let i=0;i<30;i++) {
    await ev(`(() => {
      const title=document.getElementById('questionTitle').textContent;
      const c=DATA.find(c=>title.includes(c.n+'?'));
      [...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer===c.r).click();
      document.getElementById('nextQuestion').click();
    })()`);
  }
  assert.ok(await ev("document.getElementById('panel').textContent.includes('Lote de revisões concluído')"));
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Continuar revisões pendentes').click()");
  assert.equal((await draft()).total,5,'O segundo lote contém somente as cinco pendências restantes.');
  assert.ok((await draft()).cards.every(c=>!first.cards.some(f=>f.id===c.id)));
  for(let i=0;i<5;i++) await ev(`(() => {
    const c=DATA.find(c=>document.getElementById('questionTitle').textContent.includes(c.n+'?'));
    [...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer===c.r).click();
    document.getElementById('nextQuestion').click();
  })()`);
  assert.ok(await ev("[...document.querySelectorAll('button')].some(b=>b.disabled&&b.textContent==='Nenhuma revisão pendente nestes filtros')"));
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Voltar ao treino livre').click()");
};

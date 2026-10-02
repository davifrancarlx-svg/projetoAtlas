'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

module.exports = async (client, evaluate, until) => {
  const ev = code => evaluate(client, code);
  // `answerMode: 'type'` é a preferência de quem usou a versão com digitação.
  // O app a ignora: todos os cenários abaixo respondem por escolha.
  const hook = await client.send('Page.addScriptToEvaluateOnNewDocument', {source: `
    localStorage.removeItem('atlas195:serie:v1');
    localStorage.setItem('atlas195:prefs:v2',JSON.stringify({mode:'reg',region:'Mundo inteiro',answerMode:'type',includeVisual:true,dailySize:5}));
  `});
  const boot = async () => {
    await client.send('Page.reload');
    await until('app pronto para cenário independente',()=>ev("Boolean(document.querySelector('[data-answer]')) && !document.getElementById('appShell').classList.contains('is-initializing')"));
  };
  const wrong = () => ev(`(() => {
    const c=DATA.find(c=>document.getElementById('questionTitle').textContent === 'Em que região fica '+c.n+'?');
    [...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer!==c.r).click();
  })()`);
  const daily = () => ev("document.querySelector('[data-view=prog]').click();document.getElementById('dailyTraining').click()");
  const failures = [];
  const scenario = async (name, run) => {
    await boot();
    try { await run(); } catch(error) { failures.push(`${name}: ${error.message}`); }
  };
  await scenario('contador da série após resposta',async()=>{
    await daily(); await wrong();
    assert.match(await ev("document.querySelector('.plate').textContent"),/1 de 5/);
  });
  await scenario('limite da revisão e rascunho de carta aposentada',async()=>{
    await wrong();
    await ev("document.querySelector('.session-finish').click();[...document.querySelectorAll('button')].find(b=>/^Revisar /.test(b.textContent)).click()");
    for(let i=0;i<6;i++) {
      await wrong();
      if(i<5) await ev("document.getElementById('nextQuestion').click()");
    }
    assert.equal(await ev("localStorage.getItem('atlas195:serie:v1')"),null,'A carta aposentada não pode reaparecer como rascunho.');
    await ev("document.getElementById('nextQuestion').click()");
    assert.match(await ev("document.querySelector('.review-done')?.textContent || ''"),/1 ficou para a próxima revisão/);
  });
  await scenario('acerto isolado na sexta tentativa respeita o teto da revisão',async()=>{
    await wrong();
    await ev("document.querySelector('.session-finish').click();[...document.querySelectorAll('button')].find(b=>/^Revisar /.test(b.textContent)).click()");
    for(let i=0;i<5;i++) { await wrong(); await ev("document.getElementById('nextQuestion').click()"); }
    await ev(`(() => {const c=DATA.find(c=>document.getElementById('questionTitle').textContent === 'Em que região fica '+c.n+'?');
      [...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer===c.r).click();})()`);
    assert.equal(await ev("localStorage.getItem('atlas195:serie:v1')"),null);
    await ev("document.getElementById('nextQuestion').click()");
    assert.match(await ev("document.querySelector('.review-done')?.textContent || ''"),/1 ficou para a próxima revisão/);
  });
  await scenario('apagar progresso também encerra série e respostas locais',async()=>{
    await daily(); await wrong();
    await ev("document.querySelector('[data-view=prog]').click();document.getElementById('resetProgress').click();document.getElementById('confirmReset').click()");
    await until('reset concluído',()=>ev("!document.getElementById('appShell').classList.contains('is-resetting')"));
    assert.equal(await ev("localStorage.getItem('atlas195:serie:v1')"),null);
    assert.match(await ev("document.getElementById('panel').textContent"),/Nenhuma pergunta respondida nesta sessão/);
    await ev("document.querySelector('[data-view=quiz]').click()");
    assert.doesNotMatch(await ev("document.getElementById('panel').textContent"),/Treino de hoje/);
  });
  await scenario('trocar modo encerra fila incompatível',async()=>{
    await daily();
    await ev("document.querySelector('[data-mode=cap]').click()");
    assert.equal(await ev("localStorage.getItem('atlas195:serie:v1')"),null);
    assert.match(await ev("document.querySelector('.plate').textContent"),/capital/);
  });
  await scenario('as sete habilidades na prática de um país',async()=>{
    await ev(`document.querySelector('[data-view=atlas]').click();
      const search=document.querySelector('input[type=search]');search.value='Brasil';search.dispatchEvent(new Event('input'));
      document.querySelector('[data-country=BR]').click();
      [...document.querySelectorAll('button')].find(b=>b.textContent==='Praticar Brasil').click()`);
    const seen=[];
    for(let i=0;i<7;i++) {
      seen.push(await ev("JSON.parse(localStorage.getItem('atlas195:serie:v1')).cards["+i+"].direction"));
      await ev(`(() => {
        const c=DATA.find(c=>c.id==='BR');
        if(document.getElementById('map').classList.contains('picking')) {
          document.getElementById('map').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        } else {
          const title=document.getElementById('questionTitle').textContent;
          const opts=[...document.querySelectorAll('[data-answer]')];
          opts.find(b=>/faz fronteira/.test(title)?c.nb.includes(b.dataset.answer):b.dataset.answer==='BR'||b.dataset.answer===c.r).click();
        }
      })()`);
      assert.equal(await ev("document.getElementById('verdictTitle').textContent"),'Correto');
      await ev("document.getElementById('nextQuestion').click()");
    }
    assert.equal(new Set(seen).size,7);
    assert.match(await ev("document.getElementById('panel').textContent"),/Prática de Brasil concluída/);
  });
  await scenario('só existe resposta por escolha, mesmo com a preferência antiga de digitar',async()=>{
    await ev("document.querySelector('[data-mode=cap]').click()");
    const estado = JSON.parse(await ev(`JSON.stringify({
      controle: Boolean(document.querySelector('[data-ans], #ansSeg, #answerControl')),
      campo: Boolean(document.querySelector('#panel input')),
      opcoes: document.querySelectorAll('[data-answer]').length,
      resumo: document.getElementById('filterSummary').textContent,
    })`));
    assert.equal(estado.controle, false, 'A barra não oferece mais escolher a forma de resposta.');
    assert.equal(estado.campo, false, 'Nenhuma pergunta tem campo de texto.');
    assert.equal(estado.opcoes, 4);
    assert.equal(estado.resumo, 'Capitais · Mundo inteiro · Livre');
    await ev(`(() => {
      const title=document.getElementById('questionTitle').textContent;
      const c=DATA.find(c=>title.endsWith(' '+c.n+'?')||title.startsWith(c.cap+' é'));
      document.querySelector('[data-answer="'+c.id+'"]').click();
    })()`);
    assert.equal(await ev("document.getElementById('verdictTitle').textContent"),'Correto');
  });
  await scenario('cronômetro pausa em segundo plano e registra um único erro ao esgotar',async()=>{
    await ev(`window.testNow=Date.now;window.testOffset=0;Date.now=()=>testNow()+testOffset;
      document.querySelector('[data-time="15"]').click();
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
      testOffset=60000;`);
    await new Promise(r=>setTimeout(r,250));
    assert.equal(await ev("Boolean(document.querySelector('.verdict'))"),false);
    await ev("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))");
    assert.ok(await ev("document.getElementById('questionTimer').value>14000"));
    await ev('testOffset+=16000');
    await until('tempo esgotado',()=>ev("document.getElementById('verdictTitle')?.textContent==='Tempo esgotado'"));
    assert.equal(await ev("document.querySelectorAll('.verdict').length"),1);
    await ev('Date.now=testNow');
  });
  await scenario('backup rejeita arquivo inválido e importa arquivo válido pela interface',async()=>{
    await ev("document.querySelector('[data-view=prog]').click();window.progressBefore=localStorage.getItem('atlas195:v2')");
    await ev(`(() => {const transfer=new DataTransfer();transfer.items.add(new File(['broken'],'invalid.json',{type:'application/json'}));
      const input=document.getElementById('importProgressInput');input.files=transfer.files;input.dispatchEvent(new Event('change'));})()`);
    await until('arquivo inválido recusado',()=>ev("document.getElementById('panel').textContent.includes('Nada foi alterado')"));
    assert.equal(await ev("localStorage.getItem('atlas195:v2')===progressBefore"),true);
    await ev(`(() => {
      const p=AtlasCore.recordAnswer(JSON.parse(localStorage.getItem('atlas195:v2')),'BR','cap',true);
      const transfer=new DataTransfer();transfer.items.add(new File([AtlasCore.serializeProgress(p)],'valid.json',{type:'application/json'}));
      const input=document.getElementById('importProgressInput');input.files=transfer.files;input.dispatchEvent(new Event('change'));
    })()`);
    await until('arquivo válido importado',()=>ev("document.getElementById('panel').textContent.includes('Progresso fundido')"));
    assert.ok(await ev("JSON.parse(localStorage.getItem('atlas195:v2')).countries.BR.skills.cap.correct>0"));
  });
  await scenario('comparação de bandeiras em celular e desktop, claro e escuro',async()=>{
    await ev(`document.querySelector('[data-view=atlas]').click();
      const search=document.querySelector('input[type=search]');search.value='Brasil';search.dispatchEvent(new Event('input'));
      document.querySelector('[data-country=BR]').click();
      [...document.querySelectorAll('button')].find(b=>b.textContent==='Praticar Brasil').click();
      [...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer!=='BR').click()`);
    assert.equal(await ev("document.querySelectorAll('.comparison-card .flag-image').length"),2);
    for (const width of [360,1280]) for(const theme of ['light','dark']) {
      await client.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
      await ev(`for(let i=0;i<3&&document.documentElement.dataset.theme!=='${theme}';i++)document.getElementById('themeToggle').click();
        document.querySelector('.answer-comparison').scrollIntoView({block:'center',behavior:'instant'})`);
      await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);
      assert.ok(await ev("[...document.querySelectorAll('.comparison-card')].every(c=>c.scrollWidth<=c.clientWidth)"));
      const shot=await client.send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(os.tmpdir(),`atlas-comparison-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));
    }
  });
  await client.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
  assert.deepEqual(failures,[]);
};

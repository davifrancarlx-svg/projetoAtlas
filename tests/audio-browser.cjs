'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = async (client, evaluate, until) => {
  const ev = code => evaluate(client,code);
  const hook=await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    localStorage.removeItem('atlas195:som:v1');
    localStorage.removeItem('atlas195:som:estilo:v1');
    window.audioProbe={contexts:0,starts:0,tipos:[]};
    const NativeAudio=window.AudioContext;
    window.AudioContext=class extends NativeAudio {
      constructor(...args){super(...args);audioProbe.contexts++;audioProbe.context=this;}
      createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{audioProbe.starts++;audioProbe.tipos.push(node.type);return start(...args)};return node;}
    };
  `});
  await client.send('Page.reload');
  await until('controle de som',()=>ev("typeof audioProbe!=='undefined' && document.getElementById('questionTitle') && document.querySelector('#soundToggle')?.textContent==='Som: desligado' && !document.getElementById('appShell').classList.contains('is-initializing')"));
  assert.equal(await ev('audioProbe.contexts'),0);
  // Quantas vozes o estilo padrão usa num acerto: notas × parciais. Fixar o
  // número aqui congelaria o timbre; ele muda de propósito quando o estilo muda.
  const vozes=await ev("AtlasAudio.sequence('correct').length*AtlasAudio.STYLES[0].parciais.length");
  await ev("window.audioKeys=[];for(const k of ['keydown','keyup','click'])document.addEventListener(k,e=>audioKeys.push({type:e.type,target:e.target.id,prevented:e.defaultPrevented}));document.getElementById('soundToggle').focus()");
  for(const type of ['keyDown','keyUp']) await client.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',...(type==='keyDown'?{text:'\r'}:{})});
  try { await until('áudio ativado pelo teclado',()=>ev(`audioProbe.starts>=${vozes}`)); }
  catch(error) { throw new Error(error.message+' '+JSON.stringify(await ev("({starts:audioProbe.starts,contexts:audioProbe.contexts,state:audioProbe.context?.state,focus:document.activeElement.id,button:document.getElementById('soundToggle').textContent,hidden:document.hidden,disabled:document.getElementById('soundToggle').disabled,inert:document.querySelectorAll('[inert]').length,events:audioKeys})"))); }
  assert.equal(await ev('audioProbe.context.state'),'running');
  assert.equal(await ev("localStorage.getItem('atlas195:som:v1')"),'1');
  await ev("document.querySelector('[data-view=quiz]').click();document.querySelector('[data-mode=reg]').click()");
  await until('pergunta com regiões',()=>ev("Boolean(document.querySelector('[data-answer]'))"));
  const previous=await ev('audioProbe.starts');
  await ev("(()=>{const title=document.getElementById('questionTitle').textContent;const c=DATA.find(c=>title.includes(c.n+'?'));[...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer===c.r).click()})()");
  await until('som da resposta',()=>ev(`audioProbe.starts>${previous}`));
  assert.equal(await ev(`audioProbe.starts-${previous}`),vozes,'O acerto toca as notas do estilo escolhido.');
  const afterAnswer=await ev('audioProbe.starts');
  await ev("document.getElementById('soundToggle').click()");
  await until('amostra de volume médio',()=>ev(`audioProbe.starts===${afterAnswer+vozes}`));

  // O painel da aba Progresso é o único lugar com estilo e escopo. Ele e o
  // botão do topo mostram o mesmo volume, senão a pessoa vê dois estados.
  await ev("document.querySelector('[data-view=prog]').click()");
  await until('painel de som',()=>ev("Boolean(document.getElementById('somEstilo'))"));
  const painel=JSON.parse(await ev(`JSON.stringify({
    volume: document.getElementById('somVolume').value,
    estilos: document.getElementById('somEstilo').options.length,
    escopos: document.getElementById('somEscopo').options.length,
    rotulos: [...document.querySelectorAll('label[for^=som]')].map(l=>l.textContent)
  })`));
  assert.equal(painel.volume,'2','O painel precisa mostrar o volume que o botão do topo deixou.');
  assert.ok(painel.estilos>=4,`Só ${painel.estilos} estilos na tela.`);
  assert.equal(painel.escopos,2);
  assert.equal(painel.rotulos.length,3,'Cada seletor precisa de rótulo próprio.');
  // Trocar de estilo toca a amostra e o timbre muda de verdade: a corda tem
  // mais parciais que o sino, então o número de vozes muda junto.
  const antesDoEstilo=await ev('audioProbe.starts');
  await ev("(()=>{const s=document.getElementById('somEstilo');s.value='corda';s.dispatchEvent(new Event('change'))})()");
  await until('amostra do estilo',()=>ev(`audioProbe.starts>${antesDoEstilo}`));
  assert.equal(await ev("audioProbe.tipos.at(-1)"),'triangle','O estilo escolhido não chegou ao oscilador.');
  assert.equal(await ev("localStorage.getItem('atlas195:som:estilo:v1')"),'{"estilo":"corda","escopo":"tudo"}');
  await ev("(()=>{const s=document.getElementById('somEstilo');s.value='sino';s.dispatchEvent(new Event('change'))})()");
  await ev("document.getElementById('soundToggle').click()");
  await until('contexto suspenso ao silenciar',()=>ev("audioProbe.context.state==='suspended'"));
  assert.equal(await ev("document.getElementById('somVolume').value"),'0','O botão do topo mudou o volume e o painel ficou para trás.');

  await ev("document.querySelector('[data-view=quiz]').click()");
  for(const width of [360,768,1280]) for(const theme of ['light','dark']) {
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<821});
    await ev(`for(let i=0;i<3&&document.documentElement.dataset.theme!=='${theme}';i++)document.getElementById('themeToggle').click()`);
    const box=await ev("(()=>{const r=document.getElementById('soundToggle').getBoundingClientRect();return {visible:r.x>=0&&r.right<=innerWidth&&r.height>=44,overflow:document.documentElement.scrollWidth>innerWidth}})()");
    assert.equal(box.visible,true);assert.equal(box.overflow,false);
    if(width===1280) assert.ok(await ev("document.querySelector('.topbar').getBoundingClientRect().height<80"),'O som não deve criar uma linha extra no desktop.');
    await ev('new Promise(r=>setTimeout(r,250))');
    const shot=await client.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(os.tmpdir(),`atlas-sound-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));
  }
  // O painel também precisa caber no celular, onde ele ganha três seletores.
  await client.send('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});
  await ev("document.querySelector('[data-view=prog]').click()");
  await until('painel de som no celular',()=>ev("Boolean(document.getElementById('somEstilo'))"));
  assert.equal(await ev("document.documentElement.scrollWidth>innerWidth"),false,'O painel de som estourou a largura do celular.');

  // Renderização nativa offline: as amostras usam exatamente o sintetizador do
  // jogo. Aqui se mede o que ouvido nenhum mede sozinho — pico, cauda e se dois
  // estilos não acabaram saindo iguais.
  const estilos=await ev("JSON.stringify(AtlasAudio.STYLES.map(e=>e.id))").then(JSON.parse);
  const assinaturas=new Map();
  for(const estilo of estilos) for(const kind of ['correct','error','complete']) {
    const medida=JSON.parse(await ev(`(async()=>{
      const c=new OfflineAudioContext(1,48000,48000);
      AtlasAudio.render(c,c.destination,'${kind}',0.23,{estilo:'${estilo}'});
      const dados=(await c.startRendering()).getChannelData(0);
      let pico=0,cauda=0;
      for(let i=0;i<dados.length;i++){const v=Math.abs(dados[i]);if(v>pico)pico=v;if(i>dados.length-4800&&v>cauda)cauda=v;}
      const janelas=[];
      for(let j=0;j<12;j++){let soma=0;const ini=j*2000;for(let i=ini;i<ini+2000;i++)soma+=dados[i]*dados[i];
        janelas.push(Math.round(Math.sqrt(soma/2000)*1e4));}
      return JSON.stringify({pico,cauda,janelas});
    })()`));
    assert.ok(medida.pico>0.02&&medida.pico<0.5,`${estilo}/${kind}: pico ${medida.pico.toFixed(3)} — mudo ou saturando.`);
    assert.ok(medida.cauda<0.0002,`${estilo}/${kind}: cauda de ${medida.cauda.toFixed(4)} passando de um segundo.`);
    assert.ok(medida.janelas.slice(0,3).some(v=>v>0),`${estilo}/${kind}: o som começa tarde demais.`);
    assinaturas.set(`${estilo}/${kind}`,medida.janelas.join(','));
  }
  assert.equal(new Set(assinaturas.values()).size,assinaturas.size,'Dois sons diferentes renderizaram exatamente o mesmo áudio.');

  // Um arquivo por som do estilo padrão, para conferir de ouvido quando alguém
  // mexer na síntese. O teste diz que existe som; só o ouvido diz se é bom.
  for(const kind of ['correct','error','complete']) {
    const samples=await ev(`(async()=>{const c=new OfflineAudioContext(1,48000,48000);AtlasAudio.render(c,c.destination,'${kind}',0.23);return Array.from((await c.startRendering()).getChannelData(0))})()`);
    const wav=Buffer.alloc(44+samples.length*2);
    wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
    wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);
    wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
    samples.forEach((v,i)=>wav.writeInt16LE(Math.round(v*32767),44+i*2));
    fs.writeFileSync(path.join(os.tmpdir(),`atlas-${kind}.wav`),wav);
  }
  await client.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
  await ev("document.getElementById('soundToggle').click();window.audioReloadSentinel=true");
  await client.send('Page.reload');
  await until('preferência de som restaurada',()=>ev("!window.audioReloadSentinel && document.querySelector('#soundToggle')?.textContent==='Som: baixo'"));
};

'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = async (client, evaluate, until) => {
  const ev = code => evaluate(client,code);
  const hook=await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    localStorage.removeItem('atlas195:som:v1');
    window.audioProbe={contexts:0,starts:0};
    const NativeAudio=window.AudioContext;
    window.AudioContext=class extends NativeAudio {
      constructor(...args){super(...args);audioProbe.contexts++;audioProbe.context=this;}
      createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{audioProbe.starts++;return start(...args)};return node;}
    };
  `});
  await client.send('Page.reload');
  await until('controle de som',()=>ev("typeof audioProbe!=='undefined' && document.getElementById('questionTitle') && document.querySelector('#soundToggle')?.textContent==='Som: desligado' && !document.getElementById('appShell').classList.contains('is-initializing')"));
  assert.equal(await ev('audioProbe.contexts'),0);
  await ev("window.audioKeys=[];for(const k of ['keydown','keyup','click'])document.addEventListener(k,e=>audioKeys.push({type:e.type,target:e.target.id,prevented:e.defaultPrevented}));document.getElementById('soundToggle').focus()");
  for(const type of ['keyDown','keyUp']) await client.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',...(type==='keyDown'?{text:'\r'}:{})});
  try { await until('áudio ativado pelo teclado',()=>ev('audioProbe.starts>=4')); }
  catch(error) { throw new Error(error.message+' '+JSON.stringify(await ev("({starts:audioProbe.starts,contexts:audioProbe.contexts,state:audioProbe.context?.state,focus:document.activeElement.id,button:document.getElementById('soundToggle').textContent,hidden:document.hidden,disabled:document.getElementById('soundToggle').disabled,inert:document.querySelectorAll('[inert]').length,events:audioKeys})"))); }
  assert.equal(await ev('audioProbe.context.state'),'running');
  assert.equal(await ev("localStorage.getItem('atlas195:som:v1')"),'1');
  await ev("document.querySelector('[data-view=quiz]').click();document.querySelector('[data-mode=reg]').click()");
  await until('pergunta com regiões',()=>ev("Boolean(document.querySelector('[data-answer]'))"));
  const previous=await ev('audioProbe.starts');
  await ev("(()=>{const title=document.getElementById('questionTitle').textContent;const c=DATA.find(c=>title.includes(c.n+'?'));[...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer===c.r).click()})()");
  await until('som da resposta',()=>ev(`audioProbe.starts>${previous}`));
  const added=await ev(`audioProbe.starts-${previous}`);
  assert.equal(added,4,'O acerto toca duas notas com dois harmônicos cada.');
  const afterAnswer=await ev('audioProbe.starts');
  await ev("document.getElementById('soundToggle').click()");
  await until('amostra de volume médio',()=>ev(`audioProbe.starts===${afterAnswer+4}`));
  await ev("document.getElementById('soundToggle').click()");
  await until('contexto suspenso ao silenciar',()=>ev("audioProbe.context.state==='suspended'"));
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
  // Renderização nativa offline: as amostras usam exatamente o sintetizador do jogo.
  for(const kind of ['correct','error']) {
    const samples=await ev(`(async()=>{const c=new OfflineAudioContext(1,24000,48000);AtlasAudio.render(c,c.destination,'${kind}',0.23);return Array.from((await c.startRendering()).getChannelData(0))})()`);
    const peak=Math.max(...samples.map(Math.abs));
    assert.ok(peak>0.02&&peak<0.5,`${kind}: áudio presente e sem saturação`);
    assert.ok(samples.slice(-1500).every(v=>Math.abs(v)<0.0002),'Final silencioso, sem cauda longa.');
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

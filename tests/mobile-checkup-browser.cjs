'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = async (client, evaluate, until) => {
  const ev = code => evaluate(client, code);
  const folder = path.join(__dirname, '..', 'docs', 'mobile-review');
  fs.mkdirSync(folder, { recursive: true });
  const results = [];
  await ev("if(document.getElementById('focusToggle').getAttribute('aria-pressed')==='true')document.getElementById('focusToggle').click();if(!document.getElementById('visualToggle').checked)document.getElementById('visualToggle').click();document.querySelector('[data-time=\"0\"]').click()");
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const settle = () => ev('new Promise(r=>setTimeout(r,220))');
  const tap = async selector => {
    const point = JSON.parse(await ev(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;return JSON.stringify({x,y,visible:e.contains(document.elementFromPoint(x,y))});})()`));
    assert.ok(point.visible, `Controle encoberto: ${selector}`);
    await client.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:point.x,y:point.y}] });
    await client.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    await settle();
  };
  for (const [width, height] of [[320,568],[360,640],[390,844],[844,390],[320,340]]) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:true });
    await ev("document.querySelector('[data-view=quiz]').click();document.querySelector('[data-mode=cap]').click();scrollTo(0,0)");
    await ev('new Promise(r=>setTimeout(r,250))');
    for (const view of ['quiz','atlas','prog']) {
      await ev(`document.querySelector('[data-view=${view}]').click();scrollTo(0,0)`);
      await ev('new Promise(r=>setTimeout(r,250))');
      const measurement = JSON.parse(await ev(`JSON.stringify({width:innerWidth,height:innerHeight,view:document.body.dataset.view,overflow:document.documentElement.scrollWidth-innerWidth,
        small:[...document.querySelectorAll('button,select,summary')].filter(e=>e.getClientRects().length && !e.closest('[hidden]')).map(e=>({text:e.textContent.trim().slice(0,45),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(e=>e.h<43||e.w<43),
        fields:[...document.querySelectorAll('input:not([type=checkbox]):not([type=file]):not([type=range]),select')].filter(e=>e.getClientRects().length).map(e=>({id:e.id,size:getComputedStyle(e).fontSize})),
        first:document.querySelector('[data-answer]')?.getBoundingClientRect().bottom,score:document.getElementById('scorebar').getBoundingClientRect().top})`));
      results.push(measurement);
      assert.equal(measurement.overflow,0,`${width}×${height}: ${view} transborda`);
      assert.deepEqual(measurement.small,[],`${width}: alvos pequenos em ${view}`);
      assert.ok(measurement.fields.every(field=>parseFloat(field.size)>=16),`${width}: campos com letra pequena`);
      if(width===360) {
        const shot=await client.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(folder, `${view}-after.png`),Buffer.from(shot.data,'base64'));
      }
    }
  }
  fs.writeFileSync(path.join(folder,'measurements-after.json'),JSON.stringify(results,null,2));
  await client.send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});
  await tap('[data-view=atlas]');
  await ev(`(() => {const s=document.querySelector('input[type=search]');s.value='Portugal';s.dispatchEvent(new Event('input'));})()`);
  await until('Portugal filtrado',()=>ev("document.querySelectorAll('[data-country]').length===1&&Boolean(document.querySelector('[data-country=PT]'))"));
  assert.ok(await ev("document.querySelector('.atlas-results').getBoundingClientRect().top < document.querySelector('.atlas-detail').getBoundingClientRect().top"));
  await tap('[data-country=PT]');
  assert.equal(await ev("document.querySelector('.atlas-results').open"),false);
  assert.ok(await ev("document.querySelector('.atlas-detail h3').getBoundingClientRect().top < innerHeight-56"));
  assert.equal(await ev("document.activeElement.textContent"),'Portugal');
  const detailShot=await client.send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(folder,'detail-after.png'),Buffer.from(detailShot.data,'base64'));
  await client.send('Emulation.setEmulatedMedia',{media:'print'});
  assert.ok(await ev("[...document.querySelectorAll('.atlas-detail > button')].every(e=>getComputedStyle(e).display==='none')"));
  await client.send('Emulation.setEmulatedMedia',{media:''});
  await tap('[data-show-country-map=PT]');
  assert.equal(await ev("document.getElementById('mapToggle').getAttribute('aria-expanded')"),'true');
  const mapPosition = JSON.parse(await ev("(()=>{const r=document.getElementById('mapRegion').getBoundingClientRect();return JSON.stringify({top:r.top,bottom:r.bottom,nav:document.querySelector('.tabs').getBoundingClientRect().top});})()"));
  assert.ok(mapPosition.top>=0 && mapPosition.bottom<=mapPosition.nav+1,JSON.stringify(mapPosition));
  await tap('.atlas-detail > button');
  assert.equal(await ev("document.querySelector('.atlas-results').open"),true);
  await tap('[data-view=quiz]');
  await ev("document.querySelector('[data-mode=cap]').click()");
  await tap('[data-answer]');
  assert.ok(await ev("document.querySelector('.verdict').getBoundingClientRect().top>=0&&document.querySelector('.verdict').getBoundingClientRect().top<innerHeight-100"));
  await tap('#nextQuestion');
  assert.ok(await ev("document.getElementById('questionTitle').getBoundingClientRect().top>=0&&document.querySelector('[data-answer]').getBoundingClientRect().bottom<innerHeight-56"));
  // Arrastar e pinçar o mapa não são respostas. O enunciado acompanha o mapa.
  await ev("document.querySelector('[data-mode=loc]').click()");
  for(let i=0;i<60 && !await ev("document.getElementById('map').classList.contains('picking')");i++) await ev("document.getElementById('skipVisualBtn').click()");
  assert.ok(await ev("document.getElementById('map').classList.contains('picking')"));
  if(await ev("document.getElementById('mapToggle').getAttribute('aria-expanded')==='false'")) await tap('#mapToggle');
  await ev("document.getElementById('mapRegion').scrollIntoView({block:'start',behavior:'instant'})");
  await settle();
  assert.equal(await ev("document.getElementById('mobileMapQuestion').textContent"),await ev("document.getElementById('questionTitle').textContent"));
  await tap('#zRst');
  const before=await ev("document.querySelector('.plate span').textContent");
  const center=JSON.parse(await ev("(()=>{const r=document.getElementById('map').getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()"));
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:center.x,y:center.y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+35,y:center.y+20}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const initialWidth=await ev("document.getElementById('map').viewBox.baseVal.width");
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:center.x-30,y:center.y},{id:1,x:center.x+30,y:center.y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:center.x-65,y:center.y},{id:1,x:center.x+65,y:center.y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await settle();
  assert.ok(await ev("document.getElementById('map').viewBox.baseVal.width") < initialWidth);
  assert.equal(await ev("Boolean(document.getElementById('nextQuestion'))"),false);
  assert.equal(await ev("document.querySelector('.plate span').textContent"),before);
  const mapShot=await client.send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(folder,'map-after.png'),Buffer.from(mapShot.data,'base64'));
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await client.send('Emulation.setDeviceMetricsOverride', { width:1280,height:900,deviceScaleFactor:1,mobile:false });
};

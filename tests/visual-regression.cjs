'use strict';
// Cenários executados pelo smoke test no mesmo Chrome real, sem bibliotecas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = async function visualRegression(client, evaluate, until) {
  const ev = code => evaluate(client, code);
  const key = async k => {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, ...(k === 'Enter' ? { text: '\r' } : {}) });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k });
  };
  const theme = t => ev(`for(let n=0;n<3 && document.documentElement.dataset.theme!=='${t}';n++) document.getElementById('themeToggle').click()`);
  const shot = async name => {
    await ev('new Promise(r=>setTimeout(r,250))');
    const capture = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(os.tmpdir(), `atlas-fixed-${name}.png`), Buffer.from(capture.data, 'base64'));
  };
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const t of ['light', 'dark']) {
    await theme(t);
    await ev("document.querySelector('[data-view=atlas]').click()");
    for (const id of ['VA', 'MC', 'TV', 'NR', 'SM']) {
      await ev(`(()=>{const s=document.querySelector('input[type=search]');s.value=DATA.find(c=>c.id==='${id}').n;s.dispatchEvent(new Event('input'))})()`);
      await until('resultado do microestado', () => ev(`Boolean(document.querySelector('[data-country=${id}]'))`));
      await ev(`document.querySelector('[data-country=${id}]').click();for(let n=0;n<20;n++)document.getElementById('zIn').click()`);
      const ring = await ev(`(()=>{const m=document.getElementById('map'),r=document.querySelector('.micro[data-id=${id}] .micro-ring'),b=r.getBoundingClientRect(),v=m.getBoundingClientRect();return {inside:b.x>=v.x&&b.right<=v.right&&b.y>=v.y&&b.bottom<=v.bottom,width:b.width,pointer:getComputedStyle(r).pointerEvents,x:b.x+b.width/2,y:b.y+b.height/2,max:document.getElementById('zIn').disabled,view:m.getAttribute('viewBox')}})()`);
      assert.equal(ring.max, true);
      assert.equal(ring.inside, true, `${id} deve permanecer visível a 60× (${t}).`);
      assert.ok(ring.width >= 13 && ring.width <= 15);
      assert.equal(ring.pointer, 'none');
      await client.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: ring.x, y: ring.y, deltaX: 0, deltaY: -100 });
      await ev('new Promise(r=>requestAnimationFrame(r))');
      assert.equal(await ev("document.getElementById('map').getAttribute('viewBox')"), ring.view);
      if (id === 'TV') await shot(`tuvalu-${t}`);
      for (const type of ['mousePressed', 'mouseReleased']) await client.send('Input.dispatchMouseEvent', { type, x: ring.x, y: ring.y, button: 'left', clickCount: 1 });
      assert.equal(await ev("document.querySelector('.atlas-detail h3').textContent"), await ev(`DATA.find(c=>c.id==='${id}').n`));
    }
    await ev("document.getElementById('zRst').click();for(let n=0;n<20;n++)document.getElementById('zIn').click();document.getElementById('map').focus()");
    const before = await ev("document.getElementById('map').viewBox.baseVal.width");
    await key('End');
    assert.equal(await ev("document.getElementById('map').viewBox.baseVal.width"), before);
    assert.equal(await ev("(()=>{const m=document.getElementById('map'),id=m.getAttribute('aria-activedescendant').slice(12),c=DATA.find(c=>c.id===id),p=new DOMPoint(...c.c).matrixTransform(m.getScreenCTM()),r=m.getBoundingClientRect();return p.x>=r.x&&p.x<=r.right&&p.y>=r.y&&p.y<=r.bottom})()"), true);
    assert.equal(await ev("getComputedStyle(document.querySelector('.grat path')).vectorEffect"), 'non-scaling-stroke');
    await shot(`map-keyboard-${t}`);
    await ev("document.querySelector('[data-view=prog]').click();document.getElementById('importProgressInput').previousElementSibling.focus()");
    await key('Tab');
    assert.equal(await ev('document.activeElement.id'), 'importProgressInput');
    assert.equal(await ev("getComputedStyle(document.querySelector('label[for=importProgressInput]')).outlineStyle"), 'solid');
    await shot(`import-${t}`);
  }

  // Sobrescreve a simulação anterior. Não acessa o serviço real.
  const hook = await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.removeItem('atlas195:conta:v1');
    if(sessionStorage.getItem('visualCallback')) history.replaceState(null,'','#access_token=fake&refresh_token=fake&type=magiclink');
    window.visualMock={mode:'pending',calls:0};
    window.fetch=async(url)=>{
      const p=String(url);
      if(p.includes('/auth/v1/otp')||p.includes('/auth/v1/user')){
        visualMock.calls++;
        if(visualMock.mode==='pending') await new Promise((resolve,reject)=>{visualMock.resolve=resolve;visualMock.reject=reject});
        return new Response(JSON.stringify({id:'test-user',email:'teste@example.invalid',user_metadata:{}}),{status:200});
      }
      return new Response('[]',{status:200});
    };
  ` });
  try {
    await client.send('Page.reload');
    await until('formulário de conta', () => ev("(()=>{document.querySelector('[data-view=prog]')?.click();return Boolean(document.getElementById('contaEmail'))})()"));
    for (const t of ['light', 'dark']) {
      await theme(t);
      await ev("(()=>{visualMock.mode='pending';const input=document.getElementById('contaEmail');input.value='teste@example.invalid';input.dispatchEvent(new Event('input'));input.focus()})()");
      await key('Enter');
      assert.equal(await ev('document.activeElement.id'), 'contaEmail');
      assert.equal(await ev("document.getElementById('contaEmail').value"), 'teste@example.invalid');
      const count = await ev('visualMock.calls');
      await key('Enter');
      assert.equal(await ev('visualMock.calls'), count, 'Não duplicar o pedido durante o envio.');
      await ev("visualMock.reject(new Error('rede simulada'));void 0");
      await until('falha do envio', () => ev("document.getElementById('panel').textContent.includes('Sem conexão para enviar')"));
      assert.equal(await ev('document.activeElement.id'), 'contaEmail');
      assert.equal(await ev("document.getElementById('contaEmail').value"), 'teste@example.invalid');
      await shot(`email-${t}`);
    }
    await ev("sessionStorage.setItem('visualCallback','1')");
    await client.send('Page.reload');
    await until('consulta de identidade', () => ev("typeof visualMock?.reject==='function'"));
    for (const t of ['light', 'dark']) {
      await theme(t);
      await ev("document.querySelector('[data-view=prog]').click();document.getElementById('contaTitle').scrollIntoView({block:'center',behavior:'instant'})");
      assert.equal(await ev('location.hash'), '');
      assert.equal(await ev("Boolean(document.getElementById('salvarApelido'))"), false);
      assert.equal(await ev("document.getElementById('contaTitle').parentElement.textContent.includes('Confirmando sua conexão')"), true);
      await shot(`pending-${t}`);
    }
    await ev("visualMock.reject(new Error('rede simulada'));void 0");
    await until('falha da identidade', () => ev("document.getElementById('panel').textContent.includes('Não foi possível concluir a conexão')"));
    assert.equal(await ev("document.getElementById('contaTitle').parentElement.textContent.includes('Conectado como')"), false);
    await ev("visualMock.mode='ok';document.getElementById('retomarConta').focus()");
    await key('Enter');
    await until('recuperar conexão', () => ev("Boolean(document.getElementById('contaApelido'))"));
    assert.equal(await ev('document.activeElement.id'), 'contaApelido');
    assert.equal(await ev("document.getElementById('contaTitle').parentElement.textContent.includes('teste@example.invalid')"), true);
  } finally {
    await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: hook.identifier });
  }
};

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
module.exports=async(client,evaluate,until)=>{
  const ev=code=>evaluate(client,code);
  // Cada tamanho selecionado deve chegar ao contador da série e à preferência.
  for(const size of [5,20,10]) {
    await ev(`(() => {document.querySelector('[data-view=prog]').click();const select=document.getElementById('dailySize');select.value='${size}';select.dispatchEvent(new Event('change'));document.getElementById('dailyTraining').click()})()`);
    assert.equal(await ev("JSON.parse(localStorage.getItem('atlas195:serie:v1')).total"),size);
    assert.equal(await ev("JSON.parse(localStorage.getItem('atlas195:prefs:v2')).dailySize"),size);
  }
  for(const theme of ['light','dark']){
    await client.send('Emulation.setDeviceMetricsOverride',{width:theme==='light'?360:1280,height:900,deviceScaleFactor:1,mobile:theme==='light'});
    await ev(`for(let n=0;n<3&&document.documentElement.dataset.theme!=='${theme}';n++)document.getElementById('themeToggle').click();document.querySelector('[data-mode=reg]').click();document.querySelector('[data-view=prog]').click();document.querySelector('[data-other-training]').open=true;document.getElementById('dailyTraining').focus()`);
    for(const type of ['keyDown','keyUp'])await client.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
    for(let i=0;i<10;i++){
      await until('pergunta diária',()=>ev("Boolean(document.querySelector('[data-answer]:not(:disabled)'))"));
      await ev("(()=>{const title=document.getElementById('questionTitle').textContent,c=DATA.find(c=>title.includes(c.n+'?'));[...document.querySelectorAll('[data-answer]')].find(b=>b.dataset.answer===c.r).click();document.getElementById('nextQuestion').click()})()");
    }
    await until('fechamento diário',()=>ev("document.getElementById('panel').textContent.includes('Treino de hoje concluído')"));
    assert.ok(await ev("document.getElementById('panel').textContent.includes('10 de 10')"));
    assert.ok(await ev("document.querySelectorAll('.study-summary').length>=2"));
    assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'),false);
    await ev('new Promise(r=>setTimeout(r,250))');
    const shot=await client.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(os.tmpdir(),`atlas-study-${theme}.png`),Buffer.from(shot.data,'base64'));
    await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Voltar ao treino livre').click()");
  }
};

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../src/core.js');
const countries = require('../src/countries.base.json');
function fixture() {
  const store = new Map();
  const document = { getElementById: () => null, querySelector: () => null,
    createElement: () => ({ append() {}, setAttribute() {} }) };
  const context = vm.createContext({ document, setTimeout: () => 1, clearTimeout() {},
    window: { addEventListener() {} }, localStorage: {
      getItem: k => store.get(k), setItem: (k,v) => store.set(k,v),
    } });
  vm.runInContext(fs.readFileSync(require.resolve('../src/achievements-ui.js'), 'utf8'), context);
  let p = Core.createProgress();
  let user = 'one';
  let request = async () => { throw new Error('offline'); };
  let scheduled = 0;
  const ui = context.AtlasAchievementsUI.create({ Core, countries, getProgress: () => p,
    request: (...args) => request(...args), connected: () => user, schedule: () => scheduled++ });
  return { ui, store, get scheduled() { return scheduled; }, set request(r) { request=r; },
    set user(u) { user=u; }, reset() { p=Core.resetProgress(p); } };
}
test('sequência digitada reinicia após erro ou escolha; tema conta na abertura', () => {
  const f = fixture();
  for(let i=0;i<9;i++) f.ui.record({type:'answer',correct:true,typed:true},true);
  f.ui.record({type:'answer',correct:true,typed:false},true);
  let a = f.ui.record({type:'answer',correct:true,typed:true},true);
  assert.ok(!a.unlocked.includes('typed10'));
  f.ui.record({type:'answer',correct:false,typed:true},true);
  for(let i=0;i<10;i++) a=f.ui.record({type:'answer',correct:true,typed:true},true);
  assert.ok(a.unlocked.includes('typed10'));
  for(let i=0;i<3;i++) a=f.ui.record({type:'theme'},true);
  assert.ok(a.unlocked.includes('theme'));
});
test('aviso encontra o troféu sem consumir a fila durante a busca', () => {
  const f = fixture();
  assert.doesNotThrow(() => f.ui.record({type:'backup'}));
  const g = fixture();
  for(let i=0;i<3;i++) assert.doesNotThrow(() => g.ui.record({type:'theme'}));
});
test('offline preserva troféus; sem conta não envia requisição', async () => {
  const f=fixture();
  f.ui.record({type:'backup'},true);
  await f.ui.sync();
  assert.ok(f.ui.record({},true).unlocked.includes('backup'));
  f.user=null;
  let calls=0; f.request=async()=>{calls++;};
  await f.ui.sync();
  assert.equal(calls,0);
});
test('sincronização funde troféus e agenda os ganhos durante o envio', async () => {
  const f=fixture();
  f.ui.record({type:'backup'},true);
  let finish;
  f.request=async()=>new Promise(resolve=>{finish=resolve;});
  const syncing=f.ui.sync();
  for(let i=0;i<3;i++) f.ui.record({type:'theme'},true);
  const before=f.scheduled;
  finish({ok:true,json:async()=>[{generation:0,epoch:'',unlocked:['backup','cloud']}]});
  await syncing;
  assert.deepEqual([...f.ui.record({},true).unlocked],['backup','cloud','theme']);
  assert.ok(f.scheduled>before);
});
test('resposta atrasada não restaura troféus depois de reset ou saída', async () => {
  const f=fixture();
  let finish;
  f.request=async()=>new Promise(resolve=>{finish=resolve;});
  let syncing=f.ui.sync();
  f.reset();
  finish({ok:true,json:async()=>[{generation:0,epoch:'',unlocked:['backup']}]});
  await syncing;
  assert.deepEqual([...f.ui.record({},true).unlocked],[]);
  syncing=f.ui.sync(); f.user=null;
  finish({ok:true,json:async()=>[{generation:0,epoch:'',unlocked:['cloud']}]});
  await syncing;
  assert.deepEqual([...f.ui.record({},true).unlocked],[]);
});

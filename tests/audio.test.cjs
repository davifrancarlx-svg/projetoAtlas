'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Audio = require('../src/audio.js');

function fixture(saved = null) {
  const events = {}, clicks = {}, tasks = new Map(), starts = [], stops = [];
  let created = 0, serial = 0, stored = saved;
  const button = { textContent: '', setAttribute() {}, addEventListener: (k,f) => { clicks[k]=f; } };
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelAndHoldAtTime() {} };
  class Context {
    constructor() { created++; this.state='running'; this.currentTime=0; this.destination={}; }
    createOscillator() { const osc={ frequency: {}, connect() {}, disconnect() {}, start: () => starts.push(osc.frequency.value), stop: at => stops.push(at) }; return osc; }
    createGain() { return { gain: param, connect() {}, disconnect() {} }; }
    suspend() { this.state='suspended'; return Promise.resolve(); }
    resume() { this.state='running'; return Promise.resolve(); }
  }
  const host = { AudioContext: Context, document: { hidden:false, getElementById:()=>button, addEventListener:(k,f)=>{events[k]=f;} },
    localStorage: {getItem:()=>stored,setItem:(_,v)=>{stored=v;}},
    setTimeout: f=>{tasks.set(++serial,f);return serial;},clearTimeout:id=>tasks.delete(id) };
  const api=Audio.create(host);
  return { api, host, starts, stops, button, events, click:()=>clicks.click(), get created(){return created;},
    async flush(){const callbacks=[...tasks.values()];tasks.clear();for(const f of callbacks)await f();} };
}

test('som começa desligado e gestos não criam contexto enquanto está mudo', async () => {
  const f=fixture();f.events.pointerdown();f.api.play('correct');await f.flush();
  assert.equal(f.created,0);assert.match(f.button.textContent,/desligado/);
});
test('preferência inválida mantém silêncio; preferência válida não toca ao abrir', async () => {
  for(const raw of ['{}','3','-1','"1"','invalid']) { const f=fixture(raw);f.api.play('error');await f.flush();assert.equal(f.created,0); }
  const f=fixture('1');await f.flush();assert.equal(f.created,0);assert.match(f.button.textContent,/baixo/);
});
test('acerto vence erro simultâneo; silenciar cancela som pendente', async () => {
  const f=fixture('1');f.events.pointerdown();f.api.play('error');f.api.play('correct');await f.flush();
  assert.equal(f.starts.length,4);assert.ok(!f.starts.includes(196));
  f.click();f.click();f.api.play('error');await f.flush();
  assert.equal(f.starts.length,4);assert.match(f.button.textContent,/desligado/);
});
test('aba oculta cancela sons e não reproduz fila ao retornar', async () => {
  const f=fixture('1');f.api.play('correct');f.host.document.hidden=true;f.events.visibilitychange();await f.flush();
  f.api.play('correct');await f.flush();assert.equal(f.starts.length,0);
  f.host.document.hidden=false;await f.flush();assert.equal(f.starts.length,0);
});
test('acertos variam discretamente e todos os efeitos permanecem curtos', () => {
  assert.equal(new Set([0,1,2].map(v=>Audio.sequence('correct',v)[0][0])).size,3);
  for(const kind of ['correct','error']) assert.ok(Math.max(...Audio.sequence(kind).map(n=>n[1]+n[2]))<0.5);
});
test('falha do dispositivo de áudio não interrompe o jogo', async () => {
  const f=fixture('1');f.host.AudioContext.prototype.resume=async()=>{throw Error('sem áudio');};
  f.events.pointerdown();f.api.play('correct');await f.flush();f.host.document.hidden=true;f.events.visibilitychange();
  f.host.document.hidden=false;f.api.play('error');await assert.doesNotReject(f.flush());
});

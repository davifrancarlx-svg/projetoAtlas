'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Audio = require('../src/audio.js');

const KEY = 'atlas195:som:v1';
const KEY_STYLE = 'atlas195:som:estilo:v1';

// Elemento de mentira, só com o que o módulo usa. Serve para o painel de
// preferências, que o próprio módulo monta.
function elemento(tag) {
  const el = { tag, children: [], listeners: {}, textContent: '', className: '', value: '', disabled: false };
  el.append = (...kids) => { el.children.push(...kids); };
  el.addEventListener = (kind, fn) => { el.listeners[kind] = fn; };
  el.setAttribute = () => {};
  return el;
}
const descendentes = (el) => el.children.flatMap((kid) => [kid, ...descendentes(kid)]);
const seletores = (el) => descendentes(el).filter((kid) => kid.tag === 'select');

function fixture(saved = null) {
  const events = {}, clicks = {}, tasks = new Map(), starts = [], stops = [], tipos = [];
  let created = 0, serial = 0;
  const store = new Map(saved === null ? [] : [[KEY, saved]]);
  const button = { textContent: '', setAttribute() {}, addEventListener: (k,f) => { clicks[k]=f; } };
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelAndHoldAtTime() {} };
  class Context {
    constructor() { created++; this.state='running'; this.currentTime=0; this.destination={}; }
    createOscillator() { const osc={ frequency: {}, connect() {}, disconnect() {}, start: () => { starts.push(osc.frequency.value); tipos.push(osc.type); }, stop: at => stops.push(at) }; return osc; }
    createGain() { return { gain: param, connect() {}, disconnect() {} }; }
    suspend() { this.state='suspended'; return Promise.resolve(); }
    resume() { this.state='running'; return Promise.resolve(); }
  }
  const host = { AudioContext: Context, document: { hidden:false, getElementById:()=>button, createElement:elemento, addEventListener:(k,f)=>{events[k]=f;} },
    localStorage: {getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,v);}},
    setTimeout: f=>{tasks.set(++serial,f);return serial;},clearTimeout:id=>tasks.delete(id) };
  const api=Audio.create(host);
  return { api, host, starts, stops, tipos, store, button, events, click:()=>clicks.click(), get created(){return created;},
    painel(){const caixa=elemento('div');api.panel(caixa);return seletores(caixa);},
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
  for(const kind of ['correct','error','complete']) assert.ok(Math.max(...Audio.sequence(kind).map(n=>n[1]+n[2]))<0.5);
});
test('falha do dispositivo de áudio não interrompe o jogo', async () => {
  const f=fixture('1');f.host.AudioContext.prototype.resume=async()=>{throw Error('sem áudio');};
  f.events.pointerdown();f.api.play('correct');await f.flush();f.host.document.hidden=true;f.events.visibilitychange();
  f.host.document.hidden=false;f.api.play('error');await assert.doesNotReject(f.flush());
});

// --- estilos, escopo e fim de série ---------------------------------------
// O pedido era som gostoso e que não enjoe. Enjoar é o efeito de ouvir a mesma
// coisa dezenas de vezes, então o que os testes protegem é a variedade (nota e
// timbre), a brandura (nenhuma onda áspera) e a saída (dá para calar só o
// acerto, que é o som repetido).

test('a nota do acerto percorre a pentatônica inteira antes de repetir', () => {
  const primeiras = [0,1,2,3,4].map(v=>Audio.sequence('correct',v)[0][0]);
  assert.equal(new Set(primeiras).size,5,'Duas voltas seguidas caem na mesma nota.');
  assert.deepEqual(Audio.sequence('correct',5),Audio.sequence('correct',0),'O ciclo precisa fechar.');
  for(const v of [0,1,2,3,4]) {
    const [grave,agudo]=Audio.sequence('correct',v);
    assert.ok(agudo[0]>grave[0],'O acerto sobe.');
    assert.ok(agudo[0]/grave[0]<1.4,'Salto grande demais para soar consonante.');
  }
  const [um,dois]=Audio.sequence('error');
  assert.ok(dois[0]<um[0],'O erro desce — é o gesto que se lê como "não" sem aspereza.');
  assert.ok(um[0]<300,'O erro fica no grave, longe do registro do acerto.');
});

test('cada estilo tem timbre próprio e nenhum deles usa onda áspera', () => {
  assert.ok(Audio.STYLES.length>=4,`Só ${Audio.STYLES.length} estilos.`);
  const assinaturas=new Set();
  for(const estilo of Audio.STYLES) {
    assert.ok(estilo.id&&estilo.nome,'Estilo sem id ou sem nome para a tela.');
    assert.ok(['sine','triangle'].includes(estilo.tipo),`${estilo.id} usa ${estilo.tipo}: serra e quadrada são ásperas.`);
    assert.ok(estilo.ataque>0&&estilo.ataque<=0.06,`${estilo.id}: ataque fora do razoável.`);
    assert.ok(estilo.parciais.every(([,peso])=>peso>0&&peso<1));
    assert.ok(estilo.parciais.reduce((soma,[,peso])=>soma+peso,0)<=0.8,`${estilo.id} soma parciais demais e vai saturar.`);
    assinaturas.add(estilo.tipo+JSON.stringify(estilo.parciais)+estilo.ataque+estilo.cauda);
  }
  assert.equal(assinaturas.size,Audio.STYLES.length,'Dois estilos produzem exatamente o mesmo som.');
});

test('o estilo escolhido é o que toca, e sobrevive à próxima abertura', async () => {
  const f=fixture('1');
  const [,estilo]=f.painel();
  estilo.value='corda';await estilo.listeners.change();await f.flush();
  assert.ok(f.tipos.length,'A amostra do estilo não tocou.');
  assert.ok(f.tipos.every(t=>t==='triangle'),`Tocou ${[...new Set(f.tipos)]} em vez do timbre de corda.`);
  assert.match(f.store.get(KEY_STYLE),/corda/);

  const volta=fixture(null);
  volta.store.set(KEY,'1');volta.store.set(KEY_STYLE,f.store.get(KEY_STYLE));
  const reaberto=Audio.create(volta.host);
  volta.events.pointerdown();reaberto.play('correct');await volta.flush();
  assert.ok(volta.tipos.every(t=>t==='triangle'),'O estilo guardado não voltou na abertura seguinte.');
});

test('estilo inventado no armazenamento vira o padrão, sem quebrar nada', async () => {
  const f=fixture('1');
  f.store.set(KEY_STYLE,JSON.stringify({estilo:'trombone',escopo:'sempre'}));
  const api=Audio.create(f.host);
  f.events.pointerdown();api.play('correct');await f.flush();
  assert.ok(f.tipos.every(t=>t==='sine'),'Preferência inválida deveria cair no estilo padrão.');
});

test('"só os erros" cala o acerto e preserva o erro e o fim de série', async () => {
  const f=fixture('1');
  const [,,escopo]=f.painel();
  escopo.value='erro';await escopo.listeners.change();await f.flush();
  const amostra=f.starts.length;
  assert.ok(amostra>0&&f.starts.includes(196),'A amostra do escopo precisa tocar o que a pessoa vai ouvir: o erro.');
  f.api.play('correct');await f.flush();
  assert.equal(f.starts.length,amostra,'O acerto continuou tocando depois de ser desligado.');
  f.api.play('complete');await f.flush();
  assert.ok(f.starts.length>amostra,'O fim de série some junto com o acerto, e ele não é o som repetido.');
});

test('o fim de série vence o acerto e o erro no mesmo instante', async () => {
  const f=fixture('1');f.events.pointerdown();
  f.api.play('correct');f.api.play('error');f.api.play('complete');await f.flush();
  const fim=Audio.sequence('complete').map(n=>n[0]);
  assert.ok(fim.every(nota=>f.starts.includes(nota)),'O fim de série perdeu a vez para uma resposta.');
});

test('o painel e o botão do topo mostram o mesmo volume', async () => {
  const f=fixture('1');
  const [volume,estilo,escopo]=f.painel();
  assert.equal(volume.value,'1');
  assert.equal(estilo.value,'sino');
  assert.equal(escopo.value,'tudo');
  f.click();await f.flush();
  assert.match(f.button.textContent,/médio/);
  assert.equal(volume.value,'2','O botão do topo mudou o volume e o painel ficou para trás.');
  volume.value='0';await volume.listeners.change();await f.flush();
  assert.match(f.button.textContent,/desligado/,'O painel mudou o volume e o botão do topo ficou para trás.');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');
const Study = require('../src/study.js');
const Tools = require('../src/country-tools.js');
test('fontes têm links oficiais, definição e data de consulta separada do ano', () => {
  const meta = require('../data/indicators.json').meta;
  const entries = Tools.sourceEntries(meta);
  assert.equal(entries.length, 6);
  for (const entry of entries) {
    assert.ok(entry.definition.length > 20);
    assert.match(entry.collected, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['data.worldbank.org', 'hdr.undp.org', 'fra-data.fao.org'].includes(new URL(entry.url).hostname));
  }
  assert.match(entries.find(e => e.field === 'flor').definition, /área terrestre/);
});

test('evolução usa acertos reais, exige duas sessões e inclui erro sem país confundido', () => {
  let progress = Core.createProgress();
  const base = { countryIds: ['BR'], now: '2026-10-02T12:00:00.000Z' };
  for (const [session, correctCount] of [['session-old', 2], ['session-new', 4]]) {
    for (let i = 0; i < 5; i++) progress = Core.recordAnswer(progress, 'BR', 'cap', i < correctCount, {
      ...base, now: session === 'session-old' ? '2026-10-01T12:00:00.000Z' : base.now,
      learning: { device: 'device-one', session, event: `${session}-${i}`, ms: 1000 },
    });
  }
  const trend = Core.Learning.evolution(progress.learning).find(row => row.label === 'Capitais');
  assert.equal(trend.delta, 40);
  assert.equal(trend.recent.correct, 4);
  assert.equal(Object.keys(progress.learning.errors).length, 0);
  assert.equal(Core.Learning.evolution(progress.learning).find(row => row.label === 'Bandeiras').delta, null);
  const merged = Core.mergeProgress(progress, progress, base);
  assert.deepEqual(merged.learning, progress.learning);
  const restored = Core.deserializeProgress(Core.serializeProgress(progress), base);
  assert.deepEqual(restored.progress.learning, progress.learning);
  const old = structuredClone(progress);
  old.schemaVersion = 3;
  Object.values(old.learning.sessions).forEach(row => { delete row.skills; });
  const upgraded = Core.deserializeProgress(old, base);
  assert.equal(upgraded.migrated, true);
  assert.equal(Core.Learning.evolution(upgraded.progress.learning)[0].delta, null);
  assert.equal(Core.levelOf(upgraded.progress, 'BR', 'cap'), Core.levelOf(progress, 'BR', 'cap'));
  const bad = structuredClone(progress);
  bad.learning.sessions['session-new'].skills.cap.correct = 6;
  assert.equal(Core.validateProgress(bad, base).valid, false);
});

test('métricas por habilidade fundem sem duplicação, com ordem determinística e sem mutar a origem', () => {
  const Learning = Core.Learning;
  const base = { device: 'merge-device', session: 'merge-session', event: 'merge-event', at: '2026-10-02T12:00:00.000Z',
    id: 'BR', ms: 1000, correct: true };
  const left = Learning.record(Learning.empty(), { ...base, direction: 'flag' });
  const right = Learning.record(Learning.empty(), { ...base, direction: 'cap' });
  const before = JSON.stringify(left);
  const merged = Learning.merge(left, right);
  assert.equal(JSON.stringify(merged), JSON.stringify(Learning.merge(right, left)));
  assert.equal(merged.sessions['merge-session'].answers, 2);
  assert.equal(Learning.valid(merged, null, ['cap', 'flag']), true);
  assert.deepEqual(Learning.merge(merged, left), merged);
  merged.sessions['merge-session'].skills.flag.correct = 0;
  assert.equal(JSON.stringify(left), before);
});

test('treino de par alterna ambos os países e respeita a preferência sem visual', () => {
  const plan = Core.Learning.pairPlan('BR', 'PT', 'flag', false);
  assert.equal(plan.length, 6);
  assert.deepEqual(plan.map(c => c.id), ['BR', 'PT', 'BR', 'PT', 'BR', 'PT']);
  assert.ok(plan.every(c => ['cap', 'capOf'].includes(c.direction) && c.opponent !== c.id));
  assert.equal(Core.Learning.pairPlan('BR', 'BR', 'cap').length, 0);
});

test('o país confundido aparece nas alternativas sem duplicar ou mudar a resposta', () => {
  const all = require('../src/countries.base.json');
  for (const direction of ['cap', 'capOf', 'flag', 'flagOf', 'mapId']) {
    for (let i = 0; i < 20; i++) {
      const { question } = Core.createQuestion({ countries: all, directions: [direction], forcedId: 'BR', opponentId: 'PT' });
      assert.equal(question.id, 'BR');
      assert.ok(question.opts.includes('PT'));
      assert.equal(new Set(question.opts).size, 4);
    }
  }
  const { question } = Core.createQuestion({ countries: all, directions: ['locate'], forcedId: 'BR', opponentId: 'PT' });
  assert.equal(question.variant, 'map');
  assert.equal(question.answerId, undefined);
});
const countries = [
  { id: 'BR', n: 'Brasil', r: 'América do Sul', sr: 'América do Sul', ar: 10, pop: 20 },
  { id: 'PT', n: 'Portugal', r: 'Europa', sr: 'Europa Meridional', ar: 1, pop: 5 },
  { id: 'VA', n: 'Vaticano', r: 'Europa', sr: 'Europa Meridional', ar: .1 },
];
const options = { countryIds: countries.map(c => c.id), now: '2026-10-01T12:00:00.000Z' };
const event = (device, n, ms = 2000) => ({ device, session: device + '-session', event: device + '-event-' + n,
  ms, chosen: 'PT', reason: 'other' });
test('v2 migra sem perder revisões; histórico inválido e versão futura são recusados', () => {
  const before = Core.recordAnswer(Core.createProgress(options), 'BR', 'cap', true, options);
  before.schemaVersion = 2; delete before.learning;
  const migrated = Core.deserializeProgress(JSON.stringify(before), options);
  assert.equal(migrated.migrated, true); assert.equal(migrated.sourceVersion, 2);
  assert.deepEqual(migrated.progress.countries, before.countries);
  assert.deepEqual(migrated.progress.learning, Core.Learning.empty());
  const v3 = structuredClone(migrated.progress); v3.schemaVersion = 3;
  assert.equal(Core.deserializeProgress(v3, options).sourceVersion, 3);
  assert.deepEqual(Core.deserializeProgress(v3, options).progress.countries, before.countries);
  const bad = structuredClone(migrated.progress);
  bad.learning.errors['event-123'] = { at: options.now, id: 'BR', chosen: 'XX', direction: 'cap', reason: 'other' };
  assert.equal(Core.validateProgress(bad, options).valid, false);
  bad.schemaVersion = 99;
  assert.equal(Core.deserializeProgress(bad, options).recovered, true);
});
test('históricos concorrentes somam aparelhos, não duplicam reenvios e respeitam reset', () => {
  const base = Core.createProgress(options);
  const a = Core.recordAnswer(base, 'BR', 'cap', false, { ...options, learning: event('device-a', 1) });
  const b = Core.recordAnswer(base, 'BR', 'cap', false, { ...options, learning: event('device-b', 1, 3000) });
  const merged = Core.mergeProgress(a, b, options);
  assert.equal(Core.Learning.summary(merged.learning).ms, 5000);
  assert.equal(Core.Learning.summary(merged.learning).confusions[0].count, 2);
  assert.deepEqual(Core.mergeProgress(a, b, options).learning, Core.mergeProgress(b, a, options).learning);
  assert.deepEqual(Core.mergeProgress(merged, a, options).learning, merged.learning);
  const next = Core.recordAnswer(merged, 'BR', 'cap', true, { ...options, learning: event('device-a', 2) });
  assert.equal(Core.Learning.summary(next.learning).ms, 7000);
  assert.equal(Object.keys(next.learning.errors).length, 2, 'Acerto não registra confusão.');
  const restored = Core.deserializeProgress(Core.serializeProgress(next, options), options);
  assert.deepEqual(restored.progress.learning, next.learning);
  const reset = Core.resetProgress(next, options);
  assert.deepEqual(Core.mergeProgress(reset, merged, options).learning, Core.Learning.empty());
});
test('retenção limita detalhes sem perder duração acumulada', () => {
  let history = Core.Learning.empty();
  for (let i = 0; i < 1002; i++) {
    history = Core.Learning.record(history, { ...event('device-a', i, 1000), session: 'session-' + String(i).padStart(5, '0'),
      at: new Date(Date.parse(options.now) + i * 1000).toISOString(), id: 'BR', direction: 'cap' });
  }
  assert.equal(Object.keys(history.sessions).length, 200);
  assert.equal(Object.keys(history.errors).length, 1000);
  assert.equal(Core.Learning.summary(history).ms, 1002000);
  const progress = Core.createProgress(options); progress.learning = history;
  assert.equal(Core.validateProgress(progress, options).valid, true);
  assert.ok(Buffer.byteLength(Core.serializeProgress(progress)) < 2097152);
});
test('novidades excluem habilidades vistas e respeitam área e direções', () => {
  const progress = Core.recordAnswer(Core.createProgress(options), 'PT', 'cap', false, options);
  const plan = Study.freshPlan(Core, countries, progress, ['cap', 'capOf'], 'Europa Meridional');
  assert.deepEqual(plan, [{ id: 'VA', direction: 'cap' }, { id: 'PT', direction: 'capOf' }, { id: 'VA', direction: 'capOf' }]);
  assert.equal(new Set(plan.map(c => c.id + c.direction)).size, plan.length);
});
test('ordenação põe ausentes no fim; link de país não interpreta autenticação', () => {
  assert.deepEqual(countries.slice().sort((a, b) => Tools.compareCountries(a, b, 'population')).map(c => c.id), ['BR', 'PT', 'VA']);
  const ids = Object.fromEntries(countries.map(c => [c.id, c]));
  assert.equal(Tools.countryFromHash('#pais=PT', ids), 'PT');
  assert.equal(Tools.countryFromHash('#pais=XX', ids), null);
  assert.equal(Tools.countryFromHash('#pais=PT&access_token=private', ids), null);
  assert.equal(Tools.countryFromHash('#pais=__proto__', ids), null);
});

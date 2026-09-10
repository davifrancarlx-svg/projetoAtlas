'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');
const countries = require('../src/countries.base.json');
const now = Date.parse('2026-09-10T12:00:00Z');
const date = '2026-09-10';
const progress = () => Core.createProgress({ now });
const run = (p, event = {}, saved = Core.createAchievements(p)) => Core.evaluateAchievements(saved, p, countries, { now, date, ...event });
function learned(p, id, direction, level = 1) {
  let next = p;
  for (let i = 0; i < level; i++) next = Core.recordAnswer(next, id, direction, true, { now });
  return next;
}

test('catálogo tem 25 IDs únicos, descrição e raridade', () => {
  assert.equal(Core.achievementCatalog.length, 25);
  assert.equal(new Set(Core.achievementCatalog.map(c => c.id)).size, 25);
  Core.achievementCatalog.forEach(c => {
    assert.ok(c.name && c.description);
    assert.ok(['Bronze', 'Prata', 'Ouro', 'Platina'].includes(c.rarity));
  });
});

test('retroação usa somente provas existentes: inéditos, países estudados e recorde', () => {
  let p = progress();
  assert.deepEqual(run(p).added, []);
  p = learned(p, countries[0].id, 'cap');
  assert.ok(run(p).added.includes('first'));
  for (const country of countries.slice(1, 25)) p = learned(p, country.id, 'cap');
  assert.ok(run(p).added.includes('countries25'));
  assert.ok(!run(p).added.includes('countries195'));
  for (const country of countries.slice(25)) p = learned(p, country.id, 'cap');
  p.bestStreak = 25;
  const result = run(p);
  assert.ok(result.added.includes('countries195'));
  assert.ok(result.added.includes('streak25'));
  for (const id of ['typed10', 'exam10', 'exam30', 'backup', 'cloud', 'loupe', 'six']) assert.ok(!result.added.includes(id));
  assert.deepEqual(run(p, {}, result.state).added, []);
});

test('domínio respeita sete direções, regiões completas e 195 países', () => {
  const p = progress();
  for (const country of countries) {
    p.countries[country.id] = { skills: Object.fromEntries(Core.QUESTION_DIRECTIONS.map(d => [d,
      { ...Core.emptySkill(), level: 5, attempts: 5, correct: 5, streak: 5, lastReviewedAt: new Date(now).toISOString(), nextReviewAt: new Date(now + 86400000).toISOString(), intervalDays: 1 }])) };
  }
  assert.equal(Core.validateProgress(p).valid, true);
  const won = run(p).added;
  for (const id of ['master1','master10','region','world','flags','capitals','maps','regions']) assert.ok(won.includes(id), id);
  p.countries[countries[0].id].skills.mapId.level = 4;
  const partial = run(p).added;
  assert.ok(!partial.includes('world'));
  assert.ok(!partial.includes('maps'));
  assert.ok(partial.includes('flags'));
});

test('eventos de treino exigem os limites exatos', () => {
  const p = progress();
  const cases = [
    ['typed10', { type: 'answer', correct: true, typedStreak: 10 }, { type: 'answer', correct: true, typedStreak: 9 }],
    ['last5', { type: 'answer', correct: true, remaining: 5000 }, { type: 'answer', correct: true, remaining: 0 }],
    ['six', { type: 'answer', tries: 6 }, { type: 'answer', tries: 5 }],
    ['review', { type: 'answer', consolidated: true }, { type: 'answer', consolidated: false }],
    ['loupe', { type: 'answer', correct: true, direction: 'locate', id: 'VA', zoom: 60 }, { type: 'answer', correct: true, direction: 'locate', id: 'VA', zoom: 59 }],
    ['theme', { type: 'theme', count: 3 }, { type: 'theme', count: 2 }],
    ['backup', { type: 'backup' }, {}],
    ['cloud', { type: 'cloud', added: true }, { type: 'cloud', added: false }],
    ['exam10', { type: 'exam', total: 10, correct: 10 }, { type: 'exam', total: 10, correct: 9 }],
    ['exam30', { type: 'exam', total: 30, correct: 30 }, { type: 'exam', total: 30, correct: 29 }],
    ['examDone', { type: 'exam', total: 30, correct: 0 }, { type: 'exam', total: 20, correct: 20 }],
  ];
  for (const [id, yes, no] of cases) {
    assert.ok(run(p, yes).added.includes(id), id);
    assert.ok(!run(p, no).added.includes(id), id + ' antes do limite');
  }
  assert.ok(!run(p, { type: 'answer', correct: false, typedStreak: 10, remaining: 1, direction: 'locate', id: 'VA', zoom: 60 }).added.includes('loupe'));
});

test('cinco microestados diferentes, sem duplicar o mesmo país', () => {
  const p = progress();
  let a = Core.createAchievements(p);
  for (const id of ['VA','VA','MC','TV','NR']) a = run(p, { type: 'answer', correct: true, direction: 'locate', id }, a).state;
  assert.ok(!a.unlocked.includes('micro5'));
  a = run(p, { type: 'answer', correct: true, direction: 'locate', id: 'SM' }, a).state;
  assert.ok(a.unlocked.includes('micro5'));
});

test('dívida exige lista inicial não vazia e acertos no mesmo dia', () => {
  const p = learned(progress(), 'BR', 'cap');
  p.countries.BR.skills.cap.nextReviewAt = new Date(now - 1).toISOString();
  let a = run(p).state;
  assert.deepEqual(a.day.due, ['BR:cap']);
  a = run(p, { type: 'answer', correct: false, id: 'BR', direction: 'cap' }, a).state;
  assert.ok(!a.unlocked.includes('debt'));
  a = run(p, { type: 'answer', correct: true, id: 'BR', direction: 'cap' }, a).state;
  assert.ok(a.unlocked.includes('debt'));
  assert.ok(!run(progress(), { type: 'answer', correct: true, id: 'BR', direction: 'cap' }).added.includes('debt'));
});

test('união é determinística, não duplica troféus e reset vence abas antigas', () => {
  const p = progress();
  const a = run(p, { type: 'backup' }).state;
  const b = run(p, { type: 'theme', count: 3 }).state;
  const copy = JSON.stringify(a);
  assert.deepEqual(Core.mergeAchievements(a, b), Core.mergeAchievements(b, a));
  assert.deepEqual(Core.mergeAchievements(a, a), a);
  assert.equal(JSON.stringify(a), copy);
  const reset = Core.resetProgress(p, { now: now + 1 });
  const blank = Core.createAchievements(reset);
  assert.deepEqual(Core.mergeAchievements(a, blank), blank);
  assert.deepEqual(run(reset, {}, a).state.unlocked, []);
});

test('estado inválido é recusado e não contamina conquistas', () => {
  const a = Core.createAchievements(progress());
  for (const bad of [null, {}, { ...a, unlocked: ['inventada'] }, { ...a, unlocked: ['backup','backup'] }, { ...a, generation: -1 }, { ...a, micro: ['BR'] }]) {
    assert.equal(Core.validateAchievements(bad), false);
    assert.throws(() => Core.mergeAchievements(a, bad));
  }
});

test('migration protege a conta e faz união atômica sem tocar no progresso', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/202609100001_conquistas_atlas.sql'), 'utf8');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /on conflict \(usuario\) do update/);
  assert.match(sql, /current\.unlocked \|\| excluded\.unlocked/);
  assert.ok(!sql.includes('public.progresso_atlas'));
  for (const c of Core.achievementCatalog) assert.ok(sql.includes(`'${c.id}'`));
});

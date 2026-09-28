'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Core = require('../src/core.js');

const NOW = '2026-08-14T12:00:00.000Z';
const COUNTRIES = [
  { id: 'BR', n: 'Brasil', cap: 'Brasília', r: 'América do Sul', ar: 8515767, c: [1, 2] },
  { id: 'PT', n: 'Portugal', cap: 'Lisboa', r: 'Europa', ar: 92212, c: [3, 4] },
  { id: 'JM', n: 'Jamaica', cap: 'Kingston', r: 'América do Norte e Central', ar: 10991, c: [5, 6] },
  { id: 'VC', n: 'São Vicente e Granadinas', cap: 'Kingstown', r: 'América do Norte e Central', ar: 389, c: [7, 8] }
];
const IDS = COUNTRIES.map(country => country.id);

function progress() {
  return Core.createProgress({ now: NOW });
}

test('exports the same API to CommonJS and a classic browser global', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'core.js'), 'utf8');
  const context = {};
  vm.runInNewContext(source, context, { filename: 'core.js' });
  assert.equal(typeof context.AtlasCore, 'object');
  assert.equal(context.AtlasCore.normalizeText('São Tomé'), 'sao tome');
  assert.equal(context.AtlasCore.SCHEMA_VERSION, Core.SCHEMA_VERSION);
});

test('normalizes Portuguese text predictably without coercing nullish values', () => {
  assert.equal(Core.normalizeText('  São   Tomé & Príncipe! '), 'sao tome principe');
  assert.equal(Core.norm('Côte-d’Ivoire'), 'cotedivoire');
  assert.equal(Core.normalizeText(null), '');
});

test('computes Levenshtein distance including empty strings', () => {
  assert.equal(Core.levenshtein('kingston', 'kingstown'), 1);
  assert.equal(Core.lev('mapa', 'mapa'), 0);
  assert.equal(Core.levenshtein('', 'atlas'), 5);
});

// Dois países com a mesma capital virariam duas alternativas iguais.
test('dataset invariants detect duplicate IDs and repeated capitals', () => {
  const bad = [
    { id: 'AA', n: 'A', cap: 'Alpha' },
    { id: 'AA', n: 'B', cap: 'Gamma' },
    { id: 'BB', n: 'C', cap: 'Alpha' }
  ];
  const report = Core.inspectDataset(bad);
  assert.equal(report.valid, false);
  assert.match(report.errors.join('\n'), /duplicate id AA/);
  assert.match(report.errors.join('\n'), /capital canonical collision "alpha"/);
  assert.throws(() => Core.assertDatasetInvariants(bad), Core.DatasetInvariantError);
});

test('new progress is a valid, versioned, sparse envelope', () => {
  const value = progress();
  assert.deepEqual(value, {
    schemaVersion: 2,
    generation: 0,
    epoch: '',
    revision: 0,
    updatedAt: NOW,
    bestStreak: 0,
    countries: {}
  });
  assert.deepEqual(Core.validateProgress(value, { countryIds: IDS }), { valid: true, errors: [] });
  assert.equal(Core.createEnvelope(NOW).updatedAt, NOW);
  assert.equal(Core.validateEnvelope(value, IDS).valid, true);
});

test('strict progress validation rejects bad levels, arithmetic, ids and extra data', () => {
  const value = progress();
  value.countries.BR = { skills: { flag: Core.emptySkill() } };
  value.countries.BR.skills.flag.level = 6;
  value.countries.BR.skills.flag.correct = 2;
  value.countries.BR.skills.flag.attempts = 1;
  value.countries.BR.skills.flag.surprise = true;
  value.countries.XX = { skills: {} };
  const result = Core.validateProgress(value, { countryIds: IDS });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /level/);
  assert.match(result.errors.join('\n'), /cannot exceed attempts/);
  assert.match(result.errors.join('\n'), /unknown property/);
  assert.match(result.errors.join('\n'), /unknown country id/);
});

test('legacy family levels migrate into independent directions and are clamped', () => {
  const legacy = {
    prog: { BR: { f: 4, c: 2, l: 99 }, XX: { f: 5 } },
    best: { best: 7 }
  };
  const result = Core.migrateProgressDetailed(legacy, { now: NOW, countryIds: IDS });
  assert.equal(result.migrated, true);
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.progress.bestStreak, 7);
  assert.equal(Core.levelOf(result.progress, 'BR', 'flag'), 4);
  assert.equal(Core.levelOf(result.progress, 'BR', 'flagOf'), 4);
  assert.equal(Core.levelOf(result.progress, 'BR', 'cap'), 2);
  assert.equal(Core.levelOf(result.progress, 'BR', 'capOf'), 2);
  assert.equal(Core.levelOf(result.progress, 'BR', 'locate'), 5);
  assert.equal(Core.levelOf(result.progress, 'BR', 'mapId'), 5);
  assert.equal(result.progress.countries.XX, undefined);
  assert.match(result.warnings.join('\n'), /XX/);

  const changed = Core.recordAnswer(result.progress, 'BR', 'flag', false, { now: NOW, countryIds: IDS });
  assert.equal(Core.levelOf(changed, 'BR', 'flag'), 2);
  assert.equal(Core.levelOf(changed, 'BR', 'flagOf'), 4);
  assert.equal(Core.levelOf(result.progress, 'BR', 'flag'), 4, 'source remains immutable');
});

test('current malformed envelopes are not silently migrated', () => {
  const malformed = progress();
  malformed.schemaVersion = 2;
  malformed.revision = -1;
  assert.throws(() => Core.migrateProgress(malformed), Core.ProgressValidationError);
});

test('serialization is deterministic and corrupt input recovers safely', () => {
  let value = progress();
  value = Core.recordAnswer(value, 'PT', 'flag', true, { now: NOW, countryIds: IDS });
  value = Core.recordAnswer(value, 'BR', 'cap', true, { now: NOW, countryIds: IDS });
  const serialized = Core.serializeProgress(value, { countryIds: IDS });
  assert.ok(serialized.indexOf('"BR"') < serialized.indexOf('"PT"'));
  const restored = Core.deserializeProgress(serialized, { now: NOW, countryIds: IDS });
  assert.equal(restored.recovered, false);
  assert.deepEqual(restored.progress, JSON.parse(serialized));

  const priorV2 = progress();
  delete priorV2.generation;
  delete priorV2.epoch;
  const upgraded = Core.deserializeProgress(JSON.stringify(priorV2), { now: NOW, countryIds: IDS });
  assert.equal(upgraded.recovered, false);
  assert.equal(upgraded.progress.generation, 0);

  const recovered = Core.deserializeProgress('{not json', { now: NOW, countryIds: IDS });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.progress.schemaVersion, 2);
  assert.equal(recovered.errors.length, 1);
});

test('answer updates are immutable, directional, revised and spaced', () => {
  const initial = progress();
  const first = Core.recordAnswer(initial, 'BR', 'flag', true, {
    now: NOW,
    countryIds: IDS,
    bestStreak: 1
  });
  assert.equal(first.revision, 1);
  assert.equal(first.bestStreak, 1);
  assert.equal(Core.levelOf(initial, 'BR', 'flag'), 0);
  assert.equal(Core.levelOf(first, 'BR', 'flag'), 1);
  assert.equal(Core.levelOf(first, 'BR', 'flagOf'), 0);
  assert.equal(Core.skillOf(first, 'BR', 'flag').nextReviewAt, '2026-08-15T12:00:00.000Z');

  const secondNow = '2026-08-15T12:00:00.000Z';
  const second = Core.recordAnswer(first, 'BR', 'flag', true, { now: secondNow, countryIds: IDS });
  assert.equal(Core.skillOf(second, 'BR', 'flag').intervalDays, 3);
  assert.equal(Core.skillOf(second, 'BR', 'flag').nextReviewAt, '2026-08-18T12:00:00.000Z');

  const failed = Core.recordAnswer(second, 'BR', 'flag', false, { now: secondNow, countryIds: IDS });
  assert.equal(Core.levelOf(failed, 'BR', 'flag'), 0);
  assert.equal(Core.skillOf(failed, 'BR', 'flag').streak, 0);
  assert.equal(Core.skillOf(failed, 'BR', 'flag').nextReviewAt, secondNow);
});

test('concurrent browser replicas merge independent skills without resurrecting a reset', () => {
  const initial = progress();
  const left = Core.recordAnswer(initial, 'BR', 'flag', true, {
    now: '2026-08-14T12:01:00.000Z', countryIds: IDS, bestStreak: 1
  });
  const right = Core.recordAnswer(initial, 'PT', 'cap', false, {
    now: '2026-08-14T12:02:00.000Z', countryIds: IDS
  });
  const merged = Core.mergeProgress(left, right, {
    now: '2026-08-14T12:03:00.000Z', countryIds: IDS
  });
  assert.equal(merged.revision, 2);
  assert.equal(Core.skillOf(merged, 'BR', 'flag').attempts, 1);
  assert.equal(Core.skillOf(merged, 'PT', 'cap').attempts, 1);
  assert.equal(merged.bestStreak, 1);
  assert.deepEqual(Core.mergeProgress(merged, right, { countryIds: IDS }), merged);

  const reset = Core.resetProgress(merged, {
    now: '2026-08-14T12:04:00.000Z', resetNonce: 'aaaaaaaa', countryIds: IDS
  });
  assert.deepEqual(Core.mergeProgress(merged, reset, { countryIds: IDS }), reset);

  const afterReset = Core.recordAnswer(reset, 'BR', 'flag', true, {
    now: '2026-08-14T12:05:00.000Z', countryIds: IDS
  });
  const staleReplica = Core.mergeProgress(afterReset, right, { countryIds: IDS });
  assert.deepEqual(Object.keys(staleReplica.countries), ['BR']);
  assert.equal(staleReplica.generation, reset.generation);

  const canonicalBeforeSecondReset = Core.mergeProgress(right, afterReset, { countryIds: IDS });
  const secondReset = Core.resetProgress(canonicalBeforeSecondReset, {
    now: '2026-08-14T12:06:00.000Z', resetNonce: 'bbbbbbbb', countryIds: IDS
  });
  assert.equal(secondReset.generation, 2);
  assert.deepEqual(secondReset.countries, {});
  assert.deepEqual(Core.mergeProgress(secondReset, afterReset, { countryIds: IDS }), secondReset);

  const staleTabReset = Core.resetProgress(right, {
    now: '2026-08-14T12:07:00.000Z', resetNonce: 'cccccccc', countryIds: IDS
  });
  assert.equal(staleTabReset.generation, afterReset.generation);
  assert.deepEqual(Core.mergeProgress(afterReset, staleTabReset, { countryIds: IDS }), staleTabReset);
});

test('a concurrent answer to the same skill keeps the most recently reviewed record', () => {
  const initial = progress();
  const earlier = Core.recordAnswer(initial, 'BR', 'flag', true, {
    now: '2026-08-14T12:01:00.000Z', countryIds: IDS
  });
  const later = Core.recordAnswer(initial, 'BR', 'flag', false, {
    now: '2026-08-14T12:02:00.000Z', countryIds: IDS
  });
  const merged = Core.mergeProgress(earlier, later, { countryIds: IDS });
  assert.deepEqual(Core.skillOf(merged, 'BR', 'flag'), Core.skillOf(later, 'BR', 'flag'));
});

test('due review calculation treats unseen skills and failed answers as due', () => {
  let value = progress();
  value = Core.recordAnswer(value, 'BR', 'cap', true, { now: NOW, countryIds: IDS });
  assert.equal(Core.isDue(Core.skillOf(value, 'BR', 'cap'), NOW), false);
  assert.equal(Core.isDue(Core.skillOf(value, 'BR', 'cap'), '2026-08-15T12:00:00.000Z'), true);
  const due = Core.dueReviews(value, ['BR'], ['cap', 'capOf'], NOW);
  assert.deepEqual(due.map(item => item.direction), ['capOf']);
});

test('weighted selection has injected RNG and direction-specific weights', () => {
  let value = progress();
  for (let index = 0; index < 5; index += 1) {
    value = Core.recordAnswer(value, 'BR', 'flag', true, {
      now: new Date(Date.parse(NOW) + index * 86400000).toISOString(),
      countryIds: IDS
    });
  }
  assert.ok(
    Core.weightForItem({ id: 'PT' }, 'flag', value, { now: NOW }) >
    Core.weightForItem({ id: 'BR' }, 'flag', value, { now: NOW })
  );
  assert.ok(
    Core.weightForItem({ id: 'BR' }, 'flagOf', value, { now: NOW }) >
    Core.weightForItem({ id: 'BR' }, 'flag', value, { now: NOW })
  );
  assert.equal(Core.pickWeighted(COUNTRIES, 'flag', value, { rng: () => 0, weight: () => 1 }).id, 'BR');
  assert.equal(Core.pickWeighted(COUNTRIES, 'flag', value, { rng: () => 0.999999, weight: () => 1 }).id, 'VC');
  assert.throws(
    () => Core.pickWeighted(COUNTRIES, 'flag', value, { rng: () => 1, weight: () => 1 }),
    /\[0, 1\)/
  );
});

test('question creation is deterministic, unique and does not mutate recency', () => {
  const recent = [];
  const result = Core.createQuestion({
    countries: COUNTRIES,
    progress: progress(),
    mode: 'flag',
    region: 'Mundo inteiro',
    recentIds: recent,
    rng: () => 0,
    now: NOW
  });
  assert.equal(result.question.direction, 'flag');
  assert.equal(result.question.id, 'BR');
  assert.equal(result.question.opts.length, 4);
  assert.equal(new Set(result.question.opts).size, 4);
  assert.ok(result.question.opts.includes('BR'));
  assert.deepEqual(recent, []);
  assert.deepEqual(Core.inspectQuestion(result.question, COUNTRIES), { valid: true, errors: [] });
});

// O Atlas só responde por escolha: toda pergunta nasce com as alternativas,
// sem nenhum modo de resposta a informar.
test('every direction is multiple choice without an answer mode', () => {
  for (const direction of ['flag', 'flagOf', 'cap', 'capOf', 'mapId', 'reg']) {
    const { question } = Core.createQuestion({
      countries: COUNTRIES, progress: progress(), directions: [direction], rng: () => 0, now: NOW,
    });
    assert.ok(Array.isArray(question.opts) && question.opts.length >= 2, `${direction} sem alternativas`);
  }
});

test('question creation supports explicit directions and a forced target', () => {
  const result = Core.createQuestion({
    countries: COUNTRIES,
    progress: progress(),
    directions: ['mapId'],
    forcedId: 'VC',
    rng: () => 0,
    now: NOW
  });
  assert.equal(result.question.direction, 'mapId');
  assert.equal(result.question.id, 'VC');
  assert.equal(result.question.opts.length, 4);
  assert.ok(result.question.opts.includes('VC'));
  assert.throws(() => Core.createQuestion({
    countries: COUNTRIES,
    progress: progress(),
    directions: ['mapId'],
    region: 'Europa',
    forcedId: 'VC',
    rng: () => 0
  }), /forcedId/);
});

test('mapa → país alterna entre pin e silhueta, e a silhueta poupa quem não tem forma', () => {
  const make = (rng, countries = COUNTRIES) => Core.createQuestion({
    countries, progress: progress(), directions: ['mapId'], forcedId: 'VC', rng, now: NOW,
  }).question;
  assert.equal(make(() => 0).variant, 'shape');
  assert.equal(make(() => 0.9).variant, 'pin');
  const pequeno = COUNTRIES.map((country) => country.id === 'VC' ? { ...country, a: Core.SHAPE_MIN_AREA / 2 } : country);
  assert.equal(make(() => 0, pequeno).variant, 'pin', 'Um país minúsculo nunca vira silhueta.');
  assert.equal(Core.createQuestion({
    countries: COUNTRIES, progress: progress(), directions: ['flag'], forcedId: 'VC', rng: () => 0, now: NOW,
  }).question.variant, undefined, 'Só mapa → país tem variante.');
});

// "País → mapa" é uma habilidade só, com três evidências: apontar no mapa,
// reconhecer a silhueta e saber quem faz fronteira. Nada disso pode mexer no
// que é gravado no progresso — muda a pergunta, não o registro.
const LOCATE_COUNTRIES = [
  { id: 'BR', n: 'Brasil', cap: 'Brasília', r: 'América do Sul', ar: 1, a: 90, c: [0, 0], nb: ['AR', 'PE'] },
  { id: 'AR', n: 'Argentina', cap: 'Buenos Aires', r: 'América do Sul', ar: 1, a: 60, c: [10, 10], nb: ['BR'] },
  { id: 'PE', n: 'Peru', cap: 'Lima', r: 'América do Sul', ar: 1, a: 50, c: [20, 20], nb: ['BR'] },
  { id: 'PT', n: 'Portugal', cap: 'Lisboa', r: 'Europa', ar: 1, a: 40, c: [900, 100], nb: [] },
  { id: 'ES', n: 'Espanha', cap: 'Madri', r: 'Europa', ar: 1, a: 45, c: [905, 105], nb: [] },
  { id: 'IT', n: 'Itália', cap: 'Roma', r: 'Europa', ar: 1, a: 35, c: [960, 140], nb: [] },
  { id: 'VA', n: 'Vaticano', cap: 'Cidade do Vaticano', r: 'Europa', ar: 1, a: 0, c: [961, 141], nb: [] },
];

function locateQuestion(rng, forcedId = 'BR', countries = LOCATE_COUNTRIES) {
  return Core.createQuestion({
    countries, progress: Core.createProgress({ now: NOW }), directions: ['locate'],
    forcedId, rng, now: NOW,
  }).question;
}

test('país → mapa sorteia mapa, silhueta ou fronteira conforme o que cabe', () => {
  assert.equal(locateQuestion(() => 0).variant, 'map', 'Clicar no mapa fica com metade dos sorteios.');
  assert.equal(locateQuestion(() => 0.6).variant, 'shape');
  assert.equal(locateQuestion(() => 0.9).variant, 'border');
  assert.equal(locateQuestion(() => 0).opts, null, 'A variante de mapa não tem alternativas.');

  // Sem vizinho registrado sobra a silhueta; sem forma no mapa sobra a
  // fronteira; sem nenhum dos dois, o mapa.
  assert.equal(locateQuestion(() => 0.9, 'PT').variant, 'shape', 'Uma ilha não tem fronteira a perguntar.');
  const semForma = LOCATE_COUNTRIES.map((c) => (c.id === 'BR' ? { ...c, a: 0 } : c));
  assert.equal(locateQuestion(() => 0.9, 'BR', semForma).variant, 'border');
  assert.equal(locateQuestion(() => 0.6, 'BR', semForma).variant, 'border');
  assert.equal(locateQuestion(() => 0.9, 'VA').variant, 'map', 'Sem forma e sem vizinho, resta o mapa.');
});

test('a silhueta entre quatro só concorre com quem também tem forma', () => {
  for (let seed = 0; seed < 30; seed += 1) {
    const question = locateQuestion(() => 0.5 + (seed * 0.008));
    if (question.variant !== 'shape') continue;
    assert.equal(question.opts.length, 4);
    assert.ok(question.opts.includes('BR'), 'A resposta é o próprio país da pergunta.');
    assert.equal(question.answerId, undefined, 'Sem resposta deslocada: o alvo é a resposta.');
    question.opts.forEach((id) => {
      const country = LOCATE_COUNTRIES.find((item) => item.id === id);
      assert.ok(Core.isShapeable(country), `${id} não tem forma e não pode ser alternativa.`);
    });
    assert.deepEqual(Core.inspectQuestion(question, LOCATE_COUNTRIES), { valid: true, errors: [] });
  }
});

test('a fronteira tem uma só resposta certa, e ela não é o país da pergunta', () => {
  let testadas = 0;
  for (let seed = 0; seed < 40; seed += 1) {
    const question = locateQuestion(() => 0.75 + (seed * 0.006));
    if (question.variant !== 'border') continue;
    testadas += 1;
    assert.equal(question.opts.length, 4);
    assert.equal(question.opts.includes('BR'), false, 'O país da pergunta não pode ser alternativa.');
    assert.ok(['AR', 'PE'].includes(question.answerId), 'A resposta precisa ser um vizinho real.');
    assert.ok(question.opts.includes(question.answerId));
    const vizinhas = question.opts.filter((id) => ['AR', 'PE'].includes(id));
    assert.deepEqual(vizinhas, [question.answerId], 'Só pode haver uma alternativa que faz fronteira.');
    // O progresso continua sendo do país da pergunta: a evidência mudou, a
    // habilidade não.
    assert.equal(question.id, 'BR');
    assert.equal(question.direction, 'locate');
    assert.deepEqual(Core.inspectQuestion(question, LOCATE_COUNTRIES), { valid: true, errors: [] });
  }
  assert.ok(testadas > 0, 'Nenhuma pergunta de fronteira foi sorteada.');
  // Uma alternativa que não está no dataset precisa ser recusada.
  const quebrada = { ...locateQuestion(() => 0.9), answerId: 'ZZ' };
  assert.equal(Core.inspectQuestion(quebrada, LOCATE_COUNTRIES).valid, false);
});

test('region questions are rejected outside Mundo inteiro', () => {
  assert.throws(() => Core.createQuestion({
    countries: COUNTRIES,
    progress: progress(),
    directions: ['reg'],
    region: 'Europa',
    rng: () => 0
  }), /only available for Mundo inteiro/);
});

test('smart distractors prioritize similar capitals, flags and nearby countries', () => {
  const target = { id: 'AA', n: 'Alfa', cap: 'Kingston', r: 'R1', sr: 'S1', c: [0, 0], fs: ['BB'] };
  const candidates = [
    { id: 'BB', n: 'Beta', cap: 'Muito longe', r: 'R2', sr: 'S2', c: [400, 400] },
    { id: 'CC', n: 'Gama', cap: 'Kingstown', r: 'R2', sr: 'S2', c: [300, 300] },
    { id: 'DD', n: 'Delta', cap: 'Outra', r: 'R1', sr: 'S1', c: [2, 2] },
    { id: 'EE', n: 'Épsilon', cap: 'Capital', r: 'R2', sr: 'S2', c: [250, 250] }
  ];
  assert.equal(Core.distractors(target, 1, candidates, candidates, () => 0, 'flag')[0].id, 'BB');
  assert.equal(Core.distractors(target, 1, candidates, candidates, () => 0, 'cap')[0].id, 'CC');
  assert.equal(Core.distractors(target, 1, candidates, candidates, () => 0, 'mapId')[0].id, 'DD');
});

// A subregião é rótulo de exibição e também área de estudo. O balde amplo tem de
// continuar existindo como opção própria: é ele que o modo "país → região" cobra.
const AREA_COUNTRIES = [
  { id: 'CA', n: 'Canadá', cap: 'Ottawa', r: 'América do Norte, Central e Caribe', sr: 'América do Norte', ar: 1, c: [0, 0] },
  { id: 'GT', n: 'Guatemala', cap: 'Cidade da Guatemala', r: 'América do Norte, Central e Caribe', sr: 'América Central', ar: 1, c: [0, 0] },
  { id: 'CU', n: 'Cuba', cap: 'Havana', r: 'América do Norte, Central e Caribe', sr: 'Caribe', ar: 1, c: [0, 0] },
  { id: 'JM', n: 'Jamaica', cap: 'Kingston', r: 'América do Norte, Central e Caribe', sr: 'Caribe', ar: 1, c: [0, 0] },
  { id: 'PT', n: 'Portugal', cap: 'Lisboa', r: 'Europa', sr: 'Europa', ar: 1, c: [0, 0] }
];

test('as áreas de estudo expõem as subregiões sem esconder o balde amplo', () => {
  const areas = Core.studyAreasOf(AREA_COUNTRIES);
  const rotulos = areas.map(area => area.value);

  assert.ok(rotulos.includes('América do Norte, Central e Caribe'), 'O balde amplo precisa continuar selecionável.');
  assert.deepEqual(
    areas.filter(area => area.subregion).map(area => area.value),
    ['América Central', 'América do Norte', 'Caribe'],
    'As subregiões saem em ordem alfabética estável, não na ordem do dataset.'
  );
  // Onde sr repete r não pode aparecer entrada duplicada.
  assert.equal(rotulos.filter(rotulo => rotulo === 'Europa').length, 1);
  assert.equal(areas.find(area => area.value === 'Europa').subregion, false);
});

test('escolher uma subregião restringe o sorteio sem alterar o balde amplo', () => {
  const ids = AREA_COUNTRIES.map(country => country.id);
  const base = Core.createProgress({ now: NOW });

  const sorteados = new Set();
  for (let seed = 0; seed < 40; seed += 1) {
    const { question } = Core.createQuestion({
      countries: AREA_COUNTRIES,
      directions: ['cap'],
      region: 'Caribe',
      progress: base,
      rng: () => (seed * 0.025) % 1
    });
    sorteados.add(question.id);
  }
  assert.deepEqual([...sorteados].sort(), ['CU', 'JM'], 'Só os países do Caribe podem ser sorteados.');

  const amplo = new Set();
  for (let seed = 0; seed < 40; seed += 1) {
    const { question } = Core.createQuestion({
      countries: AREA_COUNTRIES,
      directions: ['cap'],
      region: 'América do Norte, Central e Caribe',
      progress: base,
      rng: () => (seed * 0.025) % 1
    });
    amplo.add(question.id);
  }
  assert.deepEqual([...amplo].sort(), ['CA', 'CU', 'GT', 'JM'], 'O balde amplo segue cobrindo as três subregiões.');
  assert.ok(ids.length === 5);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');
const Study = require('../src/study.js');
const Feedback = require('../src/feedback.js');
const Tools = require('../src/country-tools.js');
const countries = require('../src/countries.base.json');
const editorial = { ...require('../src/editorial-meta.json'), currencyCodes: require('../data/currency-code-audit.json') };

test('o próximo treino prioriza vencidas, erros da sessão e novidades sem ignorar o conjunto filtrado', () => {
  assert.equal(Study.recommendation({ pending: [1], mistakes: [1], fresh: [1] }).kind, 'due');
  assert.equal(Study.recommendation({ pending: [], mistakes: [1], fresh: [1] }).kind, 'mistakes');
  assert.equal(Study.recommendation({ fresh: [1] }).kind, 'fresh');
  assert.equal(Study.recommendation({}).kind, 'daily');
});

test('destaque da capital conserva o nome inteiro e aponta o trecho diferente', () => {
  for (const [name, other] of [['Bangui', 'Banjul'], ['Kingston', 'Kingstown'], ['Brasília', 'Lisboa'], ['Lima', 'Lima'], ['São Tomé', 'São Paulo']]) {
    const p = Feedback.capitalParts(name, other);
    assert.equal(p.prefix + p.difference + p.suffix, name);
    if (name === other) assert.equal(p.difference, '');
  }
  assert.equal(Feedback.capitalParts('Kingstown', 'Kingston').difference, 'w');
});

test('explicação de bandeira usa características documentadas e não inventa estrelas para outro par', () => {
  const byId = Object.fromEntries(countries.map(c => [c.id, c]));
  assert.match(Feedback.copy(Core, byId.AU, byId.NZ, 'flag', editorial), /Cinco estrelas brancas/);
  assert.match(Feedback.copy(Core, byId.NZ, byId.AU, 'flag', editorial), /Quatro estrelas vermelhas/);
  assert.doesNotMatch(Feedback.copy(Core, byId.FR, byId.IT, 'flag', editorial), /Cinco estrelas|Quatro estrelas/);
  assert.equal(Feedback.copy(Core, byId.AU, byId.AU, 'flag', editorial), null);
});

test('fontes editoriais indicam escopo e cobrem os códigos dos 195 países, sem atribuir revisão a campos não conferidos', () => {
  const currencies = require('../src/currencies.json');
  for (const country of countries) {
    const rows = Tools.editorialEntries({ ...country, moedas: currencies[country.id].moedas }, editorial);
    assert.ok(rows.some(row => row.field === 'Moedas'));
    for (const row of rows) {
      assert.equal(new URL(row.url).protocol, 'https:');
      assert.match(row.checked, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(row.scope.length > 10);
    }
  }
  for (const country of countries) {
    const entries = Tools.editorialEntries({ ...country, moedas: currencies[country.id].moedas }, editorial);
    assert.ok(entries.some(row => row.field === 'Capital'));
    assert.ok(entries.some(row => row.field === 'Idiomas'));
  }
  const archive = Tools.editorialEntries({ id: 'AR' }, editorial).find(row => row.kind === 'archived-reference');
  assert.match(Tools.editorialSourceNote(archive), /Arquivo histórico/);
  assert.doesNotMatch(Tools.editorialSourceNote(archive), /vigência confirmada/);
  assert.deepEqual(Tools.editorialEntries({ id: 'XX', moedas: [{ codigo: 'XXX' }] }, editorial), []);
});

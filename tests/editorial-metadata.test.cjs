'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEditorialMetadata } = require('../scripts/editorial-metadata.cjs');
const countries = require('../src/countries.base.json');
const metadata = require('../src/editorial-meta.json');

test('registro editorial aceita fontes parciais sem exigir uma revisão inexistente', () => {
  assert.equal(validateEditorialMetadata(metadata, countries), metadata);
  assert.doesNotThrow(() => validateEditorialMetadata({ countries: {} }, countries));
});

test('registro editorial rejeita país, escopo, data, URL e campo inválidos ou duplicados', () => {
  const source = metadata.countries.BR.sources[0];
  const invalid = [
    { countries: { XX: { sources: [source] } } },
    ...[{ scope: '' }, { checked: '2026-02-30' }, { checked: 'ontem' },
      { url: 'http://example.org' }, { url: 'https://user:password@example.org' },
      { field: 'Tudo revisado' }, { kind: 'atualidade garantida' }].map(change => ({ countries: { BR: { sources: [{ ...source, ...change }] } } })),
    { countries: { BR: { sources: [source, source] } } },
    { countries: { BR: { flag: { description: '' } } } },
  ];
  for (const meta of invalid) assert.throws(() => validateEditorialMetadata(meta, countries));
});

test('os 195 países têm referências de idiomas e capital; arquivos preservam revisão e hash', () => {
  const audit = require('../data/editorial-reference-audit.json');
  assert.match(audit.archive.revision, /^[a-f0-9]{40}$/);
  assert.equal(Object.keys(audit.countries).length, countries.length);
  for (const country of countries) {
    const record = audit.countries[country.id];
    assert.equal(record.name, country.n);
    const sources = metadata.countries[country.id].sources;
    for (const field of ['Capital', 'Idiomas']) assert.ok(sources.some(s => s.field === field), `${country.id}/${field}`);
    for (const source of sources.filter(s => s.kind === 'archived-reference')) {
      assert.match(record.archive.sha256, /^[a-f0-9]{64}$/);
      assert.equal(source.url, `https://github.com/factbook/factbook.json/blob/${audit.archive.revision}/${record.archive.path}`);
      assert.match(source.scope, /históric/);
    }
  }
});

test('revisão editorial corrige idiomas omitidos e distingue número de idiomas e variantes', () => {
  const languages = require('../src/languages.json');
  assert.deepEqual(languages.KG.oficiais, ['quirguiz', 'russo']);
  assert.ok(languages.MK.oficiais.includes('albanês'));
  assert.equal(languages.LS.oficiais.length, 5);
  assert.ok(languages.LS.oficiais.includes('língua de sinais do Lesoto'));
  assert.match(languages.IN.nota, /22 idiomas, incluindo o hindi/);
  assert.match(languages.MX.nota, /68 agrupamentos linguísticos e 364 variantes/);
  assert.doesNotMatch(languages.BF.nota, /todas.*oficiais/);
  assert.match(require('../src/content-policy.json').HN.capitalNote, /Comayagüela/);
});

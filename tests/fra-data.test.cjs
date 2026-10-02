'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { lerFao, urlFao, TABLE, VARIABLE } = require('../scripts/fra-data.cjs');

function response(forest, land, percentage) {
  return JSON.stringify({ fra: { 2025: { TST: {
    extentOfForest: { 2025: { forestArea: { raw: forest }, totalLandArea: { raw: land } } },
    [TABLE]: { 2025: { [VARIABLE]: { raw: percentage } } },
  } } } });
}

test('FRA distingue zero publicado de dado ausente e valida o denominador', () => {
  assert.deepEqual(lerFao(response('0.00', '2', '0'), ['TST']), { TST: { valor: 0, ano: 2025 } });
  assert.equal(lerFao(response('25', '50', '50'), ['TST']).TST.valor, 50);
  for (const value of [null, '', ' ', 'NaN']) {
    assert.throws(() => lerFao(response(value, '2', '0'), ['TST']), /ausente ou inválido/);
    assert.throws(() => lerFao(response('0', '2', value), ['TST']), /ausente ou inválido/);
  }
  assert.throws(() => lerFao(response('0', '0', '0'), ['TST']), /incompatível/);
  assert.throws(() => lerFao(response('25', '50', '25'), ['TST']), /incompatível/);
  assert.throws(() => lerFao(response('25', '50', '50'), ['XXX']), /ausente/);
  assert.throws(() => lerFao('{}', ['TST']), /ciclo/);
});

test('consulta FRA usa dados publicados e países deduplicados em ordem estável', () => {
  const url = new URL(urlFao(['NZL', 'BRA', 'BRA']));
  assert.equal(url.pathname, '/api/explorer/data');
  assert.deepEqual(url.searchParams.getAll('countryISOs[]'), ['BRA', 'NZL']);
  assert.deepEqual(url.searchParams.getAll('columns[]'), ['2025']);
  assert.deepEqual(url.searchParams.getAll('tableNames[]'), ['extentOfForest', TABLE]);
});

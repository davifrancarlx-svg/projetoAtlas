'use strict';

// As fronteiras são editoriais (src/borders.json) e só existem para a ficha e
// para o contraste didático do erro. O que este arquivo protege: todo par
// aponta para dois dos 195, aparece uma vez, é simétrico depois do build e
// bate com a geografia — os contornos dos dois países precisam se aproximar.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const base = read('src/countries.base.json');
const borders = read('src/borders.json');
const geometry = read('data/map-geometry.json');
const geometryById = new Map((geometry.countries || geometry.features || geometry).map((item) => [item.id, item]));
const ids = new Set(base.map((country) => country.id));

function neighbours() {
  const map = new Map(base.map((country) => [country.id, new Set()]));
  borders.pares.forEach(([a, b]) => { map.get(a).add(b); map.get(b).add(a); });
  return map;
}

test('todo par de fronteira liga dois dos 195, uma vez só e em ordem', () => {
  const seen = new Set();
  borders.pares.forEach((par) => {
    assert.ok(Array.isArray(par) && (par.length === 2 || par.length === 3), `par malformado: ${JSON.stringify(par)}`);
    const [a, b, nota] = par;
    assert.ok(ids.has(a) && ids.has(b), `${a}-${b}: ID fora dos 195`);
    assert.notEqual(a, b, `${a} faz fronteira consigo mesmo`);
    assert.ok(a < b, `${a}-${b}: fora de ordem alfabética`);
    assert.equal(seen.has(`${a}-${b}`), false, `${a}-${b} repetido`);
    seen.add(`${a}-${b}`);
    if (nota !== undefined) assert.match(nota, /^\S.{3,}$/, `${a}-${b}: nota vazia`);
  });
  assert.ok(borders.pares.length >= 300 && borders.pares.length <= 330, `${borders.pares.length} pares foge da contagem esperada de fronteiras terrestres`);
});

test('as contagens conhecidas conferem e ilhas não têm fronteira', () => {
  const nb = neighbours();
  const count = (id) => nb.get(id).size;
  assert.equal(count('CN'), 14, 'A China tem 14 vizinhos terrestres.');
  assert.equal(count('RU'), 14, 'A Rússia tem 14 vizinhos entre os 195.');
  assert.equal(count('BR'), 10, 'O Brasil faz fronteira com 10 (a França pela Guiana Francesa).');
  assert.deepEqual([...nb.get('BR')].sort(), ['AR', 'BO', 'CO', 'FR', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE']);
  assert.equal(count('DE'), 9);
  assert.equal(count('PT'), 1);
  assert.deepEqual([...nb.get('CA')], ['US']);
  ['JP', 'AU', 'NZ', 'IS', 'MG', 'LK', 'CU', 'PH', 'MT', 'CY', 'BH', 'SG', 'MV', 'CV'].forEach((id) => {
    assert.equal(count(id), 0, `${id} é insular e não deveria ter fronteira terrestre.`);
  });
  const semFronteira = base.filter((country) => count(country.id) === 0).length;
  assert.ok(semFronteira >= 35 && semFronteira <= 45, `${semFronteira} países sem fronteira foge do esperado.`);
});

test('cada fronteira é geograficamente plausível: os contornos se aproximam', () => {
  // Rede de segurança contra erro de digitação de ID: os retângulos dos dois
  // países, com folga, precisam se cruzar. Usa o box completo (`b`) porque
  // várias fronteiras acontecem por um pedaço longe da metrópole.
  const margin = 2;
  borders.pares.forEach(([a, b]) => {
    const left = geometryById.get(a).b;
    const right = geometryById.get(b).b;
    const overlap = left[0] - margin <= right[2] && right[0] - margin <= left[2]
      && left[1] - margin <= right[3] && right[1] - margin <= left[3];
    assert.ok(overlap, `${a}-${b}: os contornos não se aproximam no mapa.`);
  });
});

test('o núcleo prefere a fronteira real a "perto no mapa"', () => {
  const brasil = { id: 'BR', n: 'Brasil', cap: 'Brasília', r: 'América do Sul', sr: 'América do Sul', c: [0, 0], nb: ['AR'] };
  const argentina = { id: 'AR', n: 'Argentina', cap: 'Buenos Aires', r: 'América do Sul', sr: 'América do Sul', c: [10, 10] };
  const uruguai = { id: 'UY', n: 'Uruguai', cap: 'Montevidéu', r: 'América do Sul', sr: 'América do Sul', c: [12, 12] };
  assert.equal(Core.confusionReason(brasil, argentina, 'locate'), 'border');
  assert.equal(Core.confusionReason(brasil, uruguai, 'locate'), 'neighbour', 'Sem fronteira registrada, vale a distância.');
});

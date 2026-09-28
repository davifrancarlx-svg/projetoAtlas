'use strict';

// A silhueta mostra a forma real do país, não a do mapa-múndi. A Robinson
// estica o que fica perto dos polos e inclina o que fica longe do meridiano
// central; a Islândia saía quase duas vezes mais larga do que é.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

const ROOT = path.resolve(__dirname, '..');
const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'map-geometry.json'), 'utf8'));
const projection = geometry.meta.projection;
const byId = Object.fromEntries(geometry.countries.map((country) => [country.id, country]));

const aspect = ([x0, y0, x1, y1]) => (x1 - x0) / (y1 - y0);
const real = (id) => aspect(Core.trueShape(byId[id], projection).box);
const onMap = (id) => aspect(byId[id].pb);

test('a Islândia volta à proporção real, que o mapa-múndi quase dobra', () => {
  // 11° de longitude a 65° N dão cerca de 515 km; 3,2° de latitude, 355 km.
  assert.ok(real('IS') > 1.3 && real('IS') < 1.55, `Islândia real: ${real('IS').toFixed(2)}`);
  assert.ok(onMap('IS') > 2.3, `Islândia no mapa: ${onMap('IS').toFixed(2)}`);
});

test('a forma real desfaz o alargamento dos nórdicos e a inclinação do Pacífico', () => {
  for (const id of ['SE', 'NO', 'FI']) {
    assert.ok(real(id) < onMap(id) * 0.8, `${id} continua larga demais: ${real(id).toFixed(2)} contra ${onMap(id).toFixed(2)}`);
  }
  // A Nova Zelândia é mais alta que larga; deitada no mapa, sai mais larga.
  assert.ok(onMap('NZ') > 1, `Nova Zelândia no mapa: ${onMap('NZ').toFixed(2)}`);
  assert.ok(real('NZ') < 0.8, `Nova Zelândia real: ${real('NZ').toFixed(2)}`);
});

test('perto do equador a forma real quase não muda e a ficha não avisa nada', () => {
  for (const id of ['BR', 'EC', 'CD', 'ID']) {
    assert.ok(Core.shapeDistortion(byId[id], projection).ratio < 1.25, id);
    assert.equal(Core.distortionNote(byId[id], projection), null, id);
    assert.ok(Math.abs(real(id) / onMap(id) - 1) < 0.2, `${id}: ${real(id).toFixed(2)} contra ${onMap(id).toFixed(2)}`);
  }
});

test('o recorte continua sendo o aglomerado principal', () => {
  // Com o Alasca e o Havaí, a caixa dos Estados Unidos iria do Pacífico ao
  // Ártico; sem eles, os 48 estados contíguos têm cerca de 4.500 × 2.900 km.
  assert.ok(real('US') > 1.35 && real('US') < 1.7, `Estados Unidos: ${real('US').toFixed(2)}`);
  const shape = Core.trueShape(byId.US, projection);
  assert.ok(shape.d.split('M').length < byId.US.d.split('M').length, 'Anéis fora do aglomerado deviam ficar de fora.');
});

test('o contorno reprojetado é um caminho válido, só com M, L e Z', () => {
  for (const country of geometry.countries) {
    const shape = Core.trueShape(country, projection);
    assert.match(shape.d, /^M/, country.id);
    assert.equal(shape.d.replace(/[-0-9.\s]/g, '').replace(/[MLZ]/g, ''), '', country.id);
    assert.ok(shape.box.every(Number.isFinite) && shape.box[2] > shape.box[0] && shape.box[3] > shape.box[1], country.id);
  }
});

test('a nota da ficha diz qual deformação aconteceu com o país', () => {
  assert.match(Core.distortionNote(byId.IS, projection), /esticada na horizontal: .* perto dos polos/);
  assert.match(Core.distortionNote(byId.NZ, projection), /sai inclinada: .* longe do centro do mapa/);
  assert.match(Core.distortionNote(byId.RU, projection), /esticada na horizontal e inclinada/);
  const avisados = geometry.countries.filter((country) => Core.distortionNote(country, projection));
  assert.ok(avisados.length > 25 && avisados.length < 45, `${avisados.length} países com nota`);
  avisados.forEach((country) => assert.doesNotMatch(Core.distortionNote(country, projection), /deformada:/, country.id));
});

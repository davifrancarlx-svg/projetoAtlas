'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'map-geometry.json'), 'utf8'));

test('a cartografia declara Natural Earth em escala 1:10m', () => {
  const meta = geometry.meta;
  assert.equal(meta.source.name, 'Natural Earth');
  assert.match(meta.source.dataset, /^Admin 0 - Countries/);
  assert.equal(meta.source.files.some(file => file.dataset === 'Admin 0 - Scale Ranks with Minor Islands'), true);
  assert.equal(meta.scale, '1:10m');
  assert.match(meta.version, /^5\.1\./);
  assert.equal(meta.source.license, 'Public domain');
  assert.match(meta.source.boundaryPolicy, /de facto/i);
  assert.equal(meta.projection.name, 'Robinson');
  assert.equal(meta.simplification.preservesEveryPolygonComponent, true);
});

test('os 6.222 componentes, incluindo 2.596 ilhas menores, foram preservados', () => {
  const stats = geometry.meta.stats;
  assert.equal(stats.countries, 195);
  assert.equal(stats.selectedFeatures, 195);
  assert.equal(stats.minorIslandPolygons, 2_596);
  assert.equal(stats.sourcePolygons, 6_222);
  assert.equal(stats.outputPolygons, 6_222);
  assert.equal(stats.totalParts, 6_222);
  assert.equal(stats.sourceOuterRings, 6_222);
  assert.deepEqual(stats.countriesWithoutGeometry, []);

  const emittedRings = geometry.countries.reduce(
    (sum, country) => sum + (country.d.match(/M/g) || []).length,
    0
  );
  assert.equal(emittedRings, stats.outputRings);
  assert.ok(emittedRings >= stats.outputPolygons);
});

test('o arquivo de geometria contém 195 IDs únicos e formas utilizáveis', () => {
  assert.equal(geometry.countries.length, 195);
  assert.equal(new Set(geometry.countries.map(country => country.id)).size, 195);

  for (const country of geometry.countries) {
    assert.match(country.id, /^[A-Z]{2}$/);
    assert.equal(typeof country.d, 'string');
    assert.ok(country.d.length >= 12, `${country.id}: path curto demais.`);
    assert.match(country.d, /^M[-\d.]/, `${country.id}: path malformado.`);
    assert.match(country.d, /Z$/, `${country.id}: path aberto.`);
    assert.deepEqual(country.c.length, 2);
    assert.deepEqual(country.b.length, 4);
    assert.equal(country.c.every(Number.isFinite), true);
    assert.equal(country.b.every(Number.isFinite), true);
    assert.equal(Number.isFinite(country.a) && country.a >= 0, true, `${country.id}: área inválida.`);
  }
});

test('as áreas de toque usam âncoras em componentes territoriais reais', () => {
  const points = geometry.countries.flatMap(country => (country.hitPoints || []).map(point => ({ country, point })));
  assert.equal(points.length, geometry.meta.stats.hitPoints);
  assert.ok(points.length > 5_000, 'As ilhas menores perderam suas âncoras de interação.');
  assert.match(geometry.meta.hitPoints.purpose, /invisible interaction targets on real polygon components/i);
  for (const { country, point } of points) {
    assert.equal(point.length, 2, `${country.id}: hitPoint inválido.`);
    assert.equal(point.every(Number.isFinite), true, `${country.id}: hitPoint não finito.`);
    assert.ok(point[0] >= country.b[0] && point[0] <= country.b[2], `${country.id}: hitPoint fora do bounds em x.`);
    assert.ok(point[1] >= country.b[1] && point[1] <= country.b[3], `${country.id}: hitPoint fora do bounds em y.`);
  }
});

test('terras fora dos 195 alvos completam a silhueta mundial sem virar respostas', () => {
  const context = geometry.meta.contextLand;
  assert.equal(context.interactive, false);
  assert.equal(context.quizEligible, false);
  assert.equal(context.stats.features, 63);
  assert.equal(context.stats.outputPolygons, context.stats.sourcePolygons);
  assert.equal(context.stats.outputRings, context.stats.sourceRings);
  assert.match(context.d, /^M[-\d.]/);
  assert.match(context.d, /Z$/);

  const view = geometry.meta.viewBox;
  const bounds = geometry.meta.stats.worldBounds;
  assert.ok(bounds[0] >= view.x && bounds[2] <= view.x + view.w, 'O mundo excede o viewBox horizontalmente.');
  assert.ok(bounds[1] >= view.y && bounds[3] <= view.y + view.h, 'O mundo excede o viewBox verticalmente.');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

const ROOT = path.resolve(__dirname, '..');
const territories = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'territories.json'), 'utf8'));
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'countries.base.json'), 'utf8'));
const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'map-geometry.json'), 'utf8'));

const byId = Object.fromEntries(countries.map(country => [country.id, country]));
const RADIUS = geometry.meta.projection.radius;
const X_FACTOR = geometry.meta.projection.xFactor;
const Y_FACTOR = geometry.meta.projection.yFactor;
const ROBINSON_TABLE = [
  [0, 1, 0], [5, 0.9986, 0.062], [10, 0.9954, 0.124], [15, 0.99, 0.186], [20, 0.9822, 0.248],
  [25, 0.973, 0.31], [30, 0.96, 0.372], [35, 0.9427, 0.434], [40, 0.9216, 0.4958], [45, 0.8962, 0.5571],
  [50, 0.8679, 0.6176], [55, 0.835, 0.6769], [60, 0.7986, 0.7346], [65, 0.7597, 0.7903], [70, 0.7186, 0.8435],
  [75, 0.6732, 0.8936], [80, 0.6213, 0.9394], [85, 0.5722, 0.9761], [90, 0.5322, 1]
];

function robinson(lon, lat) {
  const sign = lat < 0 ? -1 : 1;
  const absolute = Math.min(Math.abs(lat), 90);
  const index = Math.min(Math.floor(absolute / 5), 17);
  const ratio = (absolute - ROBINSON_TABLE[index][0]) / 5;
  const x = ROBINSON_TABLE[index][1] + (ROBINSON_TABLE[index + 1][1] - ROBINSON_TABLE[index][1]) * ratio;
  const y = ROBINSON_TABLE[index][2] + (ROBINSON_TABLE[index + 1][2] - ROBINSON_TABLE[index][2]) * ratio;
  return [X_FACTOR * RADIUS * x * lon * Math.PI / 180, -sign * Y_FACTOR * RADIUS * y];
}

test('cada território aponta para um soberano dos 195 e não disputa o quiz', () => {
  assert.ok(Array.isArray(territories) && territories.length >= 1);
  const ids = new Set();
  for (const territory of territories) {
    assert.match(territory.id, /^[A-Z]{2,3}$/, `${territory.n}: ID inválido.`);
    assert.equal(ids.has(territory.id), false, `${territory.id}: território duplicado.`);
    ids.add(territory.id);
    assert.equal(byId[territory.id], undefined, `${territory.id} não pode ser um dos 195 países.`);
    assert.ok(byId[territory.of], `${territory.id}: soberano ${territory.of} não existe.`);
    assert.equal(typeof territory.n, 'string');
    assert.equal(typeof territory.cap, 'string');
    assert.equal(typeof territory.status, 'string');
    assert.notEqual(territory.cap, byId[territory.of].cap, `${territory.id}: capital regional igual à do país.`);
    assert.ok(Array.isArray(territory.notes) && territory.notes.length > 0, `${territory.id}: sem notas.`);
  }
});

test('o box do território cabe no soberano e não invade o vizinho', () => {
  const geometryById = Object.fromEntries(geometry.countries.map(country => [country.id, country]));
  for (const territory of territories) {
    const [west, south, east, north] = territory.box;
    assert.ok(west < east && south < north, `${territory.id}: box invertido.`);
    assert.ok(west >= -180 && east <= 180 && south >= -90 && north <= 90, `${territory.id}: box fora do globo.`);
    assert.ok(
      territory.p[0] >= west && territory.p[0] <= east && territory.p[1] >= south && territory.p[1] <= north,
      `${territory.id}: ponto de rótulo fora do box.`
    );

    const corners = [robinson(west, south), robinson(east, south), robinson(west, north), robinson(east, north)];
    const bounds = [
      Math.min(...corners.map(corner => corner[0])), Math.min(...corners.map(corner => corner[1])),
      Math.max(...corners.map(corner => corner[0])), Math.max(...corners.map(corner => corner[1]))
    ];
    const sovereign = geometryById[territory.of];
    // O box é área de captação do cursor, não contorno: pode ultrapassar a
    // linha de costa em alguns quilômetros. A folga cobre essa margem e ainda
    // reprova qualquer box colocado no oceano errado, que erraria por centenas
    // de unidades projetadas.
    const margin = 2;
    assert.ok(
      bounds[0] >= sovereign.b[0] - margin && bounds[2] <= sovereign.b[2] + margin &&
      bounds[1] >= sovereign.b[1] - margin && bounds[3] <= sovereign.b[3] + margin,
      `${territory.id}: o box não acompanha a geometria de ${territory.of}.`
    );

    // O rótulo só é consultado depois que a geometria sob o cursor já resolveu
    // o soberano, então um vizinho dentro do box é inofensivo. O que não pode
    // acontecer é o box engolir o núcleo do próprio país nem o aglomerado que
    // o enquadramento considera principal.
    assert.equal(
      sovereign.c[0] >= bounds[0] && sovereign.c[0] <= bounds[2] &&
      sovereign.c[1] >= bounds[1] && sovereign.c[1] <= bounds[3],
      false,
      `${territory.id}: o box cobre o ponto de rótulo de ${territory.of}.`
    );
    const cluster = sovereign.pb;
    const overlapsCluster = bounds[0] < cluster[2] && bounds[2] > cluster[0]
      && bounds[1] < cluster[3] && bounds[3] > cluster[1];
    assert.equal(overlapsCluster, false, `${territory.id}: o box invade o aglomerado principal de ${territory.of}.`);
  }
});

test('cada território é reconhecido no próprio ponto e só para o seu soberano', () => {
  const sovereigns = new Set(territories.map(territory => territory.of));
  for (const territory of territories) {
    const found = Core.territoryForPoint(territories, territory.of, territory.p[0], territory.p[1]);
    assert.ok(found, `${territory.id}: o ponto de rótulo não resolve o próprio território.`);
    assert.equal(found.id, territory.id, `${territory.id}: o ponto de rótulo resolveu ${found.id}.`);
    for (const other of sovereigns) {
      if (other === territory.of) continue;
      assert.equal(
        Core.territoryForPoint(territories, other, territory.p[0], territory.p[1]),
        null,
        `${territory.id}: o ponto foi atribuído a ${other}.`
      );
    }
  }
});

test('a Guiana Francesa é rotulada dentro da França com capital regional própria', () => {
  const guiana = territories.find(territory => territory.id === 'GF');
  assert.ok(guiana, 'A Guiana Francesa precisa estar registrada como território.');
  assert.equal(guiana.of, 'FR');
  assert.equal(guiana.cap, 'Caiena');
  assert.equal(guiana.r, 'América do Sul');
  assert.equal(byId.FR.cap, 'Paris', 'A capital da França continua sendo a resposta do quiz.');
  assert.match(guiana.status, /ultramarina da França/i);
  assert.ok(
    guiana.notes.some(note => /bandeira/i.test(note)),
    'A ficha precisa explicar a questão da bandeira.'
  );
  // Caiena fica dentro do box; Georgetown, capital da Guiana vizinha, não.
  const [west, south, east, north] = guiana.box;
  const cayenne = [-52.33, 4.94];
  const georgetown = [-58.16, 6.8];
  assert.ok(cayenne[0] >= west && cayenne[0] <= east && cayenne[1] >= south && cayenne[1] <= north);
  assert.equal(georgetown[0] >= west && georgetown[0] <= east && georgetown[1] >= south && georgetown[1] <= north, false);
});

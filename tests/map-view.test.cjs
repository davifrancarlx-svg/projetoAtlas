'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

const ROOT = path.resolve(__dirname, '..');
const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'map-geometry.json'), 'utf8'));
const territories = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'territories.json'), 'utf8'));
const view = geometry.meta.viewBox;
const WORLD = { x: view.x, y: view.y, w: view.w, h: view.h };
const MAX_ZOOM = 60;
const OPTIONS = { minimumWidth: WORLD.w / MAX_ZOOM };
const WORLD_VIEW = { x: WORLD.x, y: WORLD.y, w: WORLD.w, h: WORLD.h };

function zoomTo(limit, center) {
  let current = WORLD_VIEW;
  for (let step = 0; step < 400; step += 1) current = Core.zoomView(current, 1.4, center, WORLD, OPTIONS);
  assert.ok(Math.abs(current.w - limit) < 1e-9, 'o zoom deveria ter atingido o limite');
  return current;
}

test('a projeção Robinson volta às coordenadas de origem', () => {
  const places = [[-52.33, 4.94], [2.35, 48.86], [174.77, -36.85], [-58.38, -34.6], [18.42, -33.92], [0, 0]];
  for (const [longitude, latitude] of places) {
    const projected = Core.project(longitude, latitude, geometry.meta.projection);
    const restored = Core.unproject(projected[0], projected[1], geometry.meta.projection);
    assert.ok(Math.abs(restored[0] - longitude) < 0.02, `longitude ${longitude} -> ${restored[0]}`);
    assert.ok(Math.abs(restored[1] - latitude) < 0.02, `latitude ${latitude} -> ${restored[1]}`);
  }
});

test('o mundo inteiro cabe no viewBox projetado', () => {
  for (const country of geometry.countries) {
    assert.ok(country.b[0] >= WORLD.x - 0.5 && country.b[2] <= WORLD.x + WORLD.w + 0.5, `${country.id} escapa em x`);
    assert.ok(country.b[1] >= WORLD.y - 0.5 && country.b[3] <= WORLD.y + WORLD.h + 0.5, `${country.id} escapa em y`);
  }
});

test('o zoom mantém o ponto ancorado sob o cursor', () => {
  const anchor = [120, -60];
  let current = WORLD_VIEW;
  for (let step = 0; step < 8; step += 1) {
    const before = (anchor[0] - current.x) / current.w;
    current = Core.zoomView(current, 1.35, anchor, WORLD, OPTIONS);
    const after = (anchor[0] - current.x) / current.w;
    assert.ok(Math.abs(after - before) < 1e-9, 'a âncora deslizou durante o zoom');
  }
});

test('no limite máximo o zoom para em vez de deslizar o mapa', () => {
  const anchor = [120, -60];
  const limited = zoomTo(WORLD.w / MAX_ZOOM, anchor);
  const again = Core.zoomView(limited, 1.4, anchor, WORLD, OPTIONS);
  assert.deepEqual(again, limited, 'o mapa continuou se movendo depois do limite de zoom');

  // O mesmo vale com a âncora deslocada: era esse o caminho do defeito.
  const moved = Core.zoomView(limited, 1.4, [limited.x + 2, limited.y + 1], WORLD, OPTIONS);
  assert.deepEqual(moved, limited, 'uma âncora fora do centro voltou a deslizar o mapa');
});

test('no limite mínimo o mundo inteiro permanece estável', () => {
  const zoomedOut = Core.zoomView(WORLD_VIEW, 1 / 4, [300, 100], WORLD, OPTIONS);
  assert.equal(zoomedOut.w, WORLD.w);
  assert.equal(zoomedOut.x, WORLD.x);
  assert.equal(zoomedOut.y, WORLD.y);
});

test('a janela nunca escapa do mundo, mesmo com pedidos absurdos', () => {
  const cases = [
    { x: -99999, y: -99999, w: 40, h: 0 },
    { x: 99999, y: 99999, w: 40, h: 0 },
    { x: 0, y: 0, w: 0.0001, h: 0 },
    { x: 0, y: 0, w: 99999, h: 0 }
  ];
  for (const candidate of cases) {
    const clamped = Core.clampView(candidate, WORLD, OPTIONS);
    assert.ok(clamped.w >= OPTIONS.minimumWidth - 1e-9 && clamped.w <= WORLD.w + 1e-9, 'largura fora dos limites');
    assert.ok(clamped.x >= WORLD.x - 1e-9, 'janela escapou à esquerda');
    assert.ok(clamped.x + clamped.w <= WORLD.x + WORLD.w + 1e-9, 'janela escapou à direita');
    assert.ok(clamped.y >= WORLD.y - 1e-9, 'janela escapou acima');
    assert.ok(clamped.y + clamped.h <= WORLD.y + WORLD.h + 1e-9, 'janela escapou abaixo');
    assert.ok(Math.abs(clamped.h - clamped.w * WORLD.h / WORLD.w) < 1e-9, 'proporção do mundo perdida');
  }
});

test('o enquadramento usa o aglomerado principal e ignora territórios distantes', () => {
  const byId = Object.fromEntries(geometry.countries.map(country => [country.id, country]));
  // Países cujo bounding box completo abria o mundo inteiro.
  for (const id of ['US', 'FR', 'NO', 'NZ', 'FJ', 'KI', 'NL', 'PT', 'EC']) {
    const country = byId[id];
    const full = Core.fitBox(country.b, WORLD, { ...OPTIONS, floorWidth: WORLD.w / 22 });
    const primary = Core.fitBox(country.pb, WORLD, { ...OPTIONS, floorWidth: WORLD.w / 22 });
    assert.ok(primary.w < full.w, `${id}: o aglomerado principal não melhorou o enquadramento`);
    assert.ok(
      country.c[0] >= primary.x && country.c[0] <= primary.x + primary.w &&
      country.c[1] >= primary.y && country.c[1] <= primary.y + primary.h,
      `${id}: o país saiu do próprio enquadramento`
    );
  }
});

test('todo país continua visível dentro do enquadramento calculado', () => {
  for (const country of geometry.countries) {
    const box = country.pb || country.b;
    const fitted = Core.fitBox(box, WORLD, { ...OPTIONS, floorWidth: WORLD.w / 22 });
    const visibleWidth = Math.min(box[2], fitted.x + fitted.w) - Math.max(box[0], fitted.x);
    const visibleHeight = Math.min(box[3], fitted.y + fitted.h) - Math.max(box[1], fitted.y);
    assert.ok(visibleWidth > 0 && visibleHeight > 0, `${country.id}: aglomerado fora do quadro`);
    assert.ok(
      visibleWidth >= Math.min(box[2] - box[0], fitted.w) * 0.98,
      `${country.id}: o aglomerado principal foi cortado horizontalmente`
    );
  }
});

test('o território só é reconhecido dentro do próprio soberano', () => {
  const guiana = territories.find(territory => territory.id === 'GF');
  assert.equal(Core.territoryForPoint(territories, 'FR', -53.2, 4).id, 'GF');
  assert.equal(Core.territoryForPoint(territories, 'FR', 2.35, 48.86), null, 'Paris não é território');
  assert.equal(Core.territoryForPoint(territories, 'SR', -53.2, 4), null, 'o box não pode valer para o vizinho');
  assert.equal(Core.territoryForPoint(territories, 'FR', NaN, 4), null);
  assert.equal(Core.territoryForPoint(null, 'FR', -53.2, 4), null);
  assert.equal(guiana.of, 'FR');
});

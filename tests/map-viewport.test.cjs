'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');
const Viewport = require('../src/map-viewport.js');

function fixture() {
  const WORLD = { x: 0, y: 0, w: 1000, h: 500 };
  const mapState = { view: { ...WORLD }, metrics: null, microMarkers: [] };
  const rect = { left: 20, top: 30, width: 360, height: 360 };
  const frames = [];
  const dom = { map: { getBoundingClientRect: () => ({ ...rect }), setAttribute() {} },
    zoomIn: {}, zoomOut: {}, zoomReset: {} };
  const api = Viewport.create({ Core, mapState, state: { view: 'quiz' }, dom, byId: {},
    WORLD, MIN_VIEW_WIDTH: 20, MICRO_MARKER_ZOOM: 5, robinson: (x, y) => [x, y],
    actions: { updateReadout() {} }, environment: { requestAnimationFrame: callback => frames.push(callback) },
  });
  return { api, mapState, rect, frames, dom };
}

test('toque considera as margens do SVG e relê a posição após rolar a página', () => {
  const { api, rect } = fixture();
  // SVG de proporção 2:1 em caixa quadrada: a metade vertical é margem.
  assert.deepEqual(api.screenToWorld(200, 210), [500, 250]);
  rect.top -= 100;
  assert.deepEqual(api.screenToWorld(200, 110), [500, 250]);
});

test('pan agrupa movimentos no mesmo frame e zoom mantém limites e controles', () => {
  const { api, mapState, frames, dom } = fixture();
  api.schedulePan(100, 50, 400);
  api.schedulePan(200, 80, 300);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(mapState.view.w, 300);
  assert.equal(mapState.pendingPan, null);
  api.zoomAt(1000);
  assert.equal(mapState.view.w, 20);
  assert.equal(dom.zoomIn.disabled, true);
  api.resetMapView();
  assert.equal(mapState.view.w, 1000);
  assert.equal(dom.zoomOut.disabled, true);
  assert.equal(dom.zoomReset.disabled, true);
});

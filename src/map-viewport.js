(function (root) {
  'use strict';
  // Enquadramento e escala visual usam o mesmo estado que a detecção de toque.
  // O módulo não responde perguntas nem altera o progresso do jogador.
  function create({ Core, mapState, state, dom, byId, WORLD, MIN_VIEW_WIDTH, MICRO_MARKER_ZOOM, robinson, actions, environment = root }) {
    const requestAnimationFrame = environment.requestAnimationFrame.bind(environment);
    function renderedScale() {
      return mapMetrics().scale;
    }

    function mapMetrics(refreshPosition = false) {
      if (mapState.metrics && !refreshPosition) return mapState.metrics;
      const rect = dom.map.getBoundingClientRect();
      const scale = rect.width && rect.height ? Math.min(rect.width / mapState.view.w, rect.height / mapState.view.h) : 1;
      mapState.metrics = {
        rect, scale,
        offsetX: (rect.width - mapState.view.w * scale) / 2,
        offsetY: (rect.height - mapState.view.h * scale) / 2,
      };
      return mapState.metrics;
    }

    function updateMapScaleSensitiveElements() {
      const unitsPerPixel = 1 / Math.max(.0001, renderedScale());
      if (mapState.reticle && mapState.reticlePoint) {
        const [x, y] = mapState.reticlePoint;
        mapState.reticle.setAttribute('transform', `translate(${x} ${y}) scale(${unitsPerPixel.toFixed(5)})`);
      }
      const zoom = WORLD.w / mapState.view.w;
      if (mapState.markers) mapState.markers.classList.toggle('shows-micro', zoom >= MICRO_MARKER_ZOOM);
      mapState.microMarkers.forEach(({ marker, point }) => {
        marker.setAttribute('transform', `translate(${point[0]} ${point[1]}) scale(${unitsPerPixel.toFixed(5)})`);
      });
    }

    const VIEW_OPTIONS = { minimumWidth: MIN_VIEW_WIDTH };

    function applyMapView(view) {
      mapState.view = view;
      dom.map.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      mapState.metrics = null;
      updateMapScaleSensitiveElements();
      updateZoomControls();
      actions.updateReadout();
    }

    function setMapView(x, y, width) {
      applyMapView(Core.clampView({ x, y, w: width, h: width * WORLD.h / WORLD.w }, WORLD, VIEW_OPTIONS));
    }

    function zoomAt(factor, center) {
      const selected = state.view === 'atlas' && byId[state.atlasSelected]?.c;
      if (!center && selected && pointInView(selected)) center = selected;
      applyMapView(Core.zoomView(mapState.view, factor, center, WORLD, VIEW_OPTIONS));
    }

    function pointInView([x, y]) {
      const v = mapState.view;
      const margin = v.w * 0.015;
      return x >= v.x + margin && x <= v.x + v.w - margin
        && y >= v.y + margin && y <= v.y + v.h - margin;
    }

    function updateZoomControls() {
      const atMaximum = mapState.view.w <= MIN_VIEW_WIDTH + 1e-6;
      const atMinimum = mapState.view.w >= WORLD.w - 1e-6;
      if (dom.zoomIn) dom.zoomIn.disabled = atMaximum;
      if (dom.zoomOut) dom.zoomOut.disabled = atMinimum;
      if (dom.zoomReset) dom.zoomReset.disabled = atMinimum
        && mapState.view.x <= WORLD.x + 1e-6 && mapState.view.y <= WORLD.y + 1e-6;
    }
    function resetMapView() { setMapView(WORLD.x, WORLD.y, WORLD.w); }

    // O enquadramento usa o aglomerado principal do país (`pb`), não o bounding
    // box completo: senão Alasca, Guiana Francesa ou Svalbard forçam a visão do
    // mundo inteiro e o país "enquadrado" some no meio do oceano.
    function fitArea(countries) {
      if (!countries.length) return resetMapView();
      const boxes = countries.map(c => c.pb || c.b);
      const box = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])),
        Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
      applyMapView(Core.fitBox(box, WORLD, { ...VIEW_OPTIONS, floorWidth: WORLD.w / 22 }));
    }

    function fitCountry(id) {
      const country = byId[id];
      if (!country) return;
      const box = Array.isArray(country.pb) && country.pb.length === 4 ? country.pb : country.b;
      // Microestado enquadrado a 14× continuava com menos de um pixel de largura.
      // Com o teto em 60× o piso deles desce para 45×, o suficiente para a forma
      // aparecer sem perder a referência regional em volta.
      applyMapView(Core.fitBox(box, WORLD, {
        ...VIEW_OPTIONS, floorWidth: country.a < 5 ? WORLD.w / 45 : WORLD.w / 22,
      }));
    }

    // O box do território vem em graus; a projeção Robinson curva os paralelos,
    // então os quatro cantos são projetados antes de virar um retângulo.
    function territoryBounds(territory) {
      const corners = [
        robinson(territory.box[0], territory.box[1]), robinson(territory.box[2], territory.box[1]),
        robinson(territory.box[0], territory.box[3]), robinson(territory.box[2], territory.box[3]),
      ];
      const xs = corners.map((corner) => corner[0]);
      const ys = corners.map((corner) => corner[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }

    function territoryPoint(territory) { return robinson(territory.p[0], territory.p[1]); }

    function fitTerritory(territory) {
      applyMapView(Core.fitBox(territoryBounds(territory), WORLD, { ...VIEW_OPTIONS, floorWidth: WORLD.w / 40 }));
    }

    function screenToWorld(clientX, clientY, providedMetrics) {
      const metrics = providedMetrics || mapMetrics(true);
      return [mapState.view.x + (clientX - metrics.rect.left - metrics.offsetX) / metrics.scale,
        mapState.view.y + (clientY - metrics.rect.top - metrics.offsetY) / metrics.scale];
    }

    function schedulePan(x, y, width) {
      mapState.pendingPan = { x, y, width };
      if (mapState.panFrame) return;
      mapState.panFrame = requestAnimationFrame(() => {
        mapState.panFrame = 0;
        const pending = mapState.pendingPan;
        mapState.pendingPan = null;
        if (pending) setMapView(pending.x, pending.y, pending.width);
      });
    }


    return { renderedScale, mapMetrics, updateMapScaleSensitiveElements, setMapView, zoomAt, pointInView, resetMapView, fitArea, fitCountry, territoryBounds, territoryPoint, fitTerritory, screenToWorld, schedulePan };
  }
  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AtlasMapViewport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

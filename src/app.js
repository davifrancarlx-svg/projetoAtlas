(() => {
  'use strict';

  const Core = globalThis.AtlasCore;
  if (!Core) throw new Error('AtlasCore não foi carregado.');

  const IDS = DATA.map((country) => country.id);
  const byId = Object.fromEntries(DATA.map((country) => [country.id, country]));
  const REGIONS = ['Mundo inteiro', ...new Set(DATA.map((country) => country.r))];
  const DIRECTIONS = ['flag', 'flagOf', 'cap', 'capOf', 'locate', 'mapId'];
  const MODE_DIRECTIONS = {
    mix: DIRECTIONS,
    flag: ['flag', 'flagOf'],
    cap: ['cap', 'capOf'],
    loc: ['locate', 'mapId'],
  };
  const VISUAL_DIRECTIONS = new Set(['flag', 'flagOf', 'locate', 'mapId']);
  const FAMILY_DIRECTIONS = {
    Bandeiras: ['flag', 'flagOf'],
    Capitais: ['cap', 'capOf'],
    Localização: ['locate', 'mapId'],
  };
  const DIRECTION_LABEL = {
    flag: 'bandeira → país', flagOf: 'país → bandeira',
    cap: 'país → capital', capOf: 'capital → país',
    locate: 'país → mapa', mapId: 'mapa → país',
  };
  const STORAGE_KEY = 'atlas195:v2';
  const PREFS_KEY = 'atlas195:prefs:v2';
  const LEGACY_PROGRESS_KEY = 'atlas195:prog';
  const LEGACY_BEST_KEY = 'atlas195:best';
  const RESET_LOCK_KEY = 'atlas195:progress-reset';
  const NS = 'http://www.w3.org/2000/svg';
  const metaView = MAP_META && MAP_META.viewBox ? MAP_META.viewBox : {};
  const WORLD = {
    x: numberOr(metaView.x, -508), y: numberOr(metaView.y, -256),
    w: numberOr(metaView.w, 1018), h: numberOr(metaView.h, 440),
  };
  const HIT_GRID_SIZE = 24;

  const dom = {
    shell: document.getElementById('appShell'),
    topbar: document.querySelector('.topbar'),
    tabs: [...document.querySelectorAll('.tab[data-view]')],
    controls: document.getElementById('controls'),
    filterToggle: document.getElementById('filterToggle'),
    modeSeg: document.getElementById('modeSeg'),
    region: document.getElementById('regSel'),
    ansSeg: document.getElementById('ansSeg'),
    visualToggle: document.getElementById('visualToggle'),
    mapRegion: document.getElementById('mapRegion'),
    mapToggle: document.getElementById('mapToggle'),
    skipVisual: document.getElementById('skipVisualBtn'),
    stage: document.getElementById('main-content'),
    mapWrap: document.getElementById('mapwrap'),
    map: document.getElementById('map'),
    hoverName: document.getElementById('hoverName'),
    readout: document.getElementById('readout'),
    zoomIn: document.getElementById('zIn'),
    zoomOut: document.getElementById('zOut'),
    zoomReset: document.getElementById('zRst'),
    panel: document.getElementById('panel'),
    scorebar: document.getElementById('scorebar'),
    liveStatus: document.getElementById('liveStatus'),
    storageStatus: document.getElementById('storageStatus'),
  };

  const state = {
    ready: false, view: 'quiz', mode: 'mix', region: 'Mundo inteiro', answerMode: 'pick',
    includeVisual: true, mapCollapsed: false, question: null, questionAnswerMode: 'pick', answered: false,
    selectedAnswer: null, answerMatch: null, hits: 0, misses: 0, streak: 0,
    questionNumber: 0, recentIds: [], forcedQuestion: null,
    atlasSelected: 'BR', atlasQuery: '', atlasLimit: 60, resetArmed: false, resetPending: false,
    mapCursorId: 'BR',
  };

  let progress = Core.createProgress();
  let saveTimer = 0;
  let saveChain = Promise.resolve();
  let atlasSearchTimer = 0;
  let announcementTimer = 0;
  let resetSyncDirty = false;
  const pendingStorageValues = [];
  let atlasElements = null;

  function numberOr(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function create(tag, options = {}, children = []) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = String(options.text);
    if (options.id) element.id = options.id;
    if (options.type) element.type = options.type;
    if (options.attrs) Object.entries(options.attrs).forEach(([name, value]) => {
      if (value !== null && value !== undefined) element.setAttribute(name, String(value));
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => element.append(child));
    return element;
  }

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    return element;
  }

  function clear(element) { element.replaceChildren(); }

  function announce(message) {
    clearTimeout(announcementTimer);
    dom.liveStatus.textContent = '';
    announcementTimer = setTimeout(() => { dom.liveStatus.textContent = message; }, 20);
  }

  function setStorageStatus(message, kind = '', shouldAnnounce = false) {
    dom.storageStatus.textContent = message;
    dom.storageStatus.dataset.kind = kind;
    if (shouldAnnounce) announce(message);
  }

  function flagSource(country) {
    return String(country.f || '').startsWith('data:') ? country.f : `data:image/png;base64,${country.f}`;
  }

  function flagImage(country, options = {}) {
    const image = create('img', { attrs: {
      src: flagSource(country), alt: options.decorative ? '' : (options.alt || `Bandeira de ${country.n}`),
      loading: options.eager ? 'eager' : 'lazy', decoding: 'async',
    } });
    if (options.decorative) image.setAttribute('aria-hidden', 'true');
    return image;
  }

  function formatArea(value) {
    return Number.isFinite(value) ? `${new Intl.NumberFormat('pt-BR').format(value)} km²` : 'área não informada';
  }
  function formatPercent(value) { return `${Math.round(value)}%`; }

  function savePreferences() {
    const safe = {
      mode: state.mode, region: state.region, answerMode: state.answerMode,
      includeVisual: state.includeVisual, mapCollapsed: state.mapCollapsed,
    };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(safe)); } catch (_) { /* modo privado */ }
  }

  function loadPreferences() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return;
      if (MODE_DIRECTIONS[parsed.mode]) state.mode = parsed.mode;
      if (REGIONS.includes(parsed.region)) state.region = parsed.region;
      if (parsed.answerMode === 'pick' || parsed.answerMode === 'type') state.answerMode = parsed.answerMode;
      if (typeof parsed.includeVisual === 'boolean') state.includeVisual = parsed.includeVisual;
      if (typeof parsed.mapCollapsed === 'boolean') state.mapCollapsed = parsed.mapCollapsed;
      if (!state.includeVisual && (state.mode === 'flag' || state.mode === 'loc')) state.mode = 'cap';
    } catch (_) { /* preferência corrompida é ignorada */ }
  }

  function hostStorageAvailable() {
    return Boolean(globalThis.storage && typeof globalThis.storage.get === 'function' && typeof globalThis.storage.set === 'function');
  }

  function withTimeout(promise, milliseconds = 3500) {
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Tempo limite excedido.')), milliseconds); }),
    ]).finally(() => clearTimeout(timer));
  }

  async function readHost(key) {
    if (!hostStorageAvailable()) return null;
    try {
      const result = await withTimeout(globalThis.storage.get(key));
      return result && typeof result.value === 'string' ? result.value : null;
    } catch (_) { return null; }
  }
  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  async function writeAll(serialized) {
    let localOk = false;
    let hostOk = false;
    try { localStorage.setItem(STORAGE_KEY, serialized); localOk = true; } catch (_) { /* reportado abaixo */ }
    if (hostStorageAvailable()) {
      try { await withTimeout(globalThis.storage.set(STORAGE_KEY, serialized)); hostOk = true; } catch (_) { /* espelho local permanece */ }
    }
    if (!localOk && !hostOk) throw new Error('Nenhum armazenamento está disponível.');
    return { localOk, hostOk };
  }

  function queueProgressSave(immediate = false) {
    flushLocalProgress();
    clearTimeout(saveTimer);
    const run = () => {
      setStorageStatus('Salvando progresso…');
      saveChain = saveChain.catch(() => undefined).then(() => {
        const latestSnapshot = Core.serializeProgress(progress, { countryIds: IDS });
        return writeAll(latestSnapshot);
      })
        .then(({ localOk, hostOk }) => {
          const destinations = [localOk && 'neste navegador', hostOk && 'no armazenamento do app'].filter(Boolean).join(' e ');
          setStorageStatus(`Progresso salvo ${destinations}.`, 'ok');
        })
        .catch(() => setStorageStatus('Não foi possível salvar o progresso. Esta sessão continua funcionando.', 'error', true));
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 280);
  }

  function parsedJson(raw) {
    if (typeof raw !== 'string') return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  async function hydrateProgress() {
    setStorageStatus('Carregando progresso…');
    const options = { countryIds: IDS };
    const hostRaw = await readHost(STORAGE_KEY);
    const localRaw = readLocal(STORAGE_KEY);
    const rawCandidates = [localRaw, hostRaw].filter((value) => typeof value === 'string');
    const decoded = rawCandidates.map((raw) => Core.deserializeProgress(raw, options));
    const validResults = decoded.filter((result) => !result.recovered);
    const candidates = validResults.map((result) => result.progress);
    if (candidates.length) {
      progress = candidates.slice(1).reduce((merged, candidate) =>
        Core.mergeProgress(merged, candidate, options), candidates[0]);
      setStorageStatus('Progresso carregado.', 'ok', true);
      const canonical = Core.serializeProgress(progress, options);
      const replicaNeedsRepair = localRaw !== canonical || (hostStorageAvailable() && hostRaw !== canonical);
      if (replicaNeedsRepair) {
        queueProgressSave(true);
      }
      return;
    }
    const legacyRaw = readLocal(LEGACY_PROGRESS_KEY) || await readHost(LEGACY_PROGRESS_KEY);
    if (legacyRaw) {
      try {
        const bestObject = parsedJson(readLocal(LEGACY_BEST_KEY) || await readHost(LEGACY_BEST_KEY));
        const legacyBest = bestObject && Number.isSafeInteger(bestObject.best) ? bestObject.best : 0;
        progress = Core.migrateProgress(parsedJson(legacyRaw), { countryIds: IDS, legacyBest });
        setStorageStatus('Progresso antigo migrado para a versão atual.', 'ok', true);
        queueProgressSave(true);
        return;
      } catch (_) { /* inicia envelope validado */ }
    }
    progress = Core.createProgress();
    setStorageStatus(rawCandidates.length
      ? 'Dados salvos inválidos foram isolados; um progresso novo foi iniciado.'
      : 'Progresso pronto para esta sessão.', rawCandidates.length ? 'error' : 'ok', true);
  }

  function flushLocalProgress() {
    try { localStorage.setItem(STORAGE_KEY, Core.serializeProgress(progress, { countryIds: IDS })); } catch (_) { /* best effort */ }
  }

  function synchronizeProgress(event) {
    if (event.key !== STORAGE_KEY || typeof event.newValue !== 'string') return;
    if (!state.ready) {
      pendingStorageValues.push(event.newValue);
      if (pendingStorageValues.length > 32) pendingStorageValues.shift();
      return;
    }
    try {
      const decoded = Core.deserializeProgress(event.newValue, { countryIds: IDS });
      if (decoded.recovered) return;
      const before = Core.serializeProgress(progress, { countryIds: IDS });
      const incoming = decoded.progress;
      const incomingSerialized = Core.serializeProgress(incoming, { countryIds: IDS });
      const merged = Core.mergeProgress(progress, incoming, { countryIds: IDS });
      const after = Core.serializeProgress(merged, { countryIds: IDS });
      const memoryChanged = after !== before;
      const replicaNeedsRepair = after !== incomingSerialized;
      if (!memoryChanged && !replicaNeedsRepair) return;
      if (memoryChanged) progress = merged;
      if (state.resetPending) {
        resetSyncDirty = true;
        return;
      }
      if (replicaNeedsRepair) queueProgressSave(true);
      setStorageStatus('Progresso sincronizado entre abas.', 'ok');
      if (memoryChanged) {
        if (state.view === 'prog') renderProgress();
        else renderScorebar();
      }
    } catch (_) {
      setStorageStatus('Uma atualização de outra aba não pôde ser sincronizada.', 'error', true);
    }
  }

  function absorbPendingProgress() {
    if (!pendingStorageValues.length) return;
    const before = Core.serializeProgress(progress, { countryIds: IDS });
    pendingStorageValues.splice(0).forEach((serialized) => {
      const decoded = Core.deserializeProgress(serialized, { countryIds: IDS });
      if (!decoded.recovered) progress = Core.mergeProgress(progress, decoded.progress, { countryIds: IDS });
    });
    const after = Core.serializeProgress(progress, { countryIds: IDS });
    const replicaNeedsRepair = readLocal(STORAGE_KEY) !== after;
    if (after !== before || replicaNeedsRepair) queueProgressSave(true);
  }

  const mapState = {
    root: null, land: null, markers: null, effects: null, view: { ...WORLD },
    nodesById: new Map(), hitGrid: new Map(), reticle: null, reticleId: null,
    pointers: new Map(), gesture: null, pendingPan: null, panFrame: 0,
    metrics: null, hoverFrame: 0, pendingHover: null,
  };

  const ROBINSON_TABLE = [[0, 1, 0], [5, .9986, .062], [10, .9954, .124], [15, .99, .186], [20, .9822, .248], [25, .973, .31], [30, .96, .372], [35, .9427, .434], [40, .9216, .4958], [45, .8962, .5571], [50, .8679, .6176], [55, .835, .6769], [60, .7986, .7346], [65, .7597, .7903], [70, .7186, .8435], [75, .6732, .8936], [80, .6213, .9394], [85, .5722, .9761], [90, .5322, 1]];

  function robinson(lon, lat) {
    const projection = MAP_META && MAP_META.projection || {};
    const radius = numberOr(projection.radius, 190);
    const xFactor = numberOr(projection.xFactor, .8487);
    const yFactor = numberOr(projection.yFactor, 1.3523);
    const sign = lat < 0 ? -1 : 1;
    const absolute = Math.min(Math.abs(lat), 90);
    const index = Math.min(Math.floor(absolute / 5), 17);
    const ratio = (absolute - ROBINSON_TABLE[index][0]) / 5;
    const xCoefficient = ROBINSON_TABLE[index][1] + (ROBINSON_TABLE[index + 1][1] - ROBINSON_TABLE[index][1]) * ratio;
    const yCoefficient = ROBINSON_TABLE[index][2] + (ROBINSON_TABLE[index + 1][2] - ROBINSON_TABLE[index][2]) * ratio;
    return [xFactor * radius * xCoefficient * lon * Math.PI / 180, -sign * yFactor * radius * yCoefficient];
  }

  function inverseRobinson(x, y) {
    const projection = MAP_META && MAP_META.projection || {};
    const radius = numberOr(projection.radius, 190);
    const xFactor = numberOr(projection.xFactor, .8487);
    const yFactor = numberOr(projection.yFactor, 1.3523);
    const sign = y > 0 ? -1 : 1;
    const absoluteY = Math.abs(y) / (yFactor * radius);
    let latitude = 90;
    for (let index = 0; index < 18; index += 1) {
      if (absoluteY <= ROBINSON_TABLE[index + 1][2]) {
        const span = ROBINSON_TABLE[index + 1][2] - ROBINSON_TABLE[index][2] || 1;
        latitude = ROBINSON_TABLE[index][0] + 5 * (absoluteY - ROBINSON_TABLE[index][2]) / span;
        break;
      }
    }
    latitude *= sign;
    const index = Math.min(Math.floor(Math.abs(latitude) / 5), 17);
    const ratio = (Math.abs(latitude) - ROBINSON_TABLE[index][0]) / 5;
    const xCoefficient = ROBINSON_TABLE[index][1] + (ROBINSON_TABLE[index + 1][1] - ROBINSON_TABLE[index][1]) * ratio;
    return [
      Math.max(-180, Math.min(180, x / (xFactor * radius * xCoefficient) * 180 / Math.PI)),
      Math.max(-90, Math.min(90, latitude)),
    ];
  }

  function buildMap() {
    dom.map.setAttribute('viewBox', `${WORLD.x} ${WORLD.y} ${WORLD.w} ${WORLD.h}`);
    dom.map.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    dom.map.setAttribute('aria-activedescendant', 'map-country-BR');
    mapState.root = svgElement('g');
    const graticule = svgElement('g', { class: 'grat', 'aria-hidden': 'true' });
    for (let latitude = -60; latitude <= 80; latitude += 20) {
      let path = '';
      for (let longitude = -180; longitude <= 180; longitude += 4) {
        const point = robinson(longitude, latitude);
        path += `${longitude === -180 ? 'M' : 'L'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`;
      }
      graticule.append(svgElement('path', { d: path }));
    }
    for (let longitude = -180; longitude <= 180; longitude += 30) {
      let path = '';
      for (let latitude = -85; latitude <= 85; latitude += 3) {
        const point = robinson(longitude, latitude);
        path += `${latitude === -85 ? 'M' : 'L'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`;
      }
      graticule.append(svgElement('path', { d: path }));
    }
    mapState.root.append(graticule, svgElement('rect', {
      x: WORLD.x + 1, y: WORLD.y + 1, width: WORLD.w - 2, height: WORLD.h - 2,
      class: 'frame', 'aria-hidden': 'true',
    }));
    if (MAP_META && MAP_META.contextLand && MAP_META.contextLand.d) {
      mapState.root.append(svgElement('path', {
        d: MAP_META.contextLand.d,
        class: 'context-land',
        'fill-rule': 'evenodd',
        'clip-rule': 'evenodd',
        'aria-hidden': 'true',
      }));
    }
    mapState.land = svgElement('g', { 'aria-hidden': 'false' });
    mapState.markers = svgElement('g', { 'aria-hidden': 'true' });
    mapState.effects = svgElement('g', { 'aria-hidden': 'true' });
    DATA.forEach((country) => {
      const path = svgElement('path', {
        id: `map-country-${country.id}`, d: country.d, class: 'cty', 'data-id': country.id,
        role: 'option', 'aria-label': country.n, 'aria-selected': 'false',
        'fill-rule': 'evenodd', 'clip-rule': 'evenodd',
      });
      mapState.land.append(path);
      mapState.nodesById.set(country.id, [path]);
      (country.hitPoints || []).forEach((point) => addHitPoint(country.id, point));
    });
    mapState.root.append(mapState.land, mapState.markers, mapState.effects);
    dom.map.append(mapState.root);
    setMapCursor(state.mapCursorId, false);
    setMapView(WORLD.x, WORLD.y, WORLD.w, WORLD.h);
  }

  function hitGridKey(x, y) {
    return `${Math.floor(x / HIT_GRID_SIZE)},${Math.floor(y / HIT_GRID_SIZE)}`;
  }

  function addHitPoint(id, point) {
    if (!Array.isArray(point) || !point.every(Number.isFinite)) return;
    const key = hitGridKey(point[0], point[1]);
    if (!mapState.hitGrid.has(key)) mapState.hitGrid.set(key, []);
    mapState.hitGrid.get(key).push({ id, x: point[0], y: point[1] });
  }

  function clearMapMarks() {
    mapState.nodesById.forEach((nodes) => nodes.forEach((node) => node.classList.remove(
      'on', 'ok', 'bad', 'dimmed', 'is-current', 'is-correct', 'is-wrong', 'is-dimmed',
    )));
    clear(mapState.effects);
    mapState.reticle = null;
    mapState.reticleId = null;
  }
  function markCountry(id, className) {
    (mapState.nodesById.get(id) || []).forEach((node) => node.classList.add(className));
  }

  function setMapCursor(id, shouldAnnounce = true) {
    if (!byId[id]) return;
    const previous = document.getElementById(`map-country-${state.mapCursorId}`);
    if (previous) { previous.setAttribute('aria-selected', 'false'); previous.classList.remove('is-current'); }
    state.mapCursorId = id;
    const path = document.getElementById(`map-country-${id}`);
    if (path) {
      path.setAttribute('aria-selected', 'true');
      if (document.activeElement === dom.map) path.classList.add('is-current');
    }
    dom.map.setAttribute('aria-activedescendant', `map-country-${id}`);
    if (shouldAnnounce) announce(state.view === 'atlas'
      ? `${byId[id].n}. Use Enter para selecionar.`
      : 'Posição atualizada no mapa. Use Enter para selecionar ou pule a pergunta visual.');
  }

  function showReticle(id) {
    const country = byId[id];
    if (!country) return;
    clear(mapState.effects);
    const reticle = svgElement('g', { class: 'reticle' });
    const halo = svgElement('g', { class: 'halo' });
    const segments = [[-23, 0, -9, 0], [9, 0, 23, 0], [0, -23, 0, -9], [0, 9, 0, 23]];
    [halo, reticle].forEach((group) => {
      segments.forEach((line) => group.append(svgElement('line', { x1: line[0], y1: line[1], x2: line[2], y2: line[3] })));
      group.append(svgElement('circle', { cx: 0, cy: 0, r: 9, class: 'ring' }));
      group.append(svgElement('circle', { cx: 0, cy: 0, r: 15, class: 'ring2' }));
    });
    reticle.prepend(halo);
    mapState.effects.append(reticle);
    mapState.reticle = reticle;
    mapState.reticleId = id;
    updateMapScaleSensitiveElements();
  }

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
    if (mapState.reticle && mapState.reticleId) {
      const country = byId[mapState.reticleId];
      mapState.reticle.setAttribute('transform', `translate(${country.c[0]} ${country.c[1]}) scale(${unitsPerPixel.toFixed(5)})`);
    }
  }

  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

  function setMapView(x, y, width) {
    const nextWidth = clamp(width, WORLD.w / 30, WORLD.w);
    const nextHeight = nextWidth * WORLD.h / WORLD.w;
    const nextX = clamp(x, WORLD.x, WORLD.x + WORLD.w - nextWidth);
    const nextY = clamp(y, WORLD.y, WORLD.y + WORLD.h - nextHeight);
    mapState.view = { x: nextX, y: nextY, w: nextWidth, h: nextHeight };
    dom.map.setAttribute('viewBox', `${nextX} ${nextY} ${nextWidth} ${nextHeight}`);
    mapState.metrics = null;
    updateMapScaleSensitiveElements();
    updateReadout();
  }

  function zoomAt(factor, center) {
    const point = center || [mapState.view.x + mapState.view.w / 2, mapState.view.y + mapState.view.h / 2];
    const width = mapState.view.w / factor;
    const ratio = width / mapState.view.w;
    setMapView(point[0] - (point[0] - mapState.view.x) * ratio, point[1] - (point[1] - mapState.view.y) * ratio, width);
  }
  function resetMapView() { setMapView(WORLD.x, WORLD.y, WORLD.w); }

  function fitCountry(id) {
    const country = byId[id];
    if (!country) return;
    const width = country.b[2] - country.b[0];
    const height = country.b[3] - country.b[1];
    const minimum = country.a < 5 ? WORLD.w / 14 : WORLD.w / 22;
    const desired = clamp(Math.max(width * 3.1, height * WORLD.w / WORLD.h * 3.1, minimum), WORLD.w / 30, WORLD.w);
    setMapView(country.c[0] - desired / 2, country.c[1] - desired * WORLD.h / WORLD.w / 2, desired);
  }

  function screenToWorld(clientX, clientY, providedMetrics) {
    const metrics = providedMetrics || mapMetrics(true);
    return [mapState.view.x + (clientX - metrics.rect.left - metrics.offsetX) / metrics.scale,
      mapState.view.y + (clientY - metrics.rect.top - metrics.offsetY) / metrics.scale];
  }

  function countryAt(clientX, clientY, originalTarget, providedPoint, providedScale) {
    const directId = originalTarget && originalTarget.dataset ? originalTarget.dataset.id : null;
    if (directId) return directId;
    const point = providedPoint || screenToWorld(clientX, clientY);
    const hitRadius = 22 / Math.max(.0001, providedScale || renderedScale());
    let nearest = null;
    let nearestDistance = Infinity;
    const cellRadius = Math.ceil(hitRadius / HIT_GRID_SIZE);
    const cellX = Math.floor(point[0] / HIT_GRID_SIZE);
    const cellY = Math.floor(point[1] / HIT_GRID_SIZE);
    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
        const candidates = mapState.hitGrid.get(`${cellX + dx},${cellY + dy}`) || [];
        candidates.forEach((candidate) => {
          const distance = Math.hypot(point[0] - candidate.x, point[1] - candidate.y);
          if (distance <= hitRadius && distance < nearestDistance) {
            nearest = candidate.id;
            nearestDistance = distance;
          }
        });
      }
    }
    return nearest || directId || null;
  }

  function scheduleHoverReadout(event) {
    mapState.pendingHover = { clientX: event.clientX, clientY: event.clientY, target: event.target };
    if (mapState.hoverFrame) return;
    mapState.hoverFrame = requestAnimationFrame(() => {
      mapState.hoverFrame = 0;
      const pending = mapState.pendingHover;
      mapState.pendingHover = null;
      if (!pending) return;
      const metrics = mapMetrics(true);
      const point = screenToWorld(pending.clientX, pending.clientY, metrics);
      updateReadout(pending.clientX, pending.clientY, point);
      const hoverId = countryAt(pending.clientX, pending.clientY, pending.target, point, metrics.scale);
      dom.hoverName.textContent = hoverId && state.view !== 'quiz' ? byId[hoverId].n : '';
    });
  }

  function updateReadout(clientX, clientY, providedPoint) {
    const center = clientX === undefined
      ? [mapState.view.x + mapState.view.w / 2, mapState.view.y + mapState.view.h / 2]
      : (providedPoint || screenToWorld(clientX, clientY));
    const [longitude, latitude] = inverseRobinson(center[0], center[1]);
    dom.readout.textContent = `lon ${longitude >= 0 ? '+' : ''}${longitude.toFixed(1)}° · lat ${latitude >= 0 ? '+' : ''}${latitude.toFixed(1)}° · zoom ${(WORLD.w / mapState.view.w).toFixed(1)}×`;
  }

  function activateMapCountry(id) {
    if (!id || !byId[id]) return;
    setMapCursor(id, false);
    if (state.view === 'quiz' && state.question && state.question.direction === 'locate' && !state.answered) return answerQuestion(id);
    if (state.view === 'quiz') {
      announce('O mapa é apenas referência nesta pergunta.');
      return;
    }
    if (state.view === 'atlas') return selectAtlasCountry(id, true);
    showReticle(id);
    announce(`${byId[id].n}, capital ${byId[id].cap}.`);
  }

  function directionalCountry(currentId, key) {
    const current = byId[currentId] || byId.BR;
    const desiredX = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    const desiredY = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    let best = null;
    let bestScore = Infinity;
    DATA.forEach((candidate) => {
      if (candidate.id === current.id) return;
      const dx = candidate.c[0] - current.c[0];
      const dy = candidate.c[1] - current.c[1];
      if ((desiredX && Math.sign(dx) !== desiredX) || (desiredY && Math.sign(dy) !== desiredY)) return;
      const score = (desiredX ? Math.abs(dx) : Math.abs(dy)) + (desiredX ? Math.abs(dy) : Math.abs(dx)) * 2.4;
      if (score < bestScore) { best = candidate; bestScore = score; }
    });
    return best ? best.id : current.id;
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

  function endPointer(pointerId, event) {
    const gesture = mapState.gesture;
    const pointer = mapState.pointers.get(pointerId);
    mapState.pointers.delete(pointerId);
    if (mapState.pointers.size === 0) {
      dom.map.classList.remove('grabbing');
      mapState.gesture = null;
      if (event.type === 'pointerup' && gesture && pointer && gesture.kind === 'drag' && gesture.moved < 8) {
        const clientX = Number.isFinite(event.clientX) ? event.clientX : pointer.x;
        const clientY = Number.isFinite(event.clientY) ? event.clientY : pointer.y;
        const target = document.elementFromPoint(clientX, clientY);
        activateMapCountry(countryAt(clientX, clientY, target) || gesture.countryId);
      }
    } else if (mapState.pointers.size === 1) {
      const remaining = [...mapState.pointers.values()][0];
      mapState.gesture = { kind: 'drag', startX: remaining.x, startY: remaining.y, view: { ...mapState.view }, moved: 9, countryId: null };
    }
  }

  function bindMapEvents() {
    dom.map.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      try { dom.map.setPointerCapture(event.pointerId); } catch (_) { /* captura opcional */ }
      mapState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (mapState.pointers.size === 1) {
        mapState.gesture = {
          kind: 'drag', startX: event.clientX, startY: event.clientY,
          view: { ...mapState.view }, moved: 0,
          countryId: countryAt(event.clientX, event.clientY, event.target),
        };
        dom.map.classList.add('grabbing');
      } else if (mapState.pointers.size === 2) {
        if (mapState.panFrame) cancelAnimationFrame(mapState.panFrame);
        mapState.panFrame = 0;
        mapState.pendingPan = null;
        const points = [...mapState.pointers.values()];
        mapState.gesture = {
          kind: 'pinch',
          distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
          midpoint: [(points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2],
        };
      }
    });
    dom.map.addEventListener('pointermove', (event) => {
      scheduleHoverReadout(event);
      if (!mapState.pointers.has(event.pointerId)) return;
      mapState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (mapState.pointers.size === 2 && mapState.gesture && mapState.gesture.kind === 'pinch') {
        const points = [...mapState.pointers.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const midpoint = [(points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2];
        const factor = distance / Math.max(1, mapState.gesture.distance);
        if (Number.isFinite(factor) && factor > .25 && factor < 4) {
          const anchor = screenToWorld(mapState.gesture.midpoint[0], mapState.gesture.midpoint[1]);
          zoomAt(factor, anchor);
          const scale = Math.max(.0001, renderedScale());
          setMapView(
            mapState.view.x - (midpoint[0] - mapState.gesture.midpoint[0]) / scale,
            mapState.view.y - (midpoint[1] - mapState.gesture.midpoint[1]) / scale,
            mapState.view.w,
          );
        }
        mapState.gesture = { kind: 'pinch', distance, midpoint };
      } else if (mapState.pointers.size === 1 && mapState.gesture && mapState.gesture.kind === 'drag') {
        const dx = event.clientX - mapState.gesture.startX;
        const dy = event.clientY - mapState.gesture.startY;
        mapState.gesture.moved = Math.max(mapState.gesture.moved, Math.hypot(dx, dy));
        const scale = Math.max(.0001, renderedScale());
        schedulePan(mapState.gesture.view.x - dx / scale, mapState.gesture.view.y - dy / scale, mapState.gesture.view.w);
      }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
      dom.map.addEventListener(type, (event) => endPointer(event.pointerId, event));
    });
    dom.map.addEventListener('pointerleave', () => { dom.hoverName.textContent = ''; });
    dom.map.addEventListener('wheel', (event) => {
      event.preventDefault();
      const factor = clamp(Math.exp(-event.deltaY * .0015), .6, 1.67);
      zoomAt(factor, screenToWorld(event.clientX, event.clientY));
    }, { passive: false });
    dom.map.addEventListener('dblclick', (event) => {
      event.preventDefault();
      if (state.view === 'quiz' && state.question && state.question.direction === 'locate') {
        announce('Durante perguntas de localização, use os botões, a roda ou o gesto de pinça para aproximar o mapa.');
        return;
      }
      zoomAt(1.8, screenToWorld(event.clientX, event.clientY));
    });
    dom.map.addEventListener('keydown', (event) => {
      if (event.key.startsWith('Arrow')) {
        event.preventDefault(); event.stopPropagation();
        setMapCursor(directionalCountry(state.mapCursorId, event.key));
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); event.stopPropagation();
        activateMapCountry(state.mapCursorId);
      } else if (event.key === 'Escape' || event.key === '0') {
        event.preventDefault(); event.stopPropagation(); resetMapView(); announce('Visão do mundo restaurada.');
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault(); event.stopPropagation(); zoomAt(1.35);
      } else if (event.key === '-') {
        event.preventDefault(); event.stopPropagation(); zoomAt(1 / 1.35);
      }
    });
    dom.map.addEventListener('focus', () => document.getElementById(`map-country-${state.mapCursorId}`)?.classList.add('is-current'));
    dom.map.addEventListener('blur', () => document.getElementById(`map-country-${state.mapCursorId}`)?.classList.remove('is-current'));
    const handleMapResize = () => { mapState.metrics = null; updateMapScaleSensitiveElements(); };
    if (typeof ResizeObserver === 'function') new ResizeObserver(handleMapResize).observe(dom.mapWrap);
    else window.addEventListener('resize', handleMapResize);
  }

  function effectiveDirections() {
    let directions = (MODE_DIRECTIONS[state.mode] || MODE_DIRECTIONS.mix).slice();
    if (state.answerMode === 'type') directions = directions.filter((direction) => direction !== 'flagOf' && direction !== 'locate');
    if (!state.includeVisual) directions = directions.filter((direction) => !VISUAL_DIRECTIONS.has(direction));
    return directions.length ? directions : ['cap', 'capOf'];
  }

  function createNextQuestion(options = {}) {
    if (!state.ready) return;
    const forced = state.forcedQuestion;
    state.forcedQuestion = null;
    const questionAnswerMode = forced && (forced.direction === 'flagOf' || forced.direction === 'locate')
      ? 'pick' : state.answerMode;
    const result = Core.createQuestion({
      countries: DATA,
      mode: state.mode,
      directions: forced ? [forced.direction] : effectiveDirections(),
      region: forced ? 'Mundo inteiro' : state.region,
      answerMode: questionAnswerMode,
      progress,
      recentIds: state.recentIds,
      forcedId: forced ? forced.id : undefined,
    });
    state.question = result.question;
    state.questionAnswerMode = questionAnswerMode;
    state.recentIds = result.recentIds;
    state.answered = false;
    state.selectedAnswer = null;
    state.answerMatch = null;
    state.questionNumber += 1;
    renderQuiz();
    syncMapForQuestion();
    if (options.focus) {
      document.getElementById('questionTitle')?.focus();
      announce(questionCopy(state.question)[0]);
    }
  }

  function questionCopy(question) {
    const country = byId[question.id];
    if (country.capitalType === 'government-seat') {
      if (question.direction === 'cap') return [`Em qual distrito fica a sede do governo de ${country.n}?`, 'País → sede do governo'];
      if (question.direction === 'capOf') return [`${country.cap} é a sede do governo de qual país?`, 'Sede do governo → país'];
    }
    return {
      flag: ['Que país tem esta bandeira?', 'Observe as formas e cores'],
      flagOf: [`Qual é a bandeira de ${country.n}?`, 'Escolha uma bandeira'],
      cap: [`Qual é a capital de ${country.n}?`, 'País → capital'],
      capOf: [`${country.cap} é a capital de qual país?`, 'Capital → país'],
      locate: [`Onde fica ${country.n}?`, 'Selecione o país no mapa'],
      mapId: ['Que país está marcado no mapa?', 'Mapa → país'],
    }[question.direction];
  }
  function isVisualQuestion(question = state.question) {
    return Boolean(question && VISUAL_DIRECTIONS.has(question.direction));
  }
  function optionLabel(direction, country) { return direction === 'cap' ? country.cap : country.n; }
  function answerField(direction) { return direction === 'cap' ? 'capital' : 'country'; }

  function answerQuestion(value) {
    if (!state.question || state.answered) return;
    const target = byId[state.question.id];
    let correct;
    let match = null;
    if (state.question.direction === 'locate' || state.questionAnswerMode === 'pick') {
      correct = value === target.id;
    } else {
      match = Core.matchCountryAnswer(value, target, answerField(state.question.direction), DATA);
      if (match.reason === 'empty') {
        const input = document.getElementById('typedAnswer');
        if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
        const error = document.getElementById('answerError');
        if (error) error.textContent = 'Digite uma resposta antes de verificar.';
        announce('Digite uma resposta antes de verificar.');
        return;
      }
      correct = match.ok;
    }
    state.answered = true;
    state.selectedAnswer = value;
    state.answerMatch = match;
    if (correct) { state.hits += 1; state.streak += 1; }
    else { state.misses += 1; state.streak = 0; }
    progress = Core.recordAnswer(progress, target.id, state.question.direction, correct, {
      countryIds: IDS, bestStreak: state.streak,
    });
    queueProgressSave();
    renderQuiz();
    syncMapForQuestion(correct);
    const expected = answerField(state.question.direction) === 'capital' ? target.cap : target.n;
    announce(correct ? `Correto. ${expected}.` : `Resposta incorreta. A resposta é ${expected}.`);
    document.getElementById('nextQuestion')?.focus();
  }

  function skipVisualQuestion() {
    if (!isVisualQuestion() || state.answered) return;
    createNextQuestion({ focus: true });
    announce('Pergunta visual pulada sem alterar o progresso.');
  }

  function syncMapForQuestion(correct) {
    clearMapMarks();
    const picking = state.view === 'quiz' && state.question && state.question.direction === 'locate' && !state.answered;
    dom.map.classList.toggle('picking', Boolean(picking));
    dom.skipVisual.hidden = !(state.view === 'quiz' && isVisualQuestion() && !state.answered);
    if (state.view !== 'quiz' || !state.question) return;
    const question = state.question;
    if (question.direction === 'mapId') showReticle(question.id);
    if (state.answered) {
      markCountry(question.id, 'ok');
      if (!correct && question.direction === 'locate' && byId[state.selectedAnswer]) markCountry(state.selectedAnswer, 'bad');
      if (question.direction === 'locate' || question.direction === 'mapId') showReticle(question.id);
    }
  }

  function renderQuestionOptions(container, question) {
    if (question.direction === 'locate') {
      container.append(create('p', { className: 'hintline', text: 'Ajuste o zoom pelos botões, roda ou pinça antes de confirmar com toque, clique ou teclado; aproxime para microestados. Você também pode pular sem penalidade.' }));
      return;
    }
    if (state.questionAnswerMode === 'type' && question.direction !== 'flagOf') {
      const row = create('div', { className: 'typerow' });
      const input = create('input', { id: 'typedAnswer', attrs: {
        type: 'text', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false',
        placeholder: answerField(question.direction) === 'capital' ? 'Digite a capital' : 'Digite o país',
        'aria-label': answerField(question.direction) === 'capital' ? 'Sua resposta: capital' : 'Sua resposta: país',
        'aria-describedby': 'answerError',
        value: state.answered ? state.selectedAnswer : null,
        disabled: state.answered ? '' : null,
      } });
      const submit = create('button', { className: 'btn', text: 'Verificar', type: 'button', attrs: {
        disabled: state.answered ? '' : null,
      } });
      submit.addEventListener('click', () => answerQuestion(input.value));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); answerQuestion(input.value); }
      });
      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
        const error = document.getElementById('answerError');
        if (error) error.textContent = '';
      });
      row.append(input, submit);
      container.append(row, create('p', { className: 'answer-error', id: 'answerError', attrs: { 'aria-live': 'polite' } }));
      return;
    }
    const options = create('div', { className: `opts${question.direction === 'flagOf' ? ' grid2' : ''}` });
    question.opts.forEach((id, index) => {
      const country = byId[id];
      const classNames = ['opt'];
      if (question.direction === 'flagOf') classNames.push('flagopt');
      if (state.answered && id === question.id) classNames.push('right');
      if (state.answered && id === state.selectedAnswer && id !== question.id) classNames.push('wrong');
      const button = create('button', { className: classNames.join(' '), type: 'button', attrs: {
        'data-answer': id, disabled: state.answered ? '' : null,
          'aria-label': question.direction === 'flagOf' ? `Opção ${index + 1} de bandeira` : null,
      } });
      button.append(create('span', { className: 'key', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }));
      if (question.direction === 'flagOf') button.append(flagImage(country, { decorative: true }));
      else button.append(document.createTextNode(optionLabel(question.direction, country)));
      button.addEventListener('click', () => answerQuestion(id));
      options.append(button);
    });
    container.append(options);
  }

  function explanatoryNotes(country) {
    const notes = [];
    if (country.alternateCapitals && country.alternateCapitals.length) notes.push(`Também aceita como capital oficial: ${country.alternateCapitals.join(', ')}.`);
    if (country.otherSeats && country.otherSeats.length) notes.push(`Sede de governo, não tratada como resposta canônica: ${country.otherSeats.join(', ')}.`);
    if (country.formerCapitalNames && country.formerCapitalNames.length) notes.push(`Nome histórico não aceito como atual: ${country.formerCapitalNames.join(', ')}.`);
    if (country.capitalNote) notes.push(country.capitalNote);
    if (state.answerMatch && state.answerMatch.ok && state.answerMatch.matched) {
      const canonical = answerField(state.question.direction) === 'capital' ? country.cap : country.n;
      if (Core.normalizeText(state.answerMatch.matched) !== Core.normalizeText(canonical)) {
        notes.unshift(`A forma “${state.answerMatch.matched}” foi reconhecida como equivalente.`);
      }
    }
    return notes;
  }

  function renderVerdict(container) {
    const question = state.question;
    const country = byId[question.id];
    const isCorrect = question.direction === 'locate' || state.questionAnswerMode === 'pick'
      ? state.selectedAnswer === question.id : Boolean(state.answerMatch && state.answerMatch.ok);
    const verdict = create('section', { className: 'verdict', attrs: { 'aria-labelledby': 'verdictTitle' } });
    verdict.append(create('p', {
      id: 'verdictTitle', className: `verdict-tag ${isCorrect ? 'ok' : 'bad'}`,
      text: isCorrect ? 'Correto' : 'Resposta incorreta',
    }));
    const fact = create('div', { className: 'factrow' });
    fact.append(flagImage(country));
    fact.append(create('div', {}, [
      create('div', { className: 'factname', text: country.n }),
      create('div', { className: 'factmeta', text: `${country.cap} · ${country.r} · ${formatArea(country.ar)}` }),
    ]));
    verdict.append(fact);
    explanatoryNotes(country).forEach((note) => verdict.append(create('p', { className: 'note', text: note })));
    const next = create('button', { id: 'nextQuestion', className: 'btn wide', text: 'Próxima pergunta', type: 'button' });
    next.addEventListener('click', () => createNextQuestion({ focus: true }));
    verdict.append(next);
    container.append(verdict);
  }

  function renderQuiz() {
    if (!state.question) return;
    atlasElements = null;
    clear(dom.panel);
    const question = state.question;
    const country = byId[question.id];
    const [headline, eyebrow] = questionCopy(question);
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: `Pergunta ${state.questionNumber}` }),
      create('span', { text: DIRECTION_LABEL[question.direction] }),
    ]));
    dom.panel.append(create('p', { className: 'prompt', text: eyebrow }));
    if (question.direction === 'flag') {
      dom.panel.append(create('h2', { id: 'questionTitle', className: 'subject sm', text: headline, attrs: { tabindex: '-1' } }));
      dom.panel.append(create('div', { className: 'flagbox' }, flagImage(country, { eager: true, alt: 'Bandeira apresentada na pergunta' })));
    } else dom.panel.append(create('h2', { id: 'questionTitle', className: 'subject', text: headline, attrs: { tabindex: '-1' } }));
    renderQuestionOptions(dom.panel, question);
    if (state.answered) renderVerdict(dom.panel);
    renderScorebar();
    dom.skipVisual.hidden = !(isVisualQuestion(question) && !state.answered);
  }

  function renderScorebar() {
    clear(dom.scorebar);
    if (state.view !== 'quiz') { dom.scorebar.hidden = true; return; }
    dom.scorebar.hidden = false;
    const total = state.hits + state.misses;
    [[state.hits, 'acertos'], [state.misses, 'erros'],
      [total ? `${Math.round(state.hits / total * 100)}%` : '—', 'precisão'],
      [state.streak, 'sequência'], [progress.bestStreak, 'recorde']]
      .forEach(([value, label], index) => {
        const box = create('div', { className: `stat${index === 3 && state.streak ? ' hot' : ''}` });
        box.append(create('b', { text: value }), create('span', { text: label }));
        dom.scorebar.append(box);
      });
  }

  function atlasMatches() {
    const query = Core.normalizeText(state.atlasQuery);
    const sorted = DATA.slice().sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
    if (!query) return sorted;
    return sorted.filter((country) => {
      const aliases = (country.aliases || []).map((alias) => alias.value);
      return [country.n, country.cap, country.r, ...aliases].map(Core.normalizeText).join(' ').includes(query);
    });
  }

  function renderAtlas() {
    setMapCursor(state.atlasSelected, false);
    clear(dom.panel);
    renderScorebar();
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: 'Atlas dos países' }), create('span', { text: '195 estados' }),
    ]));
    dom.panel.append(create('h2', { className: 'panel-title', text: 'Explorar o mundo' }));
    const search = create('input', { className: 'search', attrs: {
      type: 'search', placeholder: 'Buscar país, capital ou região',
      'aria-label': 'Buscar no Atlas', value: state.atlasQuery,
    } });
    const detail = create('section', { className: 'atlas-detail', attrs: { 'aria-live': 'polite', 'aria-label': 'País selecionado' } });
    const count = create('p', { className: 'count' });
    const list = create('div', { className: 'list', attrs: { 'aria-label': 'Resultados da busca' } });
    const more = create('button', { className: 'btn ghost wide', text: 'Mostrar mais países', type: 'button' });
    search.addEventListener('input', () => {
      state.atlasQuery = search.value;
      state.atlasLimit = 60;
      clearTimeout(atlasSearchTimer);
      atlasSearchTimer = setTimeout(renderAtlasList, 120);
    });
    more.addEventListener('click', () => { state.atlasLimit += 60; renderAtlasList(); });
    dom.panel.append(search, detail, count, list, more);
    atlasElements = { search, detail, count, list, more };
    renderAtlasDetail();
    renderAtlasList();
    clearMapMarks();
    markCountry(state.atlasSelected, 'on');
    showReticle(state.atlasSelected);
  }

  function renderAtlasDetail() {
    if (!atlasElements) return;
    const country = byId[state.atlasSelected] || DATA[0];
    clear(atlasElements.detail);
    const copy = create('div', { className: 'atlas-detail-copy' }, [
      create('h3', { text: country.n }),
      create('p', { text: `Capital: ${country.cap}` }),
      create('p', { text: `${country.r} · ${formatArea(country.ar)}` }),
    ]);
    atlasElements.detail.append(flagImage(country, { eager: true }), copy);
  }

  function renderAtlasList() {
    if (!atlasElements) return;
    const matches = atlasMatches();
    const visible = matches.slice(0, state.atlasLimit);
    clear(atlasElements.list);
    atlasElements.count.textContent = `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}`;
    visible.forEach((country) => {
      const row = create('button', { className: 'row', type: 'button', attrs: {
        'data-country': country.id, 'aria-current': country.id === state.atlasSelected ? 'true' : null,
      } });
      row.append(flagImage(country, { decorative: true }), create('span', { className: 'row-txt' }, [
        create('span', { className: 'row-n', text: country.n }),
        create('span', { className: 'row-c', text: `${country.cap} · ${country.r}` }),
      ]));
      row.addEventListener('click', () => selectAtlasCountry(country.id, true));
      atlasElements.list.append(row);
    });
    atlasElements.more.hidden = visible.length >= matches.length;
    atlasElements.more.textContent = `Mostrar mais (${matches.length - visible.length})`;
    if (!matches.length) atlasElements.list.append(create('p', { className: 'empty', text: 'Nenhum país, capital ou região corresponde à busca.' }));
  }

  function selectAtlasCountry(id, fit = false) {
    if (!byId[id]) return;
    state.atlasSelected = id;
    setMapCursor(id, false);
    clearMapMarks();
    markCountry(id, 'on');
    showReticle(id);
    if (fit) fitCountry(id);
    renderAtlasDetail();
    if (atlasElements) atlasElements.list.querySelectorAll('[data-country]').forEach((row) => {
      if (row.dataset.country === id) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
    announce(`${byId[id].n}. Capital ${byId[id].cap}. ${byId[id].r}.`);
  }

  function familyPercent(directions) {
    const maximum = DATA.length * directions.length * Core.MAX_LEVEL;
    const score = DATA.reduce((total, country) => total
      + directions.reduce((sum, direction) => sum + Core.levelOf(progress, country.id, direction), 0), 0);
    return { score, maximum, percent: maximum ? score / maximum * 100 : 0 };
  }

  function attemptedSkills() {
    const skills = [];
    DATA.forEach((country) => DIRECTIONS.forEach((direction) => {
      const skill = Core.skillOf(progress, country.id, direction);
      if (skill.attempts > 0) skills.push({ country, direction, skill });
    }));
    return skills;
  }

  function dueAttemptedSkills() {
    const now = Date.now();
    return attemptedSkills().filter((item) => item.skill.nextReviewAt && Date.parse(item.skill.nextReviewAt) <= now);
  }

  function progressBar(label, directions) {
    const value = familyPercent(directions);
    const wrapper = create('div', { className: 'bar' });
    wrapper.append(create('div', { className: 'bar-top' }, [
      create('strong', { text: label }), create('span', { text: formatPercent(value.percent) }),
    ]));
    wrapper.append(create('progress', { className: 'progress-native', attrs: {
      max: value.maximum, value: value.score,
      'aria-label': `Domínio em ${label}: ${formatPercent(value.percent)}`,
    } }));
    return wrapper;
  }

  function startReview(id, direction) {
    state.forcedQuestion = { id, direction };
    setView('quiz');
    createNextQuestion({ focus: true });
    announce(`Revisão de ${byId[id].n}: ${DIRECTION_LABEL[direction]}.`);
  }

  function renderProgress() {
    atlasElements = null;
    clear(dom.panel);
    renderScorebar();
    const attempted = attemptedSkills();
    const due = dueAttemptedSkills();
    const attemptedCountries = new Set(attempted.map((item) => item.country.id));
    const mastered = DATA.filter((country) => DIRECTIONS.every((direction) => Core.levelOf(progress, country.id, direction) === Core.MAX_LEVEL)).length;
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: 'Progresso validado' }), create('span', { text: `esquema v${Core.SCHEMA_VERSION}` }),
    ]));
    dom.panel.append(create('h2', { id: 'progressTitle', className: 'panel-title', text: 'Seu aprendizado', attrs: { tabindex: '-1' } }));
    dom.panel.append(create('p', { className: 'section-copy', text: `${attemptedCountries.size} países estudados · ${mastered} dominados · ${due.length} revisões vencidas` }));

    const mastery = create('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'masteryTitle' } });
    mastery.append(create('h3', { id: 'masteryTitle', text: 'Domínio por habilidade' }));
    Object.entries(FAMILY_DIRECTIONS).forEach(([label, directions]) => mastery.append(progressBar(label, directions)));
    dom.panel.append(mastery);

    const review = create('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'reviewTitle' } });
    review.append(create('h3', { id: 'reviewTitle', text: 'Revisões recomendadas' }));
    const reviewList = create('div', { className: 'weak' });
    due.slice(0, 12).forEach((item) => {
      const button = create('button', { className: 'chip hot', type: 'button', text: `${item.country.n} · ${DIRECTION_LABEL[item.direction]}` });
      button.addEventListener('click', () => startReview(item.country.id, item.direction));
      reviewList.append(button);
    });
    if (!due.length) reviewList.append(create('p', { className: 'empty', text: attempted.length
      ? 'Tudo revisado por enquanto. Novas revisões aparecerão na data adequada.'
      : 'Responda algumas perguntas para criar seu primeiro ciclo de revisão.' }));
    review.append(reviewList);
    dom.panel.append(review);

    const weakItems = attempted.filter((item) => item.skill.level <= 1)
      .sort((a, b) => a.skill.level - b.skill.level || a.skill.correct / a.skill.attempts - b.skill.correct / b.skill.attempts)
      .slice(0, 12);
    const weakSection = create('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'weakTitle' } });
    weakSection.append(create('h3', { id: 'weakTitle', text: 'Pontos para reforçar' }));
    const weakList = create('div', { className: 'weak' });
    weakItems.forEach((item) => {
      const button = create('button', { className: 'chip', type: 'button', text: `${item.country.n} · ${DIRECTION_LABEL[item.direction]}` });
      button.addEventListener('click', () => startReview(item.country.id, item.direction));
      weakList.append(button);
    });
    if (!weakItems.length) weakList.append(create('p', { className: 'empty', text: attempted.length
      ? 'Nenhuma habilidade fraca registrada.' : 'Ainda não há histórico suficiente para apontar dificuldades.' }));
    weakSection.append(weakList);
    dom.panel.append(weakSection);

    const source = MAP_META && MAP_META.source || {};
    const sourceSection = create('section', { className: 'source-card', attrs: { 'aria-labelledby': 'sourceTitle' } });
    sourceSection.append(create('h3', { id: 'sourceTitle', text: 'Dados cartográficos' }));
    sourceSection.append(create('p', { text: `${source.name || 'Natural Earth'} · ${MAP_META.scale || '1:10m'} · versão ${MAP_META.version || '5.1.1'} · ${source.boundaryPolicy || 'visão de fronteiras padrão'}.` }));
    sourceSection.append(create('p', { className: 'source-note', text: `${MAP_META.stats && MAP_META.stats.worldPolygons
      ? new Intl.NumberFormat('pt-BR').format(MAP_META.stats.worldPolygons) : 'Milhares de'} componentes territoriais mundiais preservados. Dados em domínio público.` }));
    sourceSection.append(create('p', { className: 'source-note', text: 'Bandeiras: flag-icons 7.5.0, coleção SVG sob licença MIT.' }));
    dom.panel.append(sourceSection);

    const reset = create('section', { className: 'reset-zone', attrs: { 'aria-labelledby': 'resetTitle' } });
    reset.append(create('h3', { id: 'resetTitle', text: 'Recomeçar' }));
    if (!state.resetArmed) {
      const button = create('button', { id: 'resetProgress', className: 'btn ghost', text: 'Apagar todo o progresso', type: 'button' });
      button.addEventListener('click', () => {
        state.resetArmed = true;
        renderProgress();
        document.getElementById('confirmReset')?.focus();
      });
      reset.append(button);
    } else {
      reset.append(create('p', {
        id: state.resetPending ? 'resetPendingStatus' : null,
        className: 'note',
        text: state.resetPending
          ? 'Conferindo os dados mais recentes antes de apagar…'
          : 'Esta ação apaga níveis, histórico de revisão e recorde. As preferências serão mantidas.',
        attrs: state.resetPending ? { role: 'status', 'aria-live': 'polite', tabindex: '-1' } : {},
      }));
      const actions = create('div', { className: 'button-row' });
      const cancel = create('button', { className: 'btn ghost', text: 'Cancelar', type: 'button', attrs: {
        disabled: state.resetPending ? '' : null,
      } });
      const confirm = create('button', { id: 'confirmReset', className: 'btn danger', text: 'Confirmar exclusão', type: 'button', attrs: {
        disabled: state.resetPending ? '' : null,
      } });
      cancel.addEventListener('click', () => {
        if (state.resetPending) return;
        state.resetArmed = false;
        renderProgress();
        document.getElementById('resetProgress')?.focus();
      });
      confirm.addEventListener('click', async () => {
        if (state.resetPending) return;
        state.resetPending = true;
        resetSyncDirty = false;
        dom.shell.classList.add('is-resetting');
        dom.topbar.setAttribute('inert', '');
        dom.controls.setAttribute('inert', '');
        renderProgress();
        document.getElementById('resetPendingStatus')?.focus();
        const performReset = async () => {
          clearTimeout(saveTimer);
          await saveChain.catch(() => undefined);
          const hostRaw = await readHost(STORAGE_KEY);
          let latest = progress;
          [hostRaw, readLocal(STORAGE_KEY)].forEach((raw) => {
            if (typeof raw !== 'string') return;
            const decoded = Core.deserializeProgress(raw, { countryIds: IDS });
            if (!decoded.recovered) latest = Core.mergeProgress(latest, decoded.progress, { countryIds: IDS });
          });
          const cleared = Core.resetProgress(latest, { now: new Date().toISOString(), countryIds: IDS });
          progress = cleared;
          setStorageStatus('Apagando progresso…');
          let persisted = false;
          try {
            let result;
            let attempts = 0;
            do {
              resetSyncDirty = false;
              const canonical = Core.serializeProgress(progress, { countryIds: IDS });
              result = await writeAll(canonical);
              persisted = true;
              const localMatches = !result.localOk || readLocal(STORAGE_KEY) === canonical;
              attempts += 1;
              if (!resetSyncDirty && localMatches) break;
            } while (attempts < 4);
            if (resetSyncDirty) flushLocalProgress();
            const destinations = [result.localOk && 'neste navegador', result.hostOk && 'no armazenamento do app']
              .filter(Boolean).join(' e ');
            setStorageStatus(`Progresso apagado ${destinations}.`, 'ok');
          } catch (error) {
            if (!persisted) progress = latest;
            throw error;
          }
        };
        try {
          if (navigator.locks && typeof navigator.locks.request === 'function') {
            await navigator.locks.request(RESET_LOCK_KEY, performReset);
          } else await performReset();
          state.resetPending = false;
          state.resetArmed = false;
          dom.shell.classList.remove('is-resetting');
          dom.topbar.removeAttribute('inert');
          dom.controls.removeAttribute('inert');
          state.hits = 0;
          state.misses = 0;
          state.streak = 0;
          if (state.view === 'prog') renderProgress();
          announce('Todo o progresso foi apagado.');
          if (state.view === 'prog') document.getElementById('progressTitle')?.focus();
        } catch (_) {
          state.resetPending = false;
          dom.shell.classList.remove('is-resetting');
          dom.topbar.removeAttribute('inert');
          dom.controls.removeAttribute('inert');
          if (state.view === 'prog') renderProgress();
          setStorageStatus('Não foi possível apagar o progresso com segurança.', 'error', true);
          if (state.view === 'prog') document.getElementById('confirmReset')?.focus();
        }
      });
      actions.append(cancel, confirm);
      reset.append(actions);
    }
    dom.panel.append(reset);
  }

  function setView(view) {
    if (!['quiz', 'atlas', 'prog'].includes(view)) return;
    state.view = view;
    document.body.dataset.view = view;
    dom.shell.dataset.view = view;
    dom.tabs.forEach((tab) => {
      if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    dom.skipVisual.hidden = true;
    dom.map.classList.remove('picking');
    if (view === 'quiz') { renderQuiz(); syncMapForQuestion(); }
    else if (view === 'atlas') renderAtlas();
    else { clearMapMarks(); renderProgress(); }
    announce(view === 'quiz' ? 'Treino aberto.' : view === 'atlas' ? 'Atlas aberto.' : 'Progresso aberto.');
  }

  function setMapCollapsed(collapsed, persist = true) {
    state.mapCollapsed = Boolean(collapsed);
    dom.mapRegion.classList.toggle('is-collapsed', state.mapCollapsed);
    dom.mapRegion.dataset.collapsed = String(state.mapCollapsed);
    dom.mapToggle.setAttribute('aria-expanded', String(!state.mapCollapsed));
    const label = dom.mapToggle.querySelector('.map-toggle-label');
    const icon = dom.mapToggle.querySelector('.map-toggle-icon');
    if (label) label.textContent = state.mapCollapsed ? 'Mostrar mapa' : 'Recolher mapa';
    if (icon) icon.textContent = state.mapCollapsed ? '+' : '−';
    if (persist) savePreferences();
    if (!state.mapCollapsed) requestAnimationFrame(updateMapScaleSensitiveElements);
  }

  function syncControls() {
    dom.modeSeg.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    dom.ansSeg.querySelectorAll('[data-ans]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.ans === state.answerMode)));
    dom.visualToggle.checked = state.includeVisual;
    dom.region.value = state.region;
    setMapCollapsed(state.mapCollapsed, false);
  }

  function bindControls() {
    dom.tabs.forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));
    dom.modeSeg.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode]');
      if (!button) return;
      state.mode = button.dataset.mode;
      if (!state.includeVisual && (state.mode === 'flag' || state.mode === 'loc')) {
        state.mode = 'cap';
        announce('Com perguntas visuais desativadas, o modo foi ajustado para Capitais.');
      }
      syncControls(); savePreferences();
      if (state.view !== 'quiz') setView('quiz');
      createNextQuestion();
    });
    dom.ansSeg.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ans]');
      if (!button) return;
      state.answerMode = button.dataset.ans;
      syncControls(); savePreferences();
      if (state.view !== 'quiz') setView('quiz');
      createNextQuestion();
    });
    dom.region.addEventListener('change', () => {
      state.region = REGIONS.includes(dom.region.value) ? dom.region.value : 'Mundo inteiro';
      savePreferences();
      if (state.view !== 'quiz') setView('quiz');
      createNextQuestion();
    });
    dom.visualToggle.addEventListener('change', () => {
      state.includeVisual = dom.visualToggle.checked;
      if (!state.includeVisual && (state.mode === 'flag' || state.mode === 'loc')) state.mode = 'cap';
      syncControls(); savePreferences();
      if (state.view !== 'quiz') setView('quiz');
      createNextQuestion();
      announce(state.includeVisual ? 'Perguntas visuais ativadas.' : 'Perguntas visuais desativadas; o treino usará capitais.');
    });
    dom.filterToggle.addEventListener('click', () => {
      const expanded = dom.filterToggle.getAttribute('aria-expanded') === 'true';
      dom.filterToggle.setAttribute('aria-expanded', String(!expanded));
      dom.controls.hidden = expanded;
      const icon = dom.filterToggle.querySelector('.filter-toggle-icon');
      if (icon) icon.textContent = expanded ? '+' : '−';
    });
    const desktopFilters = matchMedia('(min-width: 821px)');
    const restoreDesktopFilters = (event) => {
      if (!event.matches) return;
      dom.controls.hidden = false;
      dom.filterToggle.setAttribute('aria-expanded', 'true');
      const icon = dom.filterToggle.querySelector('.filter-toggle-icon');
      if (icon) icon.textContent = '−';
    };
    if (desktopFilters.addEventListener) desktopFilters.addEventListener('change', restoreDesktopFilters);
    else desktopFilters.addListener(restoreDesktopFilters);
    restoreDesktopFilters(desktopFilters);
    dom.mapToggle.addEventListener('click', () => setMapCollapsed(!state.mapCollapsed));
    dom.skipVisual.addEventListener('click', skipVisualQuestion);
    dom.zoomIn.addEventListener('click', () => zoomAt(1.4));
    dom.zoomOut.addEventListener('click', () => zoomAt(1 / 1.4));
    dom.zoomReset.addEventListener('click', resetMapView);
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const interactive = target && target.closest('button, input, select, textarea, a, [contenteditable="true"]');
      if (interactive || state.view !== 'quiz' || !state.question) return;
      if (!state.answered && /^[1-4]$/.test(event.key)) {
        const option = dom.panel.querySelectorAll('[data-answer]')[Number(event.key) - 1];
        if (option) { event.preventDefault(); option.click(); }
      } else if (state.answered && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); createNextQuestion({ focus: true });
      }
    });
    window.addEventListener('pagehide', flushLocalProgress);
  }

  function populateRegions() {
    clear(dom.region);
    REGIONS.forEach((region) => dom.region.append(create('option', { text: region, attrs: { value: region } })));
  }

  function setInitializing(active) {
    dom.shell.classList.toggle('is-initializing', active);
    [dom.topbar, dom.controls, dom.stage].forEach((element) => {
      if (active) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
    if (active) dom.stage.setAttribute('aria-busy', 'true');
    else dom.stage.removeAttribute('aria-busy');
  }

  async function initialize() {
    setInitializing(true);
    try {
      Core.assertDatasetInvariants(DATA, { requireGeometry: true });
      buildMap();
      populateRegions();
      loadPreferences();
      syncControls();
      await hydrateProgress();
      absorbPendingProgress();
      state.ready = true;
      bindMapEvents();
      bindControls();
      createNextQuestion();
    } catch (error) {
      setStorageStatus('O Atlas não pôde ser iniciado.', 'error', true);
      clear(dom.panel);
      dom.panel.append(create('h2', { className: 'panel-title', text: 'Falha ao iniciar' }));
      dom.panel.append(create('p', { className: 'note', text: 'Os dados locais falharam na validação. Gere novamente o arquivo final e recarregue.' }));
      console.error(error);
    } finally {
      setInitializing(false);
    }
  }

  window.addEventListener('storage', synchronizeProgress);
  initialize();
})();

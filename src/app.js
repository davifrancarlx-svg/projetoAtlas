(() => {
  'use strict';

  const Core = globalThis.AtlasCore;
  if (!Core) throw new Error('AtlasCore não foi carregado.');

  const IDS = DATA.map((country) => country.id);
  const byId = Object.fromEntries(DATA.map((country) => [country.id, country]));
  // Territórios que a cartografia entrega dentro do polígono de um soberano.
  // Não entram no sorteio nem viram resposta: apenas dão nome ao que está sob
  // o cursor e ganham ficha própria no Atlas.
  const TERRITORY_LIST = (typeof TERRITORIES === 'undefined' ? [] : TERRITORIES)
    .filter((territory) => byId[territory.of]);
  const territoriesByCountry = new Map();
  TERRITORY_LIST.forEach((territory) => {
    if (!territoriesByCountry.has(territory.of)) territoriesByCountry.set(territory.of, []);
    territoriesByCountry.get(territory.of).push(territory);
  });
  // Áreas de estudo: o mundo, cada balde amplo e as subregiões em que algum
  // deles se divide. O balde continua existindo como opção própria — quem quer
  // treinar as Américas inteiras não perde nada com a subdivisão.
  const STUDY_AREAS = [
    { value: 'Mundo inteiro', subregion: false },
    ...Core.studyAreasOf(DATA),
  ];
  const REGIONS = STUDY_AREAS.map((area) => area.value);
  const DIRECTIONS = Core.QUESTION_DIRECTIONS.slice();
  const MODE_DIRECTIONS = {
    mix: DIRECTIONS,
    flag: ['flag', 'flagOf'],
    cap: ['cap', 'capOf'],
    loc: ['locate', 'mapId'],
    reg: ['reg'],
  };
  const VISUAL_DIRECTIONS = new Set(['flag', 'flagOf', 'locate', 'mapId']);
  const PICK_ONLY = new Set(Core.PICK_ONLY_DIRECTIONS);
  const FAMILY_DIRECTIONS = {
    Bandeiras: ['flag', 'flagOf'],
    Capitais: ['cap', 'capOf'],
    Localização: ['locate', 'mapId'],
    Regiões: ['reg'],
  };
  const DIRECTION_LABEL = {
    flag: 'bandeira → país', flagOf: 'país → bandeira',
    cap: 'país → capital', capOf: 'capital → país',
    locate: 'país → mapa', mapId: 'mapa → país',
    reg: 'país → região',
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
  // 60× deixa o Vaticano e Mônaco com alguns pixels reais; a tolerância de
  // simplificação da geometria (0,06 unidade) só começa a aparecer bem acima
  // disso, então o teto é o que a cartografia sustenta.
  const MAX_ZOOM = 60;
  const MIN_VIEW_WIDTH = WORLD.w / MAX_ZOOM;
  // Área projetada abaixo da qual o país não rende nem um punhado de pixels,
  // e o zoom a partir do qual o marcador dele passa a valer a pena.
  const MICRO_AREA = 0.06;
  const MICRO_MARKER_ZOOM = 6;
  const HIT_GRID_SIZE = 24;

  const dom = {
    shell: document.getElementById('appShell'),
    topbar: document.querySelector('.topbar'),
    tabs: [...document.querySelectorAll('.tab[data-view]')],
    controls: document.getElementById('controls'),
    filterToggle: document.getElementById('filterToggle'),
    themeToggle: document.getElementById('themeToggle'),
    themeToggleIcon: document.getElementById('themeToggleIcon'),
    themeToggleHint: document.getElementById('themeToggleHint'),
    modeSeg: document.getElementById('modeSeg'),
    region: document.getElementById('regSel'),
    ansSeg: document.getElementById('ansSeg'),
    timeSeg: document.getElementById('timeSeg'),
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

  const TIME_LIMITS = [0, 30, 15];
  // Ciclo do botão de tema. 'auto' não escreve atributo nenhum na raiz: é a
  // ausência dele que devolve a palavra final ao sistema operacional.
  const THEMES = [
    { id: 'auto', icon: '◐', nome: 'automático, seguindo o sistema', curto: 'Tema automático' },
    { id: 'light', icon: '☀', nome: 'claro', curto: 'Tema claro' },
    { id: 'dark', icon: '☾', nome: 'escuro', curto: 'Tema escuro' },
  ];
  // Sentinela de resposta: nunca é igual a um ID, região ou capital, então o
  // estouro de tempo não pode ser confundido com uma resposta do jogador.
  const EXPIRED_ANSWER = Symbol('tempo esgotado');
  const state = {
    ready: false, view: 'quiz', mode: 'mix', region: 'Mundo inteiro', answerMode: 'pick',
    includeVisual: true, mapCollapsed: false, question: null, questionAnswerMode: 'pick', answered: false,
    selectedAnswer: null, answerMatch: null, answerTerritory: null, hits: 0, misses: 0, streak: 0,
    questionNumber: 0, recentIds: [], forcedQuestion: null,
    atlasSelected: 'BR', atlasQuery: '', atlasLimit: 60, resetArmed: false, resetPending: false,
    mapCursorId: 'BR',
    theme: 'auto',
    timeLimit: 0, askedAt: 0, expired: false,
    sessionAnswers: [], reviewQueue: [], fromDeck: false, deckPending: false, importStatus: null,
    // Prova: uma série fechada de perguntas com nota no fim. Vale para a sessão
    // atual e não é persistida — o que fica gravado é o progresso por país, que
    // a prova alimenta como qualquer outra resposta.
    exam: null,
  };

  // Relógio da pergunta: um intervalo curto move a barra, e o estouro entra
  // como erro pela mesma porta de uma resposta comum, para o progresso e a
  // revisão espaçada não enxergarem nada de diferente.
  const timer = { handle: 0, deadline: 0 };

  let progress = Core.createProgress();
  let saveTimer = 0;
  let saveChain = Promise.resolve();
  let atlasSearchTimer = 0;
  let announcementTimer = 0;
  let themeHintTimer = 0;
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

  // População e IDH são complementos da ficha e nunca viram pergunta. Os dois
  // saem sempre com o ano ao lado: mudam a cada edição das fontes, e um número
  // solto passaria a impressão de valor fixo. Quem não tem o dado mostra o
  // motivo em vez de sumir da ficha ou aparecer zerado.
  const numero = (valor, casas = 0) => new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  }).format(valor);

  // Cada indicador sai com o próprio ano porque as séries das fontes não andam
  // juntas: o IDH é de 2023, a densidade de 2023, a população de 2025.
  const INDICADORES = [
    { campo: 'pop', rotulo: 'População', formatar: (v) => `${numero(v)} hab.` },
    { campo: 'dens', rotulo: 'Densidade', formatar: (v) => `${numero(v, 1)} hab./km²` },
    { campo: 'vida', rotulo: 'Expectativa de vida', formatar: (v) => `${numero(v, 1)} anos` },
    { campo: 'urb', rotulo: 'População urbana', formatar: (v) => `${numero(v, 1)}%` },
    { campo: 'flor', rotulo: 'Área florestal', formatar: (v) => `${numero(v, 1)}%` },
    { campo: 'hdi', rotulo: 'IDH', formatar: (v) => numero(v, 3) },
  ];

  function indicadoresDe(country) {
    return INDICADORES
      .filter((item) => Number.isFinite(country[item.campo]))
      .map((item) => ({
        rotulo: item.rotulo,
        valor: item.formatar(country[item.campo]),
        ano: country[`${item.campo}Ano`],
      }));
  }

  function fatosDe(country) {
    return Core.derivedFacts(country, DATA, { territories: TERRITORY_LIST });
  }

  function themeStep(id) {
    const indice = THEMES.findIndex((tema) => tema.id === id);
    return indice === -1 ? 0 : indice;
  }

  function applyTheme(shouldAnnounce = false) {
    const indice = themeStep(state.theme);
    const atual = THEMES[indice];
    const proximo = THEMES[(indice + 1) % THEMES.length];
    if (atual.id === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = atual.id;
    if (dom.themeToggleIcon) dom.themeToggleIcon.textContent = atual.icon;
    if (dom.themeToggle) {
      dom.themeToggle.title = atual.curto;
      dom.themeToggle.setAttribute('aria-label', `Tema ${atual.nome}. Ativar tema ${proximo.nome}.`);
    }
    syncThemeColor();
    if (shouldAnnounce) announce(`Tema ${atual.nome}.`);
    return atual;
  }

  // Ir de automático para claro (ou de escuro para automático, num sistema
  // escuro) às vezes não muda nenhuma cor na tela: o resultado visual já era
  // o mesmo antes do clique. Sem aviso, esse clique parece não ter feito
  // nada e a pessoa clica de novo achando que precisa de dois cliques. Este
  // balão confirma o nome do tema em texto, que sempre muda mesmo quando a
  // cor não muda, e some sozinho.
  function showThemeHint(texto) {
    if (!dom.themeToggleHint) return;
    clearTimeout(themeHintTimer);
    dom.themeToggleHint.textContent = texto;
    dom.themeToggleHint.classList.add('is-visible');
    themeHintTimer = setTimeout(() => dom.themeToggleHint.classList.remove('is-visible'), 1600);
  }

  // A cor da barra do navegador vem de duas metas com media query, que seguem o
  // sistema. Com o tema fixado no app elas apontariam para o lado errado, então
  // uma terceira meta sem media entra na frente — o navegador usa a primeira que
  // casa, em ordem de documento. O valor sai do próprio token, para não existir
  // cor escrita à mão fora da paleta.
  function syncThemeColor() {
    const fixado = state.theme === 'light' || state.theme === 'dark';
    const existente = document.getElementById('themeColorOverride');
    if (!fixado) {
      if (existente) existente.remove();
      return;
    }
    const meta = existente || create('meta', { id: 'themeColorOverride', attrs: { name: 'theme-color' } });
    if (!existente) document.head.prepend(meta);
    const cor = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
    if (cor) meta.setAttribute('content', cor);
  }

  function savePreferences() {
    const safe = {
      mode: state.mode, region: state.region, answerMode: state.answerMode,
      includeVisual: state.includeVisual, mapCollapsed: state.mapCollapsed,
      timeLimit: state.timeLimit, theme: state.theme,
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
      if (TIME_LIMITS.includes(parsed.timeLimit)) state.timeLimit = parsed.timeLimit;
      if (THEMES.some((tema) => tema.id === parsed.theme)) state.theme = parsed.theme;
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
    nodesById: new Map(), hitGrid: new Map(), reticle: null, reticleId: null, reticlePoint: null,
    microMarkers: [],
    pointers: new Map(), gesture: null, pendingPan: null, panFrame: 0,
    metrics: null, hoverFrame: 0, pendingHover: null,
  };

  const PROJECTION = MAP_META && MAP_META.projection ? MAP_META.projection : null;
  function robinson(lon, lat) { return Core.project(lon, lat, PROJECTION); }
  function inverseRobinson(x, y) { return Core.unproject(x, y, PROJECTION); }

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
    // As terras fora dos 195. Antes vinham fundidas numa mancha só, sem nome:
    // a Groenlândia e a Antártida eram o mesmo borrão cinza. Agora cada uma é
    // desenhada por si, e a cor diz o que ela é — dependência de um dos 195,
    // área disputada ou área sem soberania. Nenhuma responde pergunta: seguem
    // fora do escopo do quiz e por isso não recebem foco de teclado.
    if (Array.isArray(CONTEXT_AREAS) && CONTEXT_AREAS.length) {
      const contexto = svgElement('g', { 'aria-hidden': 'true' });
      CONTEXT_AREAS.forEach((area) => {
        contexto.append(svgElement('path', {
          d: area.d,
          class: `context-land is-${area.grupo}`,
          'data-context': area.code,
          'fill-rule': 'evenodd',
          'clip-rule': 'evenodd',
        }));
      });
      mapState.root.append(contexto);
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
    // Vaticano, Mônaco, Tuvalu, Nauru e San Marino ocupam frações de pixel na
    // escala 1:10m — mesmo no zoom máximo. Ganham um anel de tamanho fixo em
    // pixels, que aparece só quando o jogador já está aproximando o suficiente
    // para procurá-los, e nunca intercepta o ponteiro: a resolução de cliques
    // continua sendo a geometria real mais as âncoras de toque.
    DATA.filter((country) => country.a <= MICRO_AREA).forEach((country) => {
      const marker = svgElement('g', { class: 'micro', 'data-id': country.id });
      marker.append(svgElement('circle', { cx: 0, cy: 0, r: 7, class: 'micro-ring' }));
      marker.append(svgElement('circle', { cx: 0, cy: 0, r: 1.6, class: 'micro-dot' }));
      mapState.markers.append(marker);
      mapState.microMarkers.push({ marker, point: country.c });
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
    mapState.reticlePoint = null;
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

  function showReticle(id, point) {
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
    mapState.reticlePoint = Array.isArray(point) && point.every(Number.isFinite) ? point : country.c;
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

  const clamp = Core.clampNumber;
  const VIEW_OPTIONS = { minimumWidth: MIN_VIEW_WIDTH };

  function applyMapView(view) {
    mapState.view = view;
    dom.map.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    mapState.metrics = null;
    updateMapScaleSensitiveElements();
    updateZoomControls();
    updateReadout();
  }

  function setMapView(x, y, width) {
    applyMapView(Core.clampView({ x, y, w: width, h: width * WORLD.h / WORLD.w }, WORLD, VIEW_OPTIONS));
  }

  function zoomAt(factor, center) {
    applyMapView(Core.zoomView(mapState.view, factor, center, WORLD, VIEW_OPTIONS));
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

  function territoriesOf(countryId) { return territoriesByCountry.get(countryId) || []; }

  function territoryAt(countryId, point) {
    if (!Array.isArray(point)) return null;
    const [longitude, latitude] = inverseRobinson(point[0], point[1]);
    return Core.territoryForPoint(TERRITORY_LIST, countryId, longitude, latitude);
  }

  function mapLabel(countryId, point) {
    const territory = territoryAt(countryId, point);
    return territory ? `${territory.n} (${byId[countryId].n})` : byId[countryId].n;
  }

  const CONTEXT_BY_CODE = Object.create(null);
  (Array.isArray(CONTEXT_AREAS) ? CONTEXT_AREAS : []).forEach((area) => { CONTEXT_BY_CODE[area.code] = area; });

  function contextAreaAt(target) {
    const code = target && target.dataset ? target.dataset.context : null;
    return code ? CONTEXT_BY_CODE[code] || null : null;
  }

  // A dependência é dita pelo soberano — "Groenlândia (Dinamarca)" — e as
  // demais dizem o próprio estatuto, sem apontar dono, porque afirmar soberania
  // sobre área disputada seria tomar posição que o Atlas não sustenta.
  function contextLabel(area) {
    if (area.grupo === 'dependencia' && byId[area.of]) return `${area.n} (${byId[area.of].n})`;
    return `${area.n} · ${area.grupo === 'disputado' ? 'soberania disputada' : 'sem soberania'}`;
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
      // Fora do quiz o rótulo é livre; dentro dele só depois da resposta, para
      // não entregar o alvo de uma pergunta visual.
      const mayReveal = state.view !== 'quiz' || state.answered;
      if (hoverId) {
        dom.hoverName.textContent = mayReveal ? mapLabel(hoverId, point) : '';
        return;
      }
      // Nenhum dos 195 sob o cursor: pode ser uma das terras de contexto. Elas
      // não são resposta de pergunta, então o rótulo aparece sempre — não há
      // alvo a entregar, e é justamente aqui que antes ficava a mancha muda.
      const contexto = contextAreaAt(pending.target);
      dom.hoverName.textContent = contexto ? contextLabel(contexto) : '';
    });
  }

  function updateReadout(clientX, clientY, providedPoint) {
    const center = clientX === undefined
      ? [mapState.view.x + mapState.view.w / 2, mapState.view.y + mapState.view.h / 2]
      : (providedPoint || screenToWorld(clientX, clientY));
    const [longitude, latitude] = inverseRobinson(center[0], center[1]);
    dom.readout.textContent = `lon ${longitude >= 0 ? '+' : ''}${longitude.toFixed(1)}° · lat ${latitude >= 0 ? '+' : ''}${latitude.toFixed(1)}° · zoom ${(WORLD.w / mapState.view.w).toFixed(1)}×`;
  }

  function activateMapCountry(id, point) {
    if (!id || !byId[id]) return;
    const territory = territoryAt(id, point);
    setMapCursor(id, false);
    if (state.view === 'quiz' && state.question && state.question.direction === 'locate' && !state.answered) {
      return answerQuestion(id, territory);
    }
    if (state.view === 'quiz') {
      announce('O mapa é apenas referência nesta pergunta.');
      return;
    }
    if (state.view === 'atlas') return selectAtlasCountry(id, true, territory);
    showReticle(id, territory ? territoryPoint(territory) : null);
    announce(territory
      ? `${territory.n}: ${territory.status}. Capital regional ${territory.cap}.`
      : `${byId[id].n}, capital ${byId[id].cap}.`);
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
        const point = screenToWorld(clientX, clientY);
        activateMapCountry(countryAt(clientX, clientY, target, point) || gesture.countryId, point);
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
    // No modo digitar as direções que só existem como escolha saem da mistura,
    // mas se o modo inteiro for feito delas — como Regiões — o treino mantém o
    // assunto e responde por escolha, em vez de virar outro treino sem avisar.
    if (state.answerMode === 'type') {
      const typed = directions.filter((direction) => !PICK_ONLY.has(direction));
      if (typed.length) directions = typed;
    }
    if (!state.includeVisual) directions = directions.filter((direction) => !VISUAL_DIRECTIONS.has(direction));
    return directions.length ? directions : ['cap', 'capOf'];
  }

  function createNextQuestion(options = {}) {
    if (!state.ready) return;
    stopTimer();
    // A série fechada termina aqui: em vez de sortear mais uma, entrega a nota.
    if (examFinished()) { renderExamResult(); return; }
    // O baralho de erros tem prioridade sobre o sorteio: enquanto houver carta
    // na fila, é ela que vira pergunta. `fromDeck` sobrevive à fila esvaziada
    // para que a última carta ainda se apresente como revisão.
    if (!state.forcedQuestion && state.reviewQueue.length) {
      state.forcedQuestion = state.reviewQueue.shift();
      state.fromDeck = true;
      if (!state.reviewQueue.length) announce('Última carta do baralho de erros.');
    } else if (!state.deckPending) {
      state.fromDeck = false;
    }
    state.deckPending = false;
    const forced = state.forcedQuestion;
    state.forcedQuestion = null;
    const directions = forced ? [forced.direction] : effectiveDirections();
    const questionAnswerMode = directions.every((direction) => PICK_ONLY.has(direction))
      ? 'pick' : state.answerMode;
    const result = Core.createQuestion({
      countries: DATA,
      mode: state.mode,
      directions,
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
    state.answerTerritory = null;
    state.expired = false;
    state.questionNumber += 1;
    state.askedAt = Date.now();
    renderQuiz();
    syncMapForQuestion();
    startTimer();
    if (options.focus) {
      document.getElementById('questionTitle')?.focus();
      announce(questionCopy(state.question)[0]);
    }
  }

  function stopTimer() {
    if (timer.handle) clearInterval(timer.handle);
    timer.handle = 0;
    timer.deadline = 0;
  }

  function startTimer() {
    stopTimer();
    if (!state.timeLimit || state.view !== 'quiz' || state.answered) return;
    timer.deadline = Date.now() + state.timeLimit * 1000;
    updateTimerDisplay();
    timer.handle = setInterval(() => {
      if (state.answered || state.view !== 'quiz') { stopTimer(); return; }
      if (Date.now() >= timer.deadline) { stopTimer(); expireQuestion(); return; }
      updateTimerDisplay();
    }, 200);
  }

  function updateTimerDisplay() {
    const bar = document.getElementById('questionTimer');
    if (!bar) return;
    const remaining = Math.max(0, timer.deadline - Date.now());
    bar.value = remaining;
    const seconds = Math.ceil(remaining / 1000);
    bar.dataset.low = String(seconds <= 5);
    const label = document.getElementById('questionTimerLabel');
    if (label) label.textContent = `${seconds}s`;
  }

  // O estouro do tempo é registrado como erro pelo mesmo caminho de uma
  // resposta errada, inclusive no modo digitar, onde uma string vazia seria
  // rejeitada antes de virar resposta.
  function expireQuestion() {
    if (!state.question || state.answered) return;
    state.expired = true;
    answerQuestion(EXPIRED_ANSWER);
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
      reg: [`Em que região fica ${country.n}?`, 'País → região'],
    }[question.direction];
  }
  function isVisualQuestion(question = state.question) {
    return Boolean(question && VISUAL_DIRECTIONS.has(question.direction));
  }
  function optionLabel(direction, country) { return direction === 'cap' ? country.cap : country.n; }
  function answerField(direction) { return direction === 'cap' ? 'capital' : 'country'; }
  function expectedAnswer(direction, country) {
    if (direction === 'reg') return country.r;
    return answerField(direction) === 'capital' ? country.cap : country.n;
  }

  function answerQuestion(value, territory) {
    if (!state.question || state.answered) return;
    const target = byId[state.question.id];
    let correct;
    let match = null;
    if (value === EXPIRED_ANSWER) {
      correct = false;
    } else if (state.question.direction === 'reg') {
      correct = value === target.r;
    } else if (state.question.direction === 'locate' || state.questionAnswerMode === 'pick') {
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
    stopTimer();
    state.answered = true;
    state.selectedAnswer = value === EXPIRED_ANSWER ? null : value;
    state.answerMatch = match;
    state.answerTerritory = territory || null;
    if (correct) { state.hits += 1; state.streak += 1; }
    else { state.misses += 1; state.streak = 0; }
    signalAnswer(correct);
    const registro = {
      id: target.id,
      direction: state.question.direction,
      correct,
      expired: state.expired,
      ms: state.askedAt ? Math.max(0, Date.now() - state.askedAt) : null,
    };
    state.sessionAnswers.push(registro);
    // A revisão de erros não consome perguntas da prova: só contam as da série.
    if (state.exam && !state.fromDeck && state.exam.done < state.exam.total) {
      state.exam.done += 1;
      state.exam.answers.push(registro);
    }
    progress = Core.recordAnswer(progress, target.id, state.question.direction, correct, {
      countryIds: IDS, bestStreak: state.streak,
    });
    queueProgressSave();
    scheduleCloudSync();
    renderQuiz();
    syncMapForQuestion(correct);
    const expected = expectedAnswer(state.question.direction, target);
    const marked = state.answerTerritory
      ? ` Você marcou a ${state.answerTerritory.n}. ${state.answerTerritory.status}.` : '';
    const verdict = correct
      ? `Correto. ${expected}.`
      : `${state.expired ? 'Tempo esgotado' : 'Resposta incorreta'}. A resposta é ${expected}.`;
    announce(verdict + marked);
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
      // Perguntas como "capital → país" nunca mexiam no mapa: o país acertado
      // ficava só marcado em verde, invisível no zoom do mundo se fosse pequeno
      // (Maurício, San Marino, Bahrein...). Zoom automático no revelar (fitCountry)
      // resolvia a invisibilidade mas trocava o enquadramento a cada resposta, o
      // que incomodava ao jogar. O pin (mesmo reticle do "mapa → país") já é um
      // marcador de tamanho fixo em pixels, visível em qualquer zoom, sem mexer
      // na visão que a pessoa escolheu.
      showReticle(question.id);
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
    if (question.direction === 'reg') {
      const regions = create('div', { className: 'opts' });
      question.opts.forEach((region, index) => {
        const classNames = ['opt'];
        if (state.answered && region === byId[question.id].r) classNames.push('right');
        if (state.answered && region === state.selectedAnswer && region !== byId[question.id].r) classNames.push('wrong');
        const button = create('button', { className: classNames.join(' '), type: 'button', attrs: {
          'data-answer': region, disabled: state.answered ? '' : null,
        } });
        button.append(create('span', { className: 'key', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }));
        button.append(document.createTextNode(region));
        button.addEventListener('click', () => answerQuestion(region));
        regions.append(button);
      });
      container.append(regions);
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
    const territory = state.answerTerritory;
    if (territory && byId[territory.of]) {
      const sovereign = byId[territory.of];
      notes.push(`Você marcou a ${territory.n}. ${territory.status}, com capital regional `
        + `${territory.cap} — por isso o ponto ${territory.of === country.id ? 'vale' : 'foi lido'} como `
        + `${sovereign.n}, cuja capital é ${sovereign.cap}.`);
    }
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
    const isCorrect = question.direction === 'reg'
      ? state.selectedAnswer === country.r
      : (question.direction === 'locate' || state.questionAnswerMode === 'pick'
        ? state.selectedAnswer === question.id : Boolean(state.answerMatch && state.answerMatch.ok));
    const verdict = create('section', { className: 'verdict', attrs: { 'aria-labelledby': 'verdictTitle' } });
    verdict.append(create('p', {
      id: 'verdictTitle', className: `verdict-tag ${isCorrect ? 'ok' : 'bad'}`,
      text: isCorrect ? 'Correto' : (state.expired ? 'Tempo esgotado' : 'Resposta incorreta'),
    }));
    const fact = create('div', { className: 'factrow' });
    fact.append(flagImage(country));
    fact.append(create('div', {}, [
      create('div', { className: 'factname', text: country.n }),
      create('div', { className: 'factmeta', text: `${country.cap} · ${country.sr} · ${formatArea(country.ar)}` }),
    ]));
    verdict.append(fact);

    // No acerto, um destaque do país. Só um: a série é rápida e despejar cinco
    // frases a cada resposta viraria ruído. Qual deles aparece varia com o
    // número da pergunta, então repetir o mesmo país não repete o mesmo fato.
    if (isCorrect) {
      const fatos = fatosDe(country);
      if (fatos.length) {
        verdict.append(create('p', {
          className: 'fato-destaque',
          text: fatos[state.questionNumber % fatos.length],
        }));
      }
    }

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
      create('span', { text: state.fromDeck
        ? `Revisão de erros · ${state.reviewQueue.length ? `faltam ${state.reviewQueue.length + 1}` : 'última carta'}`
        : (state.exam
          ? `Prova · ${Math.min(state.exam.done + 1, state.exam.total)} de ${state.exam.total}`
          : `Pergunta ${state.questionNumber}`) }),
      create('span', { text: DIRECTION_LABEL[question.direction] }),
    ]));
    if (state.timeLimit && !state.answered) {
      const total = state.timeLimit * 1000;
      const row = create('div', { className: 'timerrow' });
      row.append(create('progress', {
        id: 'questionTimer', className: 'timer-bar',
        attrs: { max: total, value: total, 'aria-label': `Tempo restante da pergunta, limite de ${state.timeLimit} segundos` },
      }));
      row.append(create('span', {
        id: 'questionTimerLabel', className: 'timer-label',
        text: `${state.timeLimit}s`, attrs: { 'aria-hidden': 'true' },
      }));
      dom.panel.append(row);
    }
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

  function matchedTerritory(country, query) {
    if (!query) return null;
    return territoriesOf(country.id).find((territory) => (
      [territory.n, territory.cap, territory.r, territory.sr].map(Core.normalizeText).join(' ').includes(query)
    )) || null;
  }

  function atlasMatches() {
    const query = Core.normalizeText(state.atlasQuery);
    const sorted = DATA.slice().sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
    if (!query) return sorted;
    return sorted.filter((country) => {
      const aliases = (country.aliases || []).map((alias) => alias.value);
      if ([country.n, country.cap, country.r, country.sr, ...aliases].map(Core.normalizeText).join(' ').includes(query)) return true;
      // Quem procura por "Guiana Francesa" ou "Caiena" precisa achar o país que
      // responde por esse território, com a distinção explicada na ficha.
      return Boolean(matchedTerritory(country, query));
    });
  }

  function renderAtlas() {
    setMapCursor(state.atlasSelected, false);
    clear(dom.panel);
    renderScorebar();
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: 'Atlas dos países' }),
      create('span', { text: TERRITORY_LIST.length ? `195 estados · ${TERRITORY_LIST.length} territórios` : '195 estados' }),
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
      create('p', { text: `${country.sr} · ${formatArea(country.ar)}` }),
    ]);
    atlasElements.detail.append(flagImage(country, { eager: true }), copy);

    const indicadores = indicadoresDe(country);
    if (indicadores.length) {
      const lista = create('dl', { className: 'indicadores' });
      indicadores.forEach((item) => {
        lista.append(
          create('dt', { text: item.rotulo }),
          create('dd', {}, [
            create('span', { className: 'valor', text: item.valor }),
            // O ano fica visivelmente secundário: precisa estar lá para o número
            // não passar por permanente, sem competir com ele na leitura.
            create('span', { className: 'ano', text: String(item.ano) }),
          ])
        );
      });
      atlasElements.detail.append(lista);
    }

    const fatos = fatosDe(country);
    if (fatos.length) {
      const bloco = create('ul', { className: 'fatos', attrs: { 'aria-label': `Destaques de ${country.n}` } });
      fatos.forEach((fato) => bloco.append(create('li', { text: fato })));
      atlasElements.detail.append(bloco);
    }

    // A explicação da ausência só aparece para quem realmente não tem o dado.
    [country.bmNota, country.hdiNota].filter(Boolean).forEach((nota) => {
      atlasElements.detail.append(create('p', { className: 'note', text: nota }));
    });
    atlasElements.detail.append(create('p', {
      className: 'source-note',
      text: `Indicadores: ${INDICATOR_META.bancoMundial.fonte} (${INDICATOR_META.bancoMundial.licenca}). IDH: ${INDICATOR_META.idh.fonte}.`,
    }));
    territoriesOf(country.id).forEach((territory) => {
      atlasElements.detail.append(territoryCard(country, territory));
    });
  }

  function territoryCard(country, territory) {
    const card = create('div', { className: 'territory-card', attrs: { 'data-territory': territory.id } });
    card.append(create('h4', {}, [
      create('span', { text: territory.n }),
      create('span', { className: 'territory-tag', text: territory.tag || 'território' }),
    ]));
    card.append(create('p', { className: 'territory-meta', text: `${territory.status} · capital regional ${territory.cap}` }));
    card.append(create('p', { className: 'territory-meta', text: `${territory.sr} · ${formatArea(territory.ar)}` }));
    (territory.notes || []).forEach((note) => card.append(create('p', { className: 'note', text: note })));
    const locate = create('button', {
      className: 'btn ghost', type: 'button', text: `Ver ${territory.n} no mapa`,
    });
    locate.addEventListener('click', () => {
      clearMapMarks();
      markCountry(country.id, 'on');
      showReticle(country.id, territoryPoint(territory));
      fitTerritory(territory);
      announce(`${territory.n} no mapa. ${territory.status}. Capital regional ${territory.cap}.`);
    });
    card.append(locate);
    return card;
  }

  function renderAtlasList() {
    if (!atlasElements) return;
    const matches = atlasMatches();
    const visible = matches.slice(0, state.atlasLimit);
    clear(atlasElements.list);
    atlasElements.count.textContent = `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}`;
    const query = Core.normalizeText(state.atlasQuery);
    visible.forEach((country) => {
      const territory = matchedTerritory(country, query);
      const row = create('button', { className: 'row', type: 'button', attrs: {
        'data-country': country.id, 'aria-current': country.id === state.atlasSelected ? 'true' : null,
      } });
      row.append(flagImage(country, { decorative: true }), create('span', { className: 'row-txt' }, [
        create('span', { className: 'row-n', text: country.n }),
        create('span', { className: 'row-c', text: territory ? `${country.cap} · inclui ${territory.n}` : `${country.cap} · ${country.sr}` }),
      ]));
      row.addEventListener('click', () => selectAtlasCountry(country.id, true, territory));
      atlasElements.list.append(row);
    });
    atlasElements.more.hidden = visible.length >= matches.length;
    atlasElements.more.textContent = `Mostrar mais (${matches.length - visible.length})`;
    if (!matches.length) atlasElements.list.append(create('p', { className: 'empty', text: 'Nenhum país, capital ou região corresponde à busca.' }));
  }

  function selectAtlasCountry(id, fit = false, territory = null) {
    if (!byId[id]) return;
    const focused = territory && territory.of === id ? territory : null;
    state.atlasSelected = id;
    setMapCursor(id, false);
    clearMapMarks();
    markCountry(id, 'on');
    showReticle(id, focused ? territoryPoint(focused) : null);
    if (fit) {
      if (focused) fitTerritory(focused);
      else fitCountry(id);
    }
    renderAtlasDetail();
    if (atlasElements) atlasElements.list.querySelectorAll('[data-country]').forEach((row) => {
      if (row.dataset.country === id) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
    if (focused && atlasElements) {
      const card = atlasElements.detail.querySelector(`[data-territory="${focused.id}"]`);
      if (card) card.classList.add('is-focused');
    }
    announce(focused
      ? `${focused.n}. ${focused.status}. Capital regional ${focused.cap}. Selecionado como ${byId[id].n}.`
      : `${byId[id].n}. Capital ${byId[id].cap}. ${byId[id].sr}.`);
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

  // Cada habilidade errada entra uma vez só no baralho, na ordem em que foi
  // errada, e sai se depois tiver sido acertada na mesma sessão.
  function sessionMistakes() {
    const outcome = new Map();
    state.sessionAnswers.forEach((answer) => {
      outcome.set(`${answer.id}:${answer.direction}`, answer.correct);
    });
    const seen = new Set();
    const mistakes = [];
    state.sessionAnswers.forEach((answer) => {
      const key = `${answer.id}:${answer.direction}`;
      if (answer.correct || outcome.get(key) || seen.has(key)) return;
      seen.add(key);
      mistakes.push({ id: answer.id, direction: answer.direction });
    });
    return mistakes;
  }

  function sessionStats() {
    const answers = state.sessionAnswers;
    const hits = answers.filter((answer) => answer.correct).length;
    const timed = answers.filter((answer) => Number.isFinite(answer.ms) && answer.ms > 0);
    const average = timed.length
      ? timed.reduce((total, answer) => total + answer.ms, 0) / timed.length / 1000 : null;
    return {
      total: answers.length,
      hits,
      misses: answers.length - hits,
      expired: answers.filter((answer) => answer.expired).length,
      accuracy: answers.length ? hits / answers.length * 100 : 0,
      averageSeconds: average,
    };
  }

  // No celular o veredito costuma ficar fora do campo de visão, embaixo do
  // mapa: um toque curto avisa o erro sem precisar procurar na tela. Só no
  // erro, porque vibrar a cada acerto vira ruído numa sessão longa. Quem pediu
  // menos movimento ao sistema não recebe nada disso.
  function signalAnswer(correct) {
    if (correct || typeof navigator.vibrate !== 'function') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try { navigator.vibrate(35); } catch (_) { /* aparelho pode recusar */ }
  }

  // --- prova --------------------------------------------------------------
  // O treino livre não termina nunca, o que é bom para revisar e ruim para
  // medir. A prova fecha uma série de N perguntas e entrega uma nota.

  function startExam(total) {
    state.exam = { total, done: 0, answers: [], startedAt: Date.now() };
    state.reviewQueue = [];
    state.forcedQuestion = null;
    state.fromDeck = false;
    setView('quiz');
    createNextQuestion({ focus: true });
    announce(`Prova iniciada com ${total} perguntas.`);
  }

  function endExam() {
    state.exam = null;
    createNextQuestion({ focus: true });
  }

  function examFinished() {
    return Boolean(state.exam) && state.exam.done >= state.exam.total;
  }

  function examStats() {
    const answers = state.exam.answers;
    const hits = answers.filter((answer) => answer.correct).length;
    const timed = answers.filter((answer) => Number.isFinite(answer.ms) && answer.ms > 0);
    return {
      total: answers.length,
      hits,
      misses: answers.length - hits,
      accuracy: answers.length ? (hits / answers.length) * 100 : 0,
      seconds: Math.round((Date.now() - state.exam.startedAt) / 1000),
      averageSeconds: timed.length
        ? timed.reduce((sum, answer) => sum + answer.ms, 0) / timed.length / 1000
        : null,
    };
  }

  function renderExamResult() {
    const stats = examStats();
    atlasElements = null;
    clear(dom.panel);
    stopTimer();
    clearMapMarks();

    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: 'Prova concluída' }),
      create('span', { text: `${stats.total} ${stats.total === 1 ? 'pergunta' : 'perguntas'}` }),
    ]));
    dom.panel.append(create('h2', {
      id: 'questionTitle', className: 'subject', attrs: { tabindex: '-1' },
      text: `${stats.hits} de ${stats.total}`,
    }));

    const minutos = Math.floor(stats.seconds / 60);
    const resto = stats.seconds % 60;
    const linha = [
      `${formatPercent(stats.accuracy)} de acerto`,
      minutos ? `${minutos}min ${resto}s no total` : `${resto}s no total`,
      stats.averageSeconds !== null ? `${stats.averageSeconds.toFixed(1).replace('.', ',')}s por pergunta` : null,
    ].filter(Boolean);
    dom.panel.append(create('p', { className: 'section-copy', text: linha.join(' · ') }));

    const errados = state.exam.answers.filter((answer) => !answer.correct);
    if (errados.length) {
      const bloco = create('section', { className: 'pgroup' });
      bloco.append(create('h3', { text: errados.length === 1 ? 'O erro da prova' : `Os ${errados.length} erros da prova` }));
      const lista = create('div', { className: 'weak' });
      errados.slice(0, 20).forEach((item) => {
        const chip = create('button', {
          className: 'chip', type: 'button',
          text: `${byId[item.id].n} · ${DIRECTION_LABEL[item.direction]}`,
        });
        chip.addEventListener('click', () => { state.exam = null; startReview(item.id, item.direction); });
        lista.append(chip);
      });
      bloco.append(lista);

      // Reaproveita o baralho de erros: a prova aponta o que revisar e a
      // revisão já existente cuida do resto.
      const revisar = create('button', { className: 'btn wide', type: 'button', text: 'Revisar os erros agora' });
      revisar.addEventListener('click', () => {
        const cartas = errados.map((item) => ({ id: item.id, direction: item.direction }));
        state.exam = null;
        state.reviewQueue = cartas.slice(1);
        state.forcedQuestion = cartas[0];
        state.fromDeck = true;
        state.deckPending = true;
        createNextQuestion({ focus: true });
      });
      bloco.append(revisar);
      dom.panel.append(bloco);
    } else {
      dom.panel.append(create('p', { className: 'empty', text: 'Nenhum erro. Prova perfeita.' }));
    }

    const acoes = create('div', { className: 'button-row' });
    const refazer = create('button', { className: 'btn', type: 'button', text: 'Nova prova' });
    refazer.addEventListener('click', () => startExam(state.exam ? state.exam.total : 20));
    const voltar = create('button', { className: 'btn ghost', type: 'button', text: 'Voltar ao treino livre' });
    voltar.addEventListener('click', endExam);
    acoes.append(refazer, voltar);
    dom.panel.append(acoes);

    renderScorebar();
    announce(`Prova concluída. ${stats.hits} de ${stats.total} corretas.`);
    const titulo = document.getElementById('questionTitle');
    if (titulo) titulo.focus();
  }

  function startMistakeDeck() {
    const mistakes = sessionMistakes();
    if (!mistakes.length) return;
    state.reviewQueue = mistakes.slice(1);
    state.forcedQuestion = mistakes[0];
    state.fromDeck = true;
    state.deckPending = true;
    setView('quiz');
    createNextQuestion({ focus: true });
    announce(`Baralho de erros iniciado com ${mistakes.length} ${mistakes.length === 1 ? 'carta' : 'cartas'}.`);
  }

  function renderSessionSummary(container) {
    const stats = sessionStats();
    const section = create('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'sessionTitle' } });
    section.append(create('h3', { id: 'sessionTitle', text: 'Esta sessão' }));
    if (!stats.total) {
      section.append(create('p', { className: 'empty', text: 'Nenhuma pergunta respondida nesta sessão ainda.' }));
      container.append(section);
      return;
    }
    const facts = [
      `${stats.total} ${stats.total === 1 ? 'pergunta' : 'perguntas'}`,
      `${formatPercent(stats.accuracy)} de precisão`,
      stats.averageSeconds !== null ? `${stats.averageSeconds.toFixed(1).replace('.', ',')}s por resposta` : null,
      stats.expired ? `${stats.expired} por tempo esgotado` : null,
    ].filter(Boolean);
    section.append(create('p', { className: 'section-copy', text: facts.join(' · ') }));

    const mistakes = sessionMistakes();
    if (mistakes.length) {
      const deck = create('button', {
        className: 'btn wide', type: 'button',
        text: mistakes.length === 1
          ? 'Revisar o erro desta sessão'
          : `Revisar os ${mistakes.length} erros desta sessão`,
      });
      deck.addEventListener('click', startMistakeDeck);
      section.append(deck);
      const list = create('div', { className: 'weak' });
      mistakes.slice(0, 12).forEach((item) => {
        const chip = create('button', {
          className: 'chip', type: 'button',
          text: `${byId[item.id].n} · ${DIRECTION_LABEL[item.direction]}`,
        });
        chip.addEventListener('click', () => startReview(item.id, item.direction));
        list.append(chip);
      });
      section.append(list);
    } else {
      section.append(create('p', { className: 'empty', text: 'Nenhum erro pendente nesta sessão.' }));
    }
    container.append(section);
  }

  function progressFileName() {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    return `atlas-195-progresso-${stamp}.json`;
  }

  function exportProgress() {
    const serialized = Core.serializeProgress(progress, { countryIds: IDS });
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = create('a', { attrs: { href: url, download: progressFileName() } });
    document.body.append(link);
    link.click();
    link.remove();
    // O objeto fica vivo até o download começar; um tempo curto basta e evita
    // vazar a URL na sessão.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    const studied = Object.keys(progress.countries || {}).length;
    state.importStatus = { kind: 'ok', text: `Arquivo gerado com ${studied} ${studied === 1 ? 'país' : 'países'} no histórico.` };
    renderProgress();
    announce('Progresso exportado para arquivo.');
  }

  // A importação funde, nunca sobrescreve: mergeProgress resolve por geração,
  // época e revisão, então trazer um backup antigo não apaga o que já existe
  // neste navegador, e um reset mais recente continua vencendo.
  async function importProgressFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      state.importStatus = { kind: 'error', text: 'Arquivo grande demais para ser um progresso do Atlas.' };
      renderProgress();
      announce('Arquivo recusado: tamanho incompatível.');
      return;
    }
    let raw;
    try {
      raw = await file.text();
    } catch (_) {
      state.importStatus = { kind: 'error', text: 'Não foi possível ler o arquivo escolhido.' };
      renderProgress();
      return;
    }
    const decoded = Core.deserializeProgress(raw, { countryIds: IDS });
    if (decoded.recovered) {
      state.importStatus = { kind: 'error', text: 'Este arquivo não é um progresso válido do Atlas 195. Nada foi alterado.' };
      renderProgress();
      announce('Importação recusada: arquivo inválido.');
      return;
    }
    const before = Core.serializeProgress(progress, { countryIds: IDS });
    const merged = Core.mergeProgress(progress, decoded.progress, { countryIds: IDS });
    const after = Core.serializeProgress(merged, { countryIds: IDS });
    progress = merged;
    const incomingCountries = Object.keys(decoded.progress.countries || {}).length;
    const totalCountries = Object.keys(merged.countries || {}).length;
    if (after === before) {
      state.importStatus = { kind: 'ok', text: 'Arquivo válido, mas ele não trazia nada novo além do que já estava aqui.' };
    } else {
      queueProgressSave(true);
      state.importStatus = {
        kind: 'ok',
        text: `Progresso fundido: ${incomingCountries} ${incomingCountries === 1 ? 'país' : 'países'} no arquivo, `
          + `${totalCountries} no histórico agora.`,
      };
    }
    renderProgress();
    announce(state.importStatus.text);
  }

  /* ------------------------------------------------------------------ *
   * Conta (opcional)
   *
   * O aparelho continua sendo o dono do progresso: a conta é uma cópia que
   * sincroniza. Tudo aqui falha em silêncio — sem rede, sem conta ou com o
   * servidor fora do ar, o treino segue exatamente como antes.
   * ------------------------------------------------------------------ */

  const SESSION_KEY = 'atlas195:conta:v1';
  const CLOUD_CONFIG = typeof CLOUD === 'undefined' ? null : CLOUD;
  const cloud = { session: null, status: null, syncing: false, timer: 0, lastSyncAt: null };

  function cloudEnabled() {
    return Core.cloudReady(CLOUD_CONFIG, location.protocol);
  }

  function readSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!parsed || typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') return null;
      return parsed;
    } catch (_) { return null; }
  }

  function writeSession(session) {
    cloud.session = session;
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) { /* modo privado: a sessão vale só enquanto a aba viver */ }
  }

  function setCloudStatus(text, kind = '') {
    cloud.status = text ? { text, kind } : null;
    if (state.view === 'prog') renderProgress();
  }

  async function cloudFetch(path, options = {}) {
    const resposta = await fetch(`${CLOUD_CONFIG.url}${path}`, {
      ...options,
      headers: {
        apikey: CLOUD_CONFIG.anonKey,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(cloud.session ? { Authorization: `Bearer ${cloud.session.access_token}` } : {}),
      },
    });
    return resposta;
  }

  // O token de acesso expira; o de renovação vale muito mais. Uma resposta 401
  // dispara uma única tentativa de renovar antes de considerar a sessão perdida.
  async function refreshSession() {
    if (!cloud.session || !cloud.session.refresh_token) return false;
    const resposta = await fetch(`${CLOUD_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: CLOUD_CONFIG.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: cloud.session.refresh_token }),
    });
    if (!resposta.ok) { writeSession(null); return false; }
    const dados = await resposta.json();
    writeSession({
      access_token: dados.access_token,
      refresh_token: dados.refresh_token,
      email: (dados.user && dados.user.email) || cloud.session.email,
      user_id: (dados.user && dados.user.id) || cloud.session.user_id,
    });
    return true;
  }

  async function cloudRequest(path, options = {}) {
    let resposta = await cloudFetch(path, options);
    if (resposta.status === 401 && await refreshSession()) resposta = await cloudFetch(path, options);
    return resposta;
  }

  async function requestMagicLink(email) {
    const destino = `${location.origin}${location.pathname}`;
    const resposta = await fetch(
      `${CLOUD_CONFIG.url}/auth/v1/otp?redirect_to=${encodeURIComponent(destino)}`,
      {
        method: 'POST',
        headers: { apikey: CLOUD_CONFIG.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, create_user: true }),
      },
    );
    if (resposta.ok) return { ok: true };
    let motivo = '';
    try { const erro = await resposta.json(); motivo = erro.msg || erro.error_description || erro.message || ''; } catch (_) { /* corpo vazio */ }
    // O plano em uso limita os e-mails de autenticação por hora; dizer isso é
    // mais útil do que "erro 429".
    if (resposta.status === 429) return { ok: false, motivo: 'Muitos pedidos de link em pouco tempo. Tente de novo daqui a alguns minutos.' };
    return { ok: false, motivo: motivo || 'Não foi possível enviar o link agora.' };
  }

  // O link do e-mail volta para o app com os tokens no fragmento da URL. Ele é
  // lido, guardado e apagado da barra de endereços, para o token não ficar no
  // histórico nem ser compartilhado sem querer num "copiar link".
  async function consumeAuthCallback() {
    const bruto = location.hash.startsWith('#') ? location.hash.slice(1) : '';
    if (!bruto) return false;
    const parametros = new URLSearchParams(bruto);
    const acesso = parametros.get('access_token');
    const renovacao = parametros.get('refresh_token');
    const erro = parametros.get('error_description') || parametros.get('error');
    if (!acesso && !erro) return false;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    if (erro) {
      setCloudStatus(`O link de acesso não valeu: ${erro}`, 'error');
      return false;
    }
    writeSession({ access_token: acesso, refresh_token: renovacao, email: null, user_id: null });
    const perfil = await cloudRequest('/auth/v1/user');
    if (perfil.ok) {
      const usuario = await perfil.json();
      writeSession({ ...cloud.session, email: usuario.email, user_id: usuario.id });
    }
    return true;
  }

  async function pullRemoteProgress() {
    if (!cloud.session || !cloud.session.user_id) return null;
    const caminho = `/rest/v1/${CLOUD_CONFIG.tabela}?usuario=eq.${encodeURIComponent(cloud.session.user_id)}&select=envelope`;
    const resposta = await cloudRequest(caminho, { headers: { Accept: 'application/json' } });
    if (!resposta.ok) throw new Error(`leitura falhou (${resposta.status})`);
    const linhas = await resposta.json();
    if (!Array.isArray(linhas) || !linhas.length) return null;
    const decoded = Core.deserializeProgress(JSON.stringify(linhas[0].envelope), { countryIds: IDS });
    return decoded.recovered ? null : decoded.progress;
  }

  async function pushRemoteProgress(envelope) {
    const resposta = await cloudRequest(`/rest/v1/${CLOUD_CONFIG.tabela}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        usuario: cloud.session.user_id,
        envelope: JSON.parse(envelope),
        atualizado_em: new Date().toISOString(),
      }),
    });
    if (!resposta.ok) throw new Error(`gravação falhou (${resposta.status})`);
  }

  async function syncCloud({ silencioso = false } = {}) {
    if (!cloudEnabled() || !cloud.session || cloud.syncing) return;
    cloud.syncing = true;
    if (!silencioso) setCloudStatus('Sincronizando…');
    try {
      const remoto = await pullRemoteProgress();
      const plano = Core.planSync(progress, remoto, { countryIds: IDS });
      if (plano.download) {
        progress = plano.merged;
        queueProgressSave(true);
        if (state.view === 'quiz') renderScorebar();
      }
      if (plano.upload) await pushRemoteProgress(Core.serializeProgress(plano.merged, { countryIds: IDS }));
      cloud.lastSyncAt = new Date();
      setCloudStatus(plano.unchanged ? 'Tudo sincronizado.' : 'Progresso sincronizado com a conta.', 'ok');
    } catch (erro) {
      // Falha de rede não pode virar obstáculo: o progresso local continua
      // salvo e a próxima tentativa acontece na próxima mudança.
      setCloudStatus('Sem sincronizar agora. O progresso continua salvo neste aparelho.', 'error');
    } finally {
      cloud.syncing = false;
    }
  }

  function scheduleCloudSync() {
    if (!cloudEnabled() || !cloud.session) return;
    clearTimeout(cloud.timer);
    cloud.timer = setTimeout(() => syncCloud({ silencioso: true }), 6000);
  }

  async function signOutCloud() {
    try { await cloudRequest('/auth/v1/logout', { method: 'POST' }); } catch (_) { /* melhor esforço */ }
    writeSession(null);
    cloud.lastSyncAt = null;
    setCloudStatus('Você saiu da conta. O progresso continua neste aparelho.', 'ok');
  }

  async function initializeCloud() {
    if (!cloudEnabled()) return;
    cloud.session = readSession();
    const entrou = await consumeAuthCallback();
    if (cloud.session) {
      if (entrou) setCloudStatus('Conta conectada. Juntando o progresso…', 'ok');
      await syncCloud({ silencioso: !entrou });
    }
  }

  function renderAccount(container) {
    if (!cloudEnabled()) return;
    const card = create('section', { className: 'source-card', attrs: { 'aria-labelledby': 'contaTitle' } });
    card.append(create('h3', { id: 'contaTitle', text: 'Conta (opcional)' }));

    if (!cloud.session) {
      card.append(create('p', {
        text: 'Entrar é opcional e serve só para levar o progresso a outro aparelho. '
          + 'Sem conta, nada sai daqui. Com conta, saem o seu e-mail e o seu progresso '
          + '— países, níveis e datas de revisão. Nunca há anúncio, rastreio ou venda de dados.',
      }));
      const linha = create('div', { className: 'button-row' });
      const email = create('input', {
        id: 'contaEmail', className: 'search', attrs: {
          type: 'email', autocomplete: 'email', placeholder: 'seu@email.com',
          'aria-label': 'E-mail para receber o link de acesso',
        },
      });
      const entrar = create('button', { className: 'btn', type: 'button', text: 'Receber link de acesso' });
      const pedir = async () => {
        const valor = email.value.trim();
        if (!valor || !valor.includes('@')) {
          setCloudStatus('Digite um e-mail válido para receber o link.', 'error');
          return;
        }
        entrar.disabled = true;
        setCloudStatus('Enviando o link…');
        const resultado = await requestMagicLink(valor);
        entrar.disabled = false;
        if (resultado.ok) setCloudStatus(`Link enviado para ${valor}. Abra o e-mail neste aparelho e clique no link.`, 'ok');
        else setCloudStatus(resultado.motivo, 'error');
      };
      entrar.addEventListener('click', pedir);
      email.addEventListener('keydown', (evento) => { if (evento.key === 'Enter') { evento.preventDefault(); pedir(); } });
      linha.append(email, entrar);
      card.append(linha);
      card.append(create('p', {
        className: 'source-note',
        text: 'Sem senha: você recebe um link por e-mail e entra clicando nele.',
      }));
    } else {
      card.append(create('p', {
        text: `Conectado como ${cloud.session.email || 'sua conta'}. O progresso deste aparelho e o da conta são fundidos, nunca substituídos.`,
      }));
      if (cloud.lastSyncAt) {
        card.append(create('p', {
          className: 'source-note',
          text: `Última sincronização às ${cloud.lastSyncAt.toLocaleTimeString('pt-BR')}.`,
        }));
      }
      const linha = create('div', { className: 'button-row' });
      const sincronizar = create('button', { className: 'btn ghost', type: 'button', text: 'Sincronizar agora' });
      sincronizar.addEventListener('click', () => syncCloud());
      const sair = create('button', { className: 'btn ghost', type: 'button', text: 'Sair da conta' });
      sair.addEventListener('click', signOutCloud);
      linha.append(sincronizar, sair);
      card.append(linha);
    }

    if (cloud.status) {
      card.append(create('p', {
        className: `note${cloud.status.kind === 'error' ? ' note-error' : ''}`,
        text: cloud.status.text, attrs: { role: 'status' },
      }));
    }
    container.append(card);
  }

  function renderBackup(container) {
    const card = create('section', { className: 'source-card', attrs: { 'aria-labelledby': 'backupTitle' } });
    card.append(create('h3', { id: 'backupTitle', text: 'Backup do progresso' }));
    card.append(create('p', {
      text: 'O progresso vive somente neste navegador. Exporte um arquivo para guardar ou levar '
        + 'para outro aparelho; a importação funde com o que já existe aqui, sem apagar nada.',
    }));
    const actions = create('div', { className: 'button-row' });
    const exportButton = create('button', { className: 'btn ghost', type: 'button', text: 'Exportar progresso' });
    exportButton.addEventListener('click', exportProgress);
    const input = create('input', {
      id: 'importProgressInput', className: 'file-input',
      attrs: { type: 'file', accept: 'application/json,.json' },
    });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      importProgressFile(file);
    });
    const label = create('label', {
      className: 'btn ghost', text: 'Importar progresso',
      attrs: { for: 'importProgressInput' },
    });
    actions.append(exportButton, label, input);
    card.append(actions);
    if (state.importStatus) {
      card.append(create('p', {
        className: `note${state.importStatus.kind === 'error' ? ' note-error' : ''}`,
        text: state.importStatus.text, attrs: { role: 'status' },
      }));
    }
    container.append(card);
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

    renderSessionSummary(dom.panel);

    // O treino livre é infinito, o que serve para revisar mas não para medir.
    // A prova fecha uma série e dá uma nota, respeitando o modo e a área de
    // estudo escolhidos na barra de controles.
    const prova = create('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'examTitle' } });
    prova.append(create('h3', { id: 'examTitle', text: 'Prova' }));
    prova.append(create('p', {
      className: 'section-copy',
      text: 'Uma série fechada, com nota no fim. Usa o modo e a área de estudo selecionados.',
    }));
    const opcoes = create('div', { className: 'button-row' });
    [10, 20, 30].forEach((total) => {
      const botao = create('button', {
        className: total === 20 ? 'btn' : 'btn ghost', type: 'button',
        text: `${total} perguntas`,
        attrs: { 'aria-label': `Iniciar prova de ${total} perguntas` },
      });
      botao.addEventListener('click', () => startExam(total));
      opcoes.append(botao);
    });
    prova.append(opcoes);
    dom.panel.append(prova);

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

    renderAccount(dom.panel);
    renderBackup(dom.panel);

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
    stopTimer();
    if (view === 'quiz') { renderQuiz(); syncMapForQuestion(); startTimer(); }
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
    dom.timeSeg.querySelectorAll('[data-time]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.time) === state.timeLimit)));
    dom.visualToggle.checked = state.includeVisual;
    applyTheme();
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
    dom.themeToggle.addEventListener('click', () => {
      state.theme = THEMES[(themeStep(state.theme) + 1) % THEMES.length].id;
      const atual = applyTheme(true);
      showThemeHint(atual.curto);
      savePreferences();
    });
    dom.timeSeg.addEventListener('click', (event) => {
      const button = event.target.closest('[data-time]');
      if (!button) return;
      const limit = Number(button.dataset.time);
      if (!TIME_LIMITS.includes(limit)) return;
      state.timeLimit = limit;
      syncControls(); savePreferences();
      announce(limit ? `Tempo por pergunta: ${limit} segundos.` : 'Treino sem limite de tempo.');
      if (state.view !== 'quiz') setView('quiz');
      // A pergunta em curso não muda: só o relógio passa a valer a partir dela.
      if (state.answered) createNextQuestion();
      else { renderQuiz(); startTimer(); }
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
    STUDY_AREAS.forEach((area) => {
      // A seta indenta a subregião sob o balde a que pertence. É texto do próprio
      // option porque <optgroup> não pode ser selecionado, e aqui tanto o balde
      // quanto cada subregião precisam ser escolhíveis.
      const label = area.subregion ? ` ↳ ${area.value}` : area.value;
      dom.region.append(create('option', { text: label, attrs: { value: area.value } }));
    });
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

  // O Atlas continua funcionando como arquivo solto; o service worker só entra
  // em cena quando ele é servido por HTTP, e é o que permite instalar o app e
  // abrir sem rede. Falhar aqui nunca pode impedir o treino de começar.
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.addEventListener('message', (evento) => {
      if (evento.data && evento.data.atlas === 'versao-nova') showUpdateNotice();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* segue sem offline */ });
    });
  }

  // Quando uma versão nova é publicada, a aba aberta continua rodando a antiga:
  // ela veio do cache antes da troca. Sem este aviso a pessoa recarrega, não vê
  // diferença nenhuma e conclui que a publicação falhou — foi exatamente o que
  // aconteceu na primeira vez.
  function showUpdateNotice() {
    if (document.getElementById('updateNotice')) return;
    const aviso = create('div', { id: 'updateNotice', className: 'update-notice', attrs: { role: 'status' } });
    aviso.append(create('span', { text: 'Uma versão nova do Atlas está pronta.' }));
    const recarregar = create('button', { className: 'btn', type: 'button', text: 'Recarregar' });
    recarregar.addEventListener('click', () => location.reload());
    aviso.append(recarregar);
    const barra = document.querySelector('.app-status');
    if (barra) barra.append(aviso);
    announce('Uma versão nova do Atlas está pronta. Recarregue para usá-la.');
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
      // A conta entra depois que o treino já está de pé: nada aqui pode atrasar
      // ou impedir a primeira pergunta aparecer.
      initializeCloud();
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
  registerServiceWorker();
  initialize();
})();

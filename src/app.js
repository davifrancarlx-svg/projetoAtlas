(() => {
  'use strict';

  const Core = globalThis.AtlasCore;
  const Study = globalThis.AtlasStudy;
  const sounds = globalThis.AtlasAudio.create();
  if (!Core) throw new Error('AtlasCore não foi carregado.');
  const SyncQueue = globalThis.AtlasSyncQueue;
  if (!SyncQueue) throw new Error('AtlasSyncQueue não foi carregado.');

  const IDS = DATA.map((country) => country.id);
  const byId = Object.fromEntries(DATA.map((country) => [country.id, country]));
  const MAP_ALPHABETICAL = DATA.slice().sort((left, right) => left.n.localeCompare(right.n, 'pt-BR'));
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
    filterSummary: document.getElementById('filterSummary'),
    focusToggle: document.getElementById('focusToggle'),
    themeToggle: document.getElementById('themeToggle'),
    themeToggleIcon: document.getElementById('themeToggleIcon'),
    themeToggleHint: document.getElementById('themeToggleHint'),
    modeSeg: document.getElementById('modeSeg'),
    region: document.getElementById('regSel'),
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
    ready: false, view: 'quiz', mode: 'mix', region: 'Mundo inteiro',
    includeVisual: true, mapCollapsed: false, filtersCollapsed: null, focusMode: false,
    question: null, answered: false,
    selectedAnswer: null, answerTerritory: null, hits: 0, misses: 0, streak: 0,
    questionNumber: 0, recentIds: [], forcedQuestion: null,
    atlasSelected: 'BR', atlasQuery: '', atlasArea: '', atlasLimit: 60, resetArmed: false, resetPending: false,
    mapCursorId: 'BR',
    theme: 'auto',
    timeLimit: 0, askedAt: 0, expired: false,
    sessionAnswers: [], reviewQueue: [], fromDeck: false, deckPending: false, importStatus: null,
    // Carta de revisão em jogo e o placar do baralho. A carta precisa
    // sobreviver à resposta para poder ser reenfileirada em vez de descartada
    // no primeiro acerto — ver `requeueReviewCard`.
    reviewCard: null, reviewStats: null, reviewDone: null,
    // Prova: uma série fechada de perguntas com nota no fim. Vale para a sessão
    // atual e não é persistida — o que fica gravado é o progresso por país, que
    // a prova alimenta como qualquer outra resposta.
    exam: null, sessionEnded: false, regionCelebration: null,
    // Rascunho de série interrompida oferecido ao abrir; some com a decisão.
    examDraft: null,
  };

  // Relógio da pergunta: um intervalo curto move a barra, e o estouro entra
  // como erro pela mesma porta de uma resposta comum, para o progresso e a
  // revisão espaçada não enxergarem nada de diferente.
  const timer = { handle: 0, deadline: 0, paused: 0 };
  // Uma série fechada interrompida (aba fechada, celular travou) fica guardada
  // neste navegador até ser retomada, descartada ou concluída.
  const EXAM_DRAFT_KEY = 'atlas195:serie:v1';
  const EXAM_DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
  // Teto de respostas guardadas junto do rascunho. Uma sessão longa não pode
  // encher o armazenamento do navegador só para o resumo ficar completo.
  const DRAFT_MAX_ANSWERS = 300;
  // Os três tipos de série fechada compartilham o mesmo mecanismo (N perguntas,
  // nota no fim) e diferem só no texto e em como se refaz.
  const SERIES_COPY = {
    due: { label: 'Revisões pendentes', done: 'Lote de revisões concluído', again: 'Continuar revisões pendentes', start: 'Revisão de pendências iniciada' },
    exam: { label: 'Prova', done: 'Prova concluída', again: 'Nova prova', start: 'Prova iniciada' },
    daily: { label: 'Treino de hoje', done: 'Treino de hoje concluído', again: 'Treino de hoje', start: 'Treino de hoje iniciado' },
    country: { label: 'Prática do país', done: 'Prática concluída', again: 'Praticar de novo', start: 'Prática iniciada' },
  };

  let progress = Core.createProgress();
  let saveTimer = 0;
  let saveChain = Promise.resolve();
  let announcementTimer = 0;
  let themeHintTimer = 0;
  let resetSyncDirty = false;
  const pendingStorageValues = [];

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
    const image = create('img', { className: 'flag-image', attrs: {
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

  // "alemão, francês, italiano e romanche" — a última junção é "e", não vírgula,
  // porque a lista é lida como frase na ficha e pelo leitor de tela.
  function formatList(items) {
    const list = (items || []).filter(Boolean);
    if (list.length <= 1) return list[0] || '';
    return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
  }

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
      mode: state.mode, region: state.region,
      includeVisual: state.includeVisual, mapCollapsed: state.mapCollapsed,
      filtersHidden: state.filtersCollapsed, focusMode: state.focusMode,
      timeLimit: state.timeLimit, theme: state.theme, dailySize: state.dailySize || 10,
    };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(safe)); } catch (_) { /* modo privado */ }
  }

  function loadPreferences() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return;
      if (MODE_DIRECTIONS[parsed.mode]) state.mode = parsed.mode;
      if (REGIONS.includes(parsed.region)) state.region = parsed.region;
      if (typeof parsed.includeVisual === 'boolean') state.includeVisual = parsed.includeVisual;
      if (typeof parsed.mapCollapsed === 'boolean') state.mapCollapsed = parsed.mapCollapsed;
      // Sem escolha, a barra segue o tamanho da tela (filtersHidden, mais abaixo).
      // O campo antigo, `filtersCollapsed`, era gravado junto com qualquer outra
      // preferência enquanto o padrão era fechado, então não diz se a pessoa
      // escolheu recolher: só o novo vale.
      if (typeof parsed.filtersHidden === 'boolean') state.filtersCollapsed = parsed.filtersHidden;
      if (typeof parsed.focusMode === 'boolean') state.focusMode = parsed.focusMode;
      if (TIME_LIMITS.includes(parsed.timeLimit)) state.timeLimit = parsed.timeLimit;
      if ([5, 10, 20].includes(parsed.dailySize)) state.dailySize = parsed.dailySize;
      if (THEMES.some((tema) => tema.id === parsed.theme)) state.theme = parsed.theme;
      if (!state.includeVisual && (state.mode === 'flag' || state.mode === 'loc')) state.mode = 'cap';
      if (state.region !== 'Mundo inteiro' && state.mode === 'reg') state.mode = 'mix';
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
      'on', 'ok', 'bad', 'neighbor', 'dimmed', 'is-current', 'is-correct', 'is-wrong', 'is-dimmed',
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
    if (shouldAnnounce && !pointInView(byId[id].c)) {
      const [x, y] = byId[id].c;
      setMapView(x - mapState.view.w / 2, y - mapState.view.h / 2, mapState.view.w);
    }
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
    if (state.view === 'quiz' && isMapPick() && !state.answered) {
      return answerQuestion(id, territory);
    }
    if (state.view === 'quiz') {
      announce('O mapa é apenas referência nesta pergunta.');
      return;
    }
    if (state.view === 'atlas') return atlas.select(id, true, territory);
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
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); event.stopPropagation();
        const country = event.key === 'Home' ? MAP_ALPHABETICAL[0] : MAP_ALPHABETICAL[MAP_ALPHABETICAL.length - 1];
        setMapCursor(country.id);
      } else if (event.key.length === 1 && /^\p{L}$/u.test(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const initial = Core.normalizeText(event.key);
        const current = MAP_ALPHABETICAL.findIndex((country) => country.id === state.mapCursorId);
        const ordered = MAP_ALPHABETICAL.slice(current + 1).concat(MAP_ALPHABETICAL.slice(0, current + 1));
        const country = ordered.find((candidate) => Core.normalizeText(candidate.n).startsWith(initial));
        if (country) setMapCursor(country.id);
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
    if (state.region !== 'Mundo inteiro') directions = directions.filter((direction) => direction !== 'reg');
    if (!state.includeVisual) directions = directions.filter((direction) => !VISUAL_DIRECTIONS.has(direction));
    return directions.length ? directions : ['cap', 'capOf'];
  }

  function createNextQuestion(options = {}) {
    if (!state.ready) return;
    // Qualquer outra ação abandona a oferta de retomar a série interrompida;
    // retomar de fato passa por resumeExam, que limpa a oferta antes daqui.
    if (state.examDraft) { state.examDraft = null; clearExamDraft(); }
    state.sessionEnded = false;
    state.regionCelebration = null;
    stopTimer();
    // A série fechada termina aqui: em vez de sortear mais uma, entrega a nota.
    if (examFinished()) { renderExamResult(); return; }
    if (state.region !== 'Mundo inteiro') {
      state.reviewQueue = state.reviewQueue.filter((card) => card.direction !== 'reg');
      if (state.forcedQuestion && state.forcedQuestion.direction === 'reg') {
        state.forcedQuestion = null;
        state.fromDeck = false;
      }
    }
    // O baralho de erros tem prioridade sobre o sorteio: enquanto houver carta
    // na fila, é ela que vira pergunta. `fromDeck` sobrevive à fila esvaziada
    // para que a última carta ainda se apresente como revisão.
    if (!state.forcedQuestion && state.reviewQueue.length) {
      state.forcedQuestion = state.reviewQueue.shift();
      state.fromDeck = true;
      if (!state.reviewQueue.length) announce('Última carta do baralho de erros.');
    } else if (!state.deckPending) {
      // O baralho acabou: guarda o saldo para anunciar uma vez na próxima
      // pergunta. Fechar a revisão em silêncio desperdiça o melhor momento para
      // mostrar que o esforço virou resultado.
      if (state.fromDeck && state.reviewStats && (state.reviewStats.consolidated || state.reviewStats.retired)) {
        state.reviewDone = state.reviewStats;
      }
      state.fromDeck = false;
      state.reviewCard = null;
      state.reviewStats = null;
    }
    state.deckPending = false;
    const forced = state.exam?.cards?.[state.exam.done] || state.forcedQuestion;
    state.forcedQuestion = null;
    // A carta precisa sobreviver à resposta: é ela que volta para o fim da fila
    // quando ainda falta um acerto de confirmação.
    state.reviewCard = state.fromDeck && forced && Number.isFinite(forced.remaining) ? forced : null;
    const directions = forced ? [forced.direction] : effectiveDirections();
    const result = Core.createQuestion({
      countries: DATA,
      mode: state.mode,
      directions,
      region: forced ? 'Mundo inteiro' : state.region,
      progress,
      recentIds: state.recentIds,
      forcedId: forced ? forced.id : undefined,
    });
    state.question = result.question;
    state.recentIds = result.recentIds;
    state.answered = false;
    state.selectedAnswer = null;
    state.answerTerritory = null;
    state.expired = false;
    state.questionNumber += 1;
    state.askedAt = Date.now();
    renderQuiz();
    syncMapForQuestion();
    startTimer();
    saveDraft();
    if (options.focus) {
      document.getElementById('questionTitle')?.focus();
      announce(questionCopy(state.question)[0]);
    }
  }

  function stopTimer() {
    if (timer.handle) clearInterval(timer.handle);
    timer.handle = 0;
    timer.deadline = 0;
    timer.paused = 0;
  }

  function startTimer() {
    stopTimer();
    if (!state.timeLimit || state.view !== 'quiz' || state.answered) return;
    timer.deadline = Date.now() + state.timeLimit * 1000;
    runTimer();
  }

  function runTimer() {
    updateTimerDisplay();
    timer.handle = setInterval(() => {
      if (state.answered || state.view !== 'quiz') { stopTimer(); return; }
      if (Date.now() >= timer.deadline) { stopTimer(); expireQuestion(); return; }
      updateTimerDisplay();
    }, 200);
  }

  // Trocar de aba por um instante não pode virar "tempo esgotado": com a página
  // oculta o relógio congela e retoma de onde parou quando ela volta.
  function pauseTimerWhileHidden() {
    if (document.hidden) {
      if (!timer.handle) return;
      timer.paused = Math.max(1, timer.deadline - Date.now());
      clearInterval(timer.handle);
      timer.handle = 0;
      return;
    }
    if (!timer.paused) return;
    const remaining = timer.paused;
    timer.paused = 0;
    if (state.answered || state.view !== 'quiz' || !state.question) return;
    timer.deadline = Date.now() + remaining;
    runTimer();
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
  // resposta errada.
  function expireQuestion() {
    if (!state.question || state.answered) return;
    state.expired = true;
    answerQuestion(EXPIRED_ANSWER);
  }

  // O segundo item é uma instrução e só existe quando acrescenta algo: a placa
  // já diz a direção, e repetir "capital → país" logo abaixo dela era ruído.
  function questionCopy(question) {
    const country = byId[question.id];
    if (question.direction === 'mapId' && question.variant === 'shape') return ['Que país tem esta forma?'];
    if (question.direction === 'locate' && question.variant === 'shape') return [`Qual destas formas é ${country.n}?`];
    if (question.direction === 'locate' && question.variant === 'border') return [`Qual destes faz fronteira com ${country.n}?`];
    if (country.capitalType === 'government-seat') {
      if (question.direction === 'cap') return [`Em qual distrito fica a sede do governo de ${country.n}?`];
      if (question.direction === 'capOf') return [`${country.cap} é a sede do governo de qual país?`];
    }
    return {
      flag: ['Que país tem esta bandeira?', 'Observe as formas e cores'],
      flagOf: [`Qual é a bandeira de ${country.n}?`, 'Escolha uma bandeira'],
      cap: [`Qual é a capital de ${country.n}?`],
      capOf: [`${country.cap} é a capital de qual país?`],
      locate: [`Onde fica ${country.n}?`, 'Selecione o país no mapa'],
      mapId: ['Que país está marcado no mapa?'],
      reg: [`Em que região fica ${country.n}?`],
    }[question.direction];
  }
  function isVisualQuestion(question = state.question) {
    return Boolean(question && VISUAL_DIRECTIONS.has(question.direction));
  }
  // Só a variante de mapa é respondida clicando no mapa; silhueta e fronteira
  // têm alternativas, e ali o mapa volta a ser referência.
  function isMapPick(question = state.question) {
    return Boolean(question && question.direction === 'locate'
      && (!question.variant || question.variant === 'map'));
  }
  // O mapa é a própria pergunta quando se responde nele ou quando o pin é o
  // enunciado. No celular é isso que o põe antes do painel; nas demais, até nas
  // visuais como bandeira, ele só empurrava as alternativas para baixo da dobra.
  function isMapQuestion(question = state.question) {
    return isMapPick(question) || Boolean(question && question.direction === 'mapId' && question.variant !== 'shape');
  }
  // A resposta certa nem sempre é o país da pergunta: na variante de fronteira
  // é o vizinho sorteado.
  function expectedId(question = state.question) {
    return (question && question.answerId) || (question && question.id);
  }
  function directionLabel(question) {
    if (question.direction === 'locate' && question.variant === 'shape') return 'país → silhueta';
    if (question.direction === 'locate' && question.variant === 'border') return 'país → fronteira';
    if (question.direction === 'mapId' && question.variant === 'shape') return 'silhueta → país';
    if (byId[question.id].capitalType === 'government-seat') {
      if (question.direction === 'cap') return 'país → sede do governo';
      if (question.direction === 'capOf') return 'sede do governo → país';
    }
    return DIRECTION_LABEL[question.direction];
  }
  function optionLabel(direction, country) { return direction === 'cap' ? country.cap : country.n; }
  function expectedAnswer(direction, country) {
    if (direction === 'reg') return country.r;
    return direction === 'cap' ? country.cap : country.n;
  }

  function answerQuestion(value, territory) {
    if (!state.question || state.answered) return;
    const target = byId[state.question.id];
    let correct;
    if (value === EXPIRED_ANSWER) correct = false;
    else if (state.question.direction === 'reg') correct = value === target.r;
    else correct = value === expectedId();
    stopTimer();
    state.answered = true;
    state.selectedAnswer = value === EXPIRED_ANSWER ? null : value;
    state.answerTerritory = territory || null;
    if (correct) { state.hits += 1; state.streak += 1; }
    else { state.misses += 1; state.streak = 0; }
    signalAnswer(correct);
    const previousSkill = Core.skillOf(progress,target.id,state.question.direction);
    const registro = {
      wasNew: !previousSkill.attempts,
      wasDifficult: previousSkill.level <= 1 && previousSkill.attempts > previousSkill.correct,
      id: target.id,
      direction: state.question.direction,
      correct,
      expired: state.expired,
      ms: state.askedAt ? Math.max(0, Date.now() - state.askedAt) : null,
    };
    state.sessionAnswers.push(registro);
    // A carta revisada volta para a fila em vez de sair no primeiro acerto.
    if (state.fromDeck && state.reviewCard) requeueReviewCard(state.reviewCard, correct);
    // A revisão de erros não consome perguntas da prova: só contam as da série.
    if (state.exam && !state.fromDeck && state.exam.done < state.exam.total) {
      state.exam.done += 1;
      state.exam.answers.push(registro);
    }
    // Um só ponto de gravação: a série fechada, o baralho de revisão ou nada.
    saveDraft();
    const regionWasComplete = regionMastery(target.r).complete;
    // Acertar na hora e acertar devagar entre quatro alternativas deixaram de
    // valer a mesma promoção: a nota traduz a força da evidência no tamanho do
    // intervalo até a próxima revisão.
    const grade = Core.gradeAnswer({
      correct,
      ms: registro.ms,
      optionCount: Array.isArray(state.question.opts) ? state.question.opts.length : 0,
      timeLimit: state.timeLimit || null,
    });
    progress = Core.recordAnswer(progress, target.id, state.question.direction, correct, {
      countryIds: IDS, bestStreak: state.streak, grade,
    });
    if (!regionWasComplete && regionMastery(target.r).complete) state.regionCelebration = target.r;
    refreshMapMastery();
    queueProgressSave();
    account.schedule();
    renderQuiz();
    syncMapForQuestion(correct);
    const expected = expectedAnswer(state.question.direction, byId[expectedId()] || target);
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
    if (state.exam?.cards) {
      state.exam.cards.splice(state.exam.done, 1);
      state.exam.total -= 1;
      saveDraft();
    }
    createNextQuestion({ focus: true });
    announce('Pergunta visual pulada sem alterar o progresso.');
  }

  function syncMapForQuestion(correct) {
    clearMapMarks();
    const picking = state.view === 'quiz' && isMapPick() && !state.answered;
    dom.map.classList.toggle('picking', Boolean(picking));
    dom.skipVisual.hidden = !(state.view === 'quiz' && isVisualQuestion() && !state.answered);
    if (state.view !== 'quiz' || !state.question) return;
    const question = state.question;
    // Na variante de silhueta o pin entregaria a resposta: só aparece depois.
    if (question.direction === 'mapId' && question.variant !== 'shape') showReticle(question.id);
    if (state.answered) {
      const answerId = expectedId(question);
      if (question.variant === 'border') (byId[question.id].nb || []).forEach(id => markCountry(id, 'neighbor'));
      markCountry(answerId, 'ok');
      // Na fronteira, o país da pergunta não é a resposta: ele fica marcado
      // como referência para a dupla ser lida junta no mapa.
      if (question.answerId) markCountry(question.id, 'on');
      if (!correct && byId[state.selectedAnswer] && state.selectedAnswer !== answerId) markCountry(state.selectedAnswer, 'bad');
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
    if (isMapPick(question)) {
      container.append(create('p', { className: 'hintline', text: 'Ajuste o zoom pelos botões, roda ou pinça antes de confirmar com toque, clique ou teclado; aproxime para microestados. Você também pode pular sem penalidade.' }));
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
    // A silhueta entre quatro é o espelho da bandeira entre quatro: mesma
    // grade de dois, mesma leitura só pelo desenho, sem o nome entregar nada.
    const shapePick = question.direction === 'locate' && question.variant === 'shape';
    const right = expectedId(question);
    const options = create('div', { className: `opts${question.direction === 'flagOf' || shapePick ? ' grid2' : ''}` });
    question.opts.forEach((id, index) => {
      const country = byId[id];
      const classNames = ['opt'];
      if (question.direction === 'flagOf') classNames.push('flagopt');
      if (shapePick) classNames.push('shapeopt');
      if (state.answered && id === right) classNames.push('right');
      if (state.answered && id === state.selectedAnswer && id !== right) classNames.push('wrong');
      const button = create('button', { className: classNames.join(' '), type: 'button', attrs: {
        'data-answer': id, disabled: state.answered ? '' : null,
        'aria-label': question.direction === 'flagOf' ? `Opção ${index + 1} de bandeira`
          : (shapePick ? `Opção ${index + 1} de silhueta` : null),
      } });
      button.append(create('span', { className: 'key', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }));
      if (question.direction === 'flagOf') button.append(flagImage(country, { decorative: true }));
      else if (shapePick) button.append(countryShape(country));
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
    if (country.alternateCapitals && country.alternateCapitals.length) notes.push(`Também é capital oficial: ${country.alternateCapitals.join(', ')}.`);
    if (country.otherSeats && country.otherSeats.length) notes.push(`Outra sede de governo: ${country.otherSeats.join(', ')}.`);
    if (country.formerCapitalNames && country.formerCapitalNames.length) notes.push(`Nome antigo da capital: ${country.formerCapitalNames.join(', ')}.`);
    if (country.capitalNote) notes.push(country.capitalNote);
    return notes;
  }

  // O erro só ensina se disser por que a confusão era plausível. O núcleo diz
  // qual é a relação entre o que foi respondido e a resposta certa; aqui ela
  // vira frase, sempre terminando no traço que separa os dois.
  function confusionCopy(country, chosen, direction) {
    const reason = Core.confusionReason(country, chosen, direction);
    if (!reason) return null;
    const nome = chosen.n;
    if (reason === 'flag-similar') {
      return `${nome} tem bandeira parecida — compare as proporções e os símbolos, não só as cores.`;
    }
    if (reason === 'capital-similar') {
      return `${chosen.cap} e ${country.cap} têm escrita muito parecida — repare no que muda entre as duas.`;
    }
    if (reason === 'capital-initial') {
      return `${chosen.cap} começa com a mesma letra de ${country.cap}, o que facilita a troca.`;
    }
    if (reason === 'border') {
      return `${nome} faz fronteira com ${country.n} — os dois se tocam no mapa.`;
    }
    if (reason === 'neighbour') {
      return `${nome} fica perto de ${country.n} no mapa — o erro foi de poucos graus.`;
    }
    if (reason === 'same-subregion') {
      return `${nome} fica na mesma subregião, ${chosen.sr}: os dois disputam o mesmo lugar na memória.`;
    }
    return `${nome} fica na mesma região, ${chosen.r}.`;
  }

  // Errar também precisa dizer de quem era a resposta escolhida: "Banjul e
  // Bangui se parecem" ensina menos do que saber que Banjul é a capital da
  // Gâmbia — é isso que fixa as duas de uma vez.
  function chosenNote(chosen, direction) {
    const question = state.question;
    if (direction === 'locate' && question.variant === 'border') {
      return `${chosen.n} não faz fronteira com ${byId[question.id].n}.`;
    }
    if (direction === 'locate' && question.variant === 'shape') return `A forma escolhida é a de ${chosen.n}.`;
    if (direction === 'cap') return `${chosen.cap} é a capital de ${chosen.n}.`;
    if (direction === 'capOf') return `A capital de ${chosen.n} é ${chosen.cap}.`;
    if (direction === 'flagOf') return `A bandeira escolhida é a de ${chosen.n}.`;
    // No território a nota explicativa já diz o que foi marcado.
    if (direction === 'locate' && !state.answerTerritory) return `Você marcou ${chosen.n} no mapa.`;
    return null;
  }

  // Na fronteira, o veredito precisa ensinar a lista inteira: saber que o
  // Peru é vizinho vale menos do que ver os dez de uma vez.
  function bordersNote(country) {
    const vizinhos = (country.nb || []).map((id) => byId[id]).filter(Boolean);
    if (!vizinhos.length) return `${country.n} não faz fronteira com nenhum país.`;
    return `${country.n} faz fronteira com ${vizinhos.length === 1 ? 'um país' : `${vizinhos.length} países`}: `
      + `${formatList(vizinhos.map((outro) => outro.n))}.`;
  }

  // A silhueta é a forma real (Core.trueShape), não a do mapa-múndi, que
  // estica o que fica perto dos polos. O recorte continua sendo o aglomerado
  // principal: a forma que se reconhece, sem as ilhas a um oceano de distância.
  const trueShapes = new Map();
  function countryShape(country, label) {
    if (!trueShapes.has(country.id)) trueShapes.set(country.id, Core.trueShape(country, PROJECTION));
    const { d, box } = trueShapes.get(country.id);
    const pad = Math.max(box[2] - box[0], box[3] - box[1]) * 0.08 + 0.2;
    const svg = svgElement('svg', Object.assign({
      class: 'shape-svg',
      viewBox: `${(box[0] - pad).toFixed(2)} ${(box[1] - pad).toFixed(2)} ${(box[2] - box[0] + pad * 2).toFixed(2)} ${(box[3] - box[1] + pad * 2).toFixed(2)}`,
    }, label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }));
    svg.append(svgElement('path', { d, 'fill-rule': 'evenodd', 'clip-rule': 'evenodd' }));
    return svg;
  }

  function shapeBox(country) {
    return create('div', { className: 'shapebox' }, countryShape(country, 'Silhueta do país da pergunta'));
  }

  function renderVerdict(container) {
    const question = state.question;
    const country = byId[question.id];
    const isCorrect = question.direction === 'reg'
      ? state.selectedAnswer === country.r
      : state.selectedAnswer === expectedId(question);
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

    if (state.regionCelebration) {
      verdict.append(create('div', { className: 'region-celebration', attrs: { role: 'status' } }, [
        create('span', { text: '◆', attrs: { 'aria-hidden': 'true' } }),
        create('div', {}, [
          create('strong', { text: `${state.regionCelebration} dominada` }),
          create('small', { text: 'Todas as habilidades da região chegaram ao nível máximo.' }),
        ]),
      ]));
    }

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

    // No erro, contrastar o que foi escolhido com a resposta certa. Só quando há
    // uma escolha concreta de país: em "tempo esgotado" não houve confusão a
    // explicar, e em região a comparação seria entre continentes, não países.
    if (!isCorrect && !state.expired && question.direction !== 'reg') {
      const chosen = byId[state.selectedAnswer];
      if (chosen && chosen.id !== expectedId(question)) {
        const comparison = create('div', { className: 'answer-comparison', attrs: { 'aria-label': 'Comparação das respostas' } });
        [[byId[expectedId(question)], 'Resposta correta'], [chosen, 'Sua resposta']].forEach(([item, label]) => {
          const card = create('div', { className: 'comparison-card' });
          card.append(create('strong', { text: label }));
          if (question.variant === 'shape') card.append(countryShape(item, `Silhueta de ${item.n}`));
          else if (['flag', 'flagOf'].includes(question.direction)) card.append(flagImage(item));
          card.append(create('span', { text: item.n }));
          if (['cap', 'capOf'].includes(question.direction)) card.append(create('span', { className: 'factmeta', text: `Capital: ${item.cap}` }));
          else if (question.direction === 'locate' || question.direction === 'mapId') card.append(create('span', { className: 'factmeta', text: item.sr }));
          comparison.append(card);
        });
        verdict.append(comparison);
      }
      const owner = chosen ? chosenNote(chosen, question.direction) : null;
      if (owner) verdict.append(create('p', { className: 'note', text: owner }));
      const copy = chosen ? confusionCopy(country, chosen, question.direction) : null;
      if (copy) verdict.append(create('p', { className: 'note note-confusion', text: copy }));
    }

    if (question.direction === 'locate' && question.variant === 'border') {
      verdict.append(create('p', { className: 'note note-confusion', text: bordersNote(country) }));
      const legend = create('div', { className: 'border-legend', attrs: { 'aria-label': 'Legenda do mapa' } });
      [['current', 'País da pergunta'], ['neighbor', 'Vizinhos'], ['correct', 'Resposta correta']].forEach(([kind, text]) => {
        legend.append(create('span', {}, [create('i', { className: `legend-swatch ${kind}`, attrs: { 'aria-hidden': 'true' } }), document.createTextNode(text)]));
      });
      if (!isCorrect) legend.append(create('span', {}, [create('i', { className: 'legend-swatch wrong', attrs: { 'aria-hidden': 'true' } }), document.createTextNode('Sua resposta incorreta')]));
      verdict.append(legend);
    }
    explanatoryNotes(country).forEach((note) => verdict.append(create('p', { className: 'note', text: note })));
    const next = create('button', { id: 'nextQuestion', className: 'btn wide', text: 'Próxima pergunta', type: 'button' });
    next.addEventListener('click', () => createNextQuestion({ focus: true }));
    verdict.append(next);
    container.append(verdict);
  }

  function renderQuiz() {
    if (!state.question) return;
    atlas.detach();
    clear(dom.panel);
    const question = state.question;
    dom.shell.dataset.questionMap = String(isMapQuestion(question));
    const country = byId[question.id];
    const [headline, eyebrow] = questionCopy(question);
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: state.fromDeck
        ? `Revisão focada · ${reviewRemaining() > 1 ? `faltam ${reviewRemaining()}` : 'última habilidade'}`
        : (state.exam
          ? `${seriesLabel()} · ${Math.min(state.exam.done + (state.answered ? 0 : 1), state.exam.total)} de ${state.exam.total}`
          : `Pergunta ${state.questionNumber}`) }),
      create('span', { text: directionLabel(question) }),
    ]));
    // Saldo da revisão que acabou de fechar. Aparece uma vez só, na primeira
    // pergunta depois dela.
    if (state.reviewDone && !state.answered) {
      const saldo = state.reviewDone;
      const pendentes = saldo.retired
        ? ` ${saldo.retired} ${saldo.retired === 1 ? 'ficou' : 'ficaram'} para a próxima revisão.` : '';
      dom.panel.append(create('p', { className: 'review-done', attrs: { role: 'status' },
        text: `Revisão concluída: ${saldo.consolidated} ${saldo.consolidated === 1 ? 'habilidade consolidada' : 'habilidades consolidadas'} com dois acertos.${pendentes}` }));
      state.reviewDone = null;
    }
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
    if (eyebrow) dom.panel.append(create('p', { className: 'prompt', text: eyebrow }));
    if (question.direction === 'flag') {
      dom.panel.append(create('h2', { id: 'questionTitle', className: 'subject sm', text: headline, attrs: { tabindex: '-1' } }));
      dom.panel.append(create('div', { className: 'flagbox' }, flagImage(country, { eager: true, alt: 'Bandeira apresentada na pergunta' })));
    } else dom.panel.append(create('h2', { id: 'questionTitle', className: 'subject', text: headline, attrs: { tabindex: '-1' } }));
    if (question.direction === 'mapId' && question.variant === 'shape') dom.panel.append(shapeBox(country));
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
    const questionLabel = state.exam
      ? `${Math.min(state.exam.done + (state.answered ? 0 : 1), state.exam.total)} de ${state.exam.total}`
      : `${Math.max(1, state.questionNumber)}`;
    const summary = create('div', { className: 'session-strip' });
    summary.append(
      create('span', {}, [create('b', { text: questionLabel }), document.createTextNode(' pergunta')]),
      create('span', {}, [create('b', { text: total ? `${Math.round(state.hits / total * 100)}%` : '—' }), document.createTextNode(' precisão')]),
      create('span', { className: state.streak ? 'hot' : '' }, [create('b', { text: state.streak }), document.createTextNode(' sequência')]),
    );
    dom.scorebar.append(summary);
    if (!state.exam && total && !state.sessionEnded) {
      const finish = create('button', { className: 'session-finish', type: 'button', text: 'Encerrar' });
      finish.addEventListener('click', finishSession);
      dom.scorebar.append(finish);
    }
  }

  // A aba Atlas mora em src/atlas.js: busca, filtro por área, ficha e
  // territórios. Aqui fica só a ponte — o módulo recebe o que precisa e
  // devolve as operações que o app chama.
  const atlas = globalThis.AtlasBrowser.create({
    Core, state, getProgress: () => progress, onPractice: (id) => startCountryPractice(id),
    data: {
      countries: DATA, byId, territories: TERRITORY_LIST, territoriesByCountry,
      indicatorMeta: INDICATOR_META, families: FAMILY_DIRECTIONS,
    },
    ui: {
      create, clear, flagImage, formatArea, formatList, announce, renderScorebar,
      panel: () => dom.panel, indicadores: indicadoresDe, fatos: fatosDe,
      familyLevel: (country, directions) => countryFamilyLevel(country, directions),
      shape: countryShape, projection: PROJECTION,
    },
    map: {
      setCursor: setMapCursor, clearMarks: clearMapMarks, mark: markCountry, reticle: showReticle,
      fitCountry, fitTerritory, territoryPoint,
    },
  });

  function attemptedSkills() {
    const skills = [];
    DATA.forEach((country) => DIRECTIONS.forEach((direction) => {
      const skill = Core.skillOf(progress, country.id, direction);
      if (skill.attempts > 0) skills.push({ country, direction, skill });
    }));
    return skills;
  }

  function countryFamilyLevel(country, directions) {
    return directions.reduce((sum, direction) => sum + Core.levelOf(progress, country.id, direction), 0)
      / (directions.length * Core.MAX_LEVEL);
  }

  function regionMastery(region) {
    const countries = DATA.filter((country) => country.r === region);
    const directions = ['flag', 'flagOf', 'cap', 'capOf', 'locate', 'mapId'];
    const score = countries.reduce((sum, country) => sum + directions.reduce((inner, direction) =>
      inner + Core.levelOf(progress, country.id, direction), 0), 0);
    const maximum = countries.length * directions.length * Core.MAX_LEVEL;
    return { percent: maximum ? score / maximum * 100 : 0, complete: maximum > 0 && score === maximum };
  }

  function refreshMapMastery() {
    Core.regionsOf(DATA).forEach((region) => {
      const complete = regionMastery(region).complete;
      DATA.filter((country) => country.r === region).forEach((country) => {
        (mapState.nodesById.get(country.id) || []).forEach((node) => node.classList.toggle('mastered-region', complete));
      });
    });
  }

  // Trocar de assunto encerra a fila anterior; uma carta forçada não pode
  // sobrepor silenciosamente o modo ou os filtros que a pessoa acabou de escolher.
  function abandonExercise() {
    stopTimer();
    state.exam = null; state.examDraft = null;
    state.reviewQueue = []; state.forcedQuestion = null;
    state.fromDeck = false; state.deckPending = false;
    state.reviewCard = null; state.reviewStats = null; state.reviewDone = null;
    clearExamDraft();
  }

  function startReview(id, direction) {
    abandonExercise();
    state.forcedQuestion = { id, direction };
    setView('quiz');
    createNextQuestion({ focus: true });
    announce(`Revisão de ${byId[id].n}: ${DIRECTION_LABEL[direction]}.`);
  }

  // --- baralho de revisão ---------------------------------------------------
  // Acertar uma vez não é ter aprendido: numa revisão logo depois do erro, o
  // acerto costuma vir da memória de curto prazo, que não sobrevive ao dia
  // seguinte. Por isso a carta exige dois acertos e volta espaçada entre outras
  // — recuperação espaçada, que é o que transforma o acerto em memória durável.
  const REVIEW_TARGET_CORRECT = 2;
  const REVIEW_GAP_AFTER_HIT = 3;
  const REVIEW_GAP_AFTER_MISS = 1;
  // Teto de aparições da mesma carta num baralho: sem ele, quem trava numa
  // habilidade fica preso num laço sem fim em vez de seguir e revisitá-la depois.
  const REVIEW_MAX_TRIES = 6;

  function reviewCard(item) {
    return {
      id: item.id,
      direction: item.direction,
      remaining: REVIEW_TARGET_CORRECT,
      tries: 0,
      misses: item.misses || 0,
    };
  }

  function insertReviewCard(card, gap) {
    const at = Math.min(state.reviewQueue.length, gap);
    state.reviewQueue.splice(at, 0, card);
  }

  // Devolve a carta à fila conforme o resultado, ou a aposenta quando ela já
  // cumpriu os dois acertos (ou esgotou o teto de tentativas).
  function requeueReviewCard(card, correct) {
    card.tries += 1;
    if (!state.reviewStats) state.reviewStats = { consolidated: 0, retired: 0 };
    if (correct) {
      card.remaining -= 1;
      if (card.remaining <= 0) { state.reviewStats.consolidated += 1; return; }
      if (card.tries >= REVIEW_MAX_TRIES) { state.reviewStats.retired += 1; return; }
      insertReviewCard(card, REVIEW_GAP_AFTER_HIT);
      return;
    }
    // Errar de novo zera o ciclo: a carta volta a precisar de dois acertos
    // limpos, senão um acerto sozinho apagaria a falha que acabou de acontecer.
    card.remaining = REVIEW_TARGET_CORRECT;
    if (card.tries >= REVIEW_MAX_TRIES) { state.reviewStats.retired += 1; return; }
    insertReviewCard(card, REVIEW_GAP_AFTER_MISS);
  }

  // Quantas habilidades distintas ainda faltam fechar, contando a que está na
  // tela. O tamanho bruto da fila conta reaparições e assustaria à toa.
  function reviewRemaining() {
    const keys = new Set(state.reviewQueue.map((card) => `${card.id}:${card.direction}`));
    if (state.reviewCard && state.reviewCard.remaining > 0) {
      keys.add(`${state.reviewCard.id}:${state.reviewCard.direction}`);
    }
    return keys.size;
  }

  function startDeck(items, message) {
    const cards = items.map(reviewCard);
    if (!cards.length) return false;
    abandonExercise();
    state.reviewStats = { consolidated: 0, retired: 0, total: cards.length };
    state.reviewQueue = cards.slice(1);
    state.forcedQuestion = cards[0];
    state.fromDeck = true;
    state.deckPending = true;
    state.sessionEnded = false;
    setView('quiz');
    createNextQuestion({ focus: true });
    if (message) announce(message);
    return true;
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
    sounds.play(correct ? 'correct' : 'error');
    if (correct || typeof navigator.vibrate !== 'function') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try { navigator.vibrate(35); } catch (_) { /* aparelho pode recusar */ }
  }

  // --- prova --------------------------------------------------------------
  // O treino livre não termina nunca, o que é bom para revisar e ruim para
  // medir. A prova fecha uma série de N perguntas e entrega uma nota.

  // `cards` fixa a sequência (treino de hoje, prática de um país); sem elas a
  // série sorteia como o treino livre. `kind` escolhe o texto e como refazer.
  function startExam(total, cards = null, kind = cards ? 'daily' : 'exam', countryId = null) {
    state.exam = { total, cards, kind, countryId, done: 0, answers: [], startedAt: Date.now() };
    state.reviewQueue = [];
    state.forcedQuestion = null;
    state.fromDeck = false;
    state.reviewCard = null; state.reviewStats = null; state.reviewDone = null;
    setView('quiz');
    createNextQuestion({ focus: true });
    saveDraft();
    announce(`${SERIES_COPY[kind].start} com ${total} perguntas.`);
  }

  function seriesLabel() {
    if (!state.exam) return '';
    if (state.exam.kind === 'country' && byId[state.exam.countryId]) return `Praticar ${byId[state.exam.countryId].n}`;
    return SERIES_COPY[state.exam.kind].label;
  }

  function practiceDirections() {
    return DIRECTIONS.filter((direction) => state.includeVisual || !VISUAL_DIRECTIONS.has(direction));
  }

  function startCountryPractice(id) {
    if (!byId[id]) return;
    const cards = practiceDirections().map((direction) => ({ id, direction }));
    startExam(cards.length, cards, 'country', id);
  }

  function endExam() {
    state.exam = null;
    clearExamDraft();
    createNextQuestion({ focus: true });
  }

  const draftAnswer = ({ id, direction, correct, expired, ms, wasNew, wasDifficult }) => (
    { id, direction, correct, expired, ms, wasNew, wasDifficult });

  // A fila do baralho, da carta em jogo até a última, sem repetir. Depois de
  // uma resposta a carta volta para a fila sozinha; ao abrir o baralho ela
  // ainda está fora dela. Guardar a lista inteira cobre os dois momentos.
  function deckCards() {
    const queue = state.reviewQueue.slice();
    const card = state.reviewCard;
    const playing = !state.answered && card && card.remaining > 0 && queue.indexOf(card) === -1 ? [card] : [];
    return playing.concat(queue);
  }

  function saveDraft() {
    let draft = null;
    if (state.exam && !examFinished()) {
      draft = {
        v: 2, kind: state.exam.kind, total: state.exam.total, done: state.exam.done,
        answers: state.exam.answers.map(draftAnswer),
        cards: state.exam.cards, countryId: state.exam.countryId,
        // Só o tempo já jogado conta: o intervalo parado fica de fora.
        elapsed: Date.now() - state.exam.startedAt,
      };
    } else if (state.fromDeck) {
      // A revisão focada é uma fila de cartas com ciclo próprio: sem a fila e o
      // placar, retomar seria recomeçar do zero e os dois acertos exigidos por
      // habilidade se perderiam.
      const deck = deckCards();
      if (deck.length) {
        draft = { v: 2, kind: 'review', deck, stats: state.reviewStats,
          answers: state.sessionAnswers.slice(-DRAFT_MAX_ANSWERS).map(draftAnswer) };
      }
    }
    if (!draft) { clearExamDraft(); return; }
    draft.savedAt = Date.now();
    draft.filters = { mode: state.mode, region: state.region,
      timeLimit: state.timeLimit, includeVisual: state.includeVisual };
    try { localStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify(draft)); } catch (_) { /* modo privado */ }
  }

  function clearExamDraft() {
    try { localStorage.removeItem(EXAM_DRAFT_KEY); } catch (_) { /* nada a apagar */ }
  }

  // Um rascunho só é oferecido se fizer sentido inteiro: série incompleta ou
  // baralho não vazio, respostas conferindo com o contador, IDs conhecidos e
  // menos de uma semana. Qualquer sujeira devolve null e o app começa limpo.
  function readExamDraft() {
    const draft = parsedJson(readLocal(EXAM_DRAFT_KEY));
    if (!draft || draft.v !== 2) return null;
    const validCard = (card) => Boolean(card && byId[card.id] && DIRECTIONS.includes(card.direction));
    if (!Array.isArray(draft.answers) || draft.answers.length > DRAFT_MAX_ANSWERS) return null;
    if (!draft.answers.every((answer) => validCard(answer) && typeof answer.correct === 'boolean')) return null;
    if (!Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > EXAM_DRAFT_MAX_AGE) return null;
    if (draft.kind === 'review') {
      const valid = (card) => validCard(card)
        && Number.isInteger(card.remaining) && card.remaining > 0 && card.remaining <= REVIEW_TARGET_CORRECT
        && Number.isInteger(card.tries) && card.tries >= 0 && card.tries < REVIEW_MAX_TRIES;
      if (!Array.isArray(draft.deck) || !draft.deck.length || draft.deck.length > 400) return null;
      return draft.deck.every(valid) ? draft : null;
    }
    if (!SERIES_COPY[draft.kind]) return null;
    if (!Number.isInteger(draft.total) || !Number.isInteger(draft.done)) return null;
    if (draft.done < 0 || draft.done >= draft.total || draft.total > 60) return null;
    if (draft.answers.length !== draft.done) return null;
    if (draft.cards !== null && draft.cards !== undefined) {
      if (!Array.isArray(draft.cards) || draft.cards.length !== draft.total || !draft.cards.every(validCard)) return null;
    }
    if (draft.kind === 'country' && !byId[draft.countryId]) return null;
    return draft;
  }

  function renderExamResume() {
    const draft = state.examDraft;
    if (!draft) return;
    atlas.detach();
    clear(dom.panel); clearMapMarks(); stopTimer();
    dom.shell.dataset.questionMap = 'false';
    dom.skipVisual.hidden = true;
    const review = draft.kind === 'review';
    const pendentes = review ? new Set(draft.deck.map((card) => `${card.id}:${card.direction}`)).size : 0;
    // A revisão não é uma série fechada e não tem entrada em SERIES_COPY: o
    // rótulo dela é próprio, e só as séries consultam a tabela.
    const label = review ? 'Revisão focada'
      : (draft.kind === 'country' ? `Praticar ${byId[draft.countryId].n}` : SERIES_COPY[draft.kind].label);
    const quando = new Date(draft.savedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: review ? 'Revisão interrompida' : 'Série interrompida' }),
      create('span', { text: review
        ? `${pendentes} ${pendentes === 1 ? 'habilidade' : 'habilidades'}`
        : `${draft.done} de ${draft.total}` }),
    ]));
    dom.panel.append(create('h2', { id: 'questionTitle', className: 'subject', attrs: { tabindex: '-1' },
      text: review ? 'Você deixou uma revisão pela metade' : 'Você deixou uma série pela metade' }));
    dom.panel.append(create('p', { className: 'section-copy', text: review
      ? `Revisão focada de ${quando}: ${pendentes} ${pendentes === 1 ? 'habilidade ainda precisa' : 'habilidades ainda precisam'} `
        + 'dos dois acertos. Retomar continua o ciclo de onde ele parou.'
      : `${label}: ${draft.done} de ${draft.total} perguntas respondidas em ${quando}. `
        + 'O tempo parado não conta, e a próxima pergunta é sorteada de novo.' }));
    const actions = create('div', { className: 'button-row' });
    const resume = create('button', { id: 'resumeExam', className: 'btn', type: 'button', text: 'Retomar' });
    resume.addEventListener('click', resumeExam);
    const discard = create('button', { className: 'btn ghost', type: 'button', text: 'Descartar' });
    discard.addEventListener('click', () => createNextQuestion({ focus: true }));
    actions.append(resume, discard);
    dom.panel.append(actions);
    renderScorebar();
  }

  function resumeExam() {
    const draft = state.examDraft;
    if (!draft) return;
    state.examDraft = null;
    const filters = draft.filters || {};
    if (MODE_DIRECTIONS[filters.mode]) state.mode = filters.mode;
    if (REGIONS.includes(filters.region)) state.region = filters.region;
    if (TIME_LIMITS.includes(filters.timeLimit)) state.timeLimit = filters.timeLimit;
    if (typeof filters.includeVisual === 'boolean') state.includeVisual = filters.includeVisual;
    if (!state.includeVisual && (state.mode === 'flag' || state.mode === 'loc')) state.mode = 'cap';
    if (state.region !== 'Mundo inteiro' && state.mode === 'reg') state.mode = 'mix';
    syncControls(); savePreferences();
    // As respostas já dadas voltam a contar nesta sessão, para o placar, o
    // resumo e a revisão focada enxergarem a série inteira.
    draft.answers.forEach((answer) => {
      state.sessionAnswers.push(answer);
      if (answer.correct) state.hits += 1; else state.misses += 1;
    });
    state.streak = 0;
    state.reviewQueue = []; state.forcedQuestion = null; state.fromDeck = false;
    state.reviewCard = null; state.reviewStats = null; state.reviewDone = null;
    if (draft.kind === 'review') {
      // A carta em jogo é a primeira da lista: ela foi perguntada mas não
      // respondida, então volta a ser perguntada.
      state.exam = null;
      state.reviewQueue = draft.deck.slice(1);
      state.forcedQuestion = draft.deck[0];
      state.fromDeck = true;
      state.deckPending = true;
      state.reviewStats = draft.stats && Number.isInteger(draft.stats.consolidated)
        ? draft.stats : { consolidated: 0, retired: 0 };
      setView('quiz');
      createNextQuestion({ focus: true });
      announce(`Revisão focada retomada com ${reviewRemaining()} ${reviewRemaining() === 1 ? 'habilidade' : 'habilidades'}.`);
      return;
    }
    state.exam = {
      total: draft.total, cards: draft.cards || null, kind: draft.kind, countryId: draft.countryId || null,
      done: draft.done, answers: draft.answers.slice(),
      startedAt: Date.now() - (Number.isFinite(draft.elapsed) ? Math.max(0, draft.elapsed) : 0),
    };
    setView('quiz');
    createNextQuestion({ focus: true });
    announce(`${seriesLabel()} retomada: ${draft.done} de ${draft.total} já respondidas.`);
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
    atlas.detach();
    clear(dom.panel);
    stopTimer();
    clearMapMarks();
    // A série acabou: o som avisa que a tela mudou de pergunta para nota. Toca
    // uma vez por série, e num gesto separado do da última resposta, então não
    // disputa com o som do acerto nem do erro.
    sounds.play('complete');

    clearExamDraft();
    const copy = SERIES_COPY[state.exam.kind];
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: state.exam.kind === 'country' && byId[state.exam.countryId]
        ? `Prática de ${byId[state.exam.countryId].n} concluída` : copy.done }),
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
    dom.panel.append(sessionMiniMap(state.exam.answers));
    Study.note(dom.panel, Study.evolution(state.exam.answers));
    Study.note(dom.panel, nextReviewCopy());

    const errados = state.exam.answers.filter((answer) => !answer.correct);
    if (errados.length) {
      const bloco = create('section', { className: 'pgroup' });
      bloco.append(create('h3', { text: errados.length === 1 ? 'O erro da série' : `Os ${errados.length} erros da série` }));
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
        const cartas = Core.rankMistakes(state.exam ? state.exam.answers : [], { progress });
        state.exam = null;
        startDeck(cartas.length ? cartas : errados);
      });
      bloco.append(revisar);
      dom.panel.append(bloco);
    } else {
      dom.panel.append(create('p', { className: 'empty', text: 'Nenhum erro nesta série.' }));
    }

    const acoes = create('div', { className: 'button-row' });
    const refazer = create('button', { className: 'btn', type: 'button', text: copy.again });
    const { kind, countryId, total } = state.exam;
    refazer.addEventListener('click', () => {
      if (kind === 'daily') startDaily();
      else if (kind === 'due') startDue();
      else if (kind === 'country') startCountryPractice(countryId);
      else startExam(total);
    });
    const voltar = create('button', { className: 'btn ghost', type: 'button', text: 'Voltar ao treino livre' });
    voltar.addEventListener('click', endExam);
    acoes.append(refazer, voltar);
    if (kind === 'due' && !pendingCards().length) {
      refazer.disabled = true;
      refazer.textContent = 'Nenhuma revisão pendente nestes filtros';
    }
    dom.panel.append(acoes);

    renderScorebar();
    announce(`${copy.done}. ${stats.hits} de ${stats.total} corretas.`);
    const titulo = document.getElementById('questionTitle');
    if (titulo) titulo.focus();
  }

  // Revisão focada: em vez da ordem em que os erros aconteceram, a ordem da
  // gravidade — o que foi errado mais vezes primeiro, depois o que ficou sem
  // recuperação, depois o que está em nível mais baixo.
  function focusedMistakes() {
    return Core.rankMistakes(state.sessionAnswers, { progress });
  }

  function startMistakeDeck() {
    const mistakes = focusedMistakes();
    if (!mistakes.length) return;
    startDeck(mistakes, `Revisão focada iniciada com ${mistakes.length} ${mistakes.length === 1 ? 'habilidade' : 'habilidades'}. Cada uma sai do baralho após dois acertos.`);
  }

  function sessionOutcomeByCountry(answers = state.sessionAnswers) {
    const outcome = new Map();
    answers.forEach((answer) => {
      if (!outcome.has(answer.id)) outcome.set(answer.id, { correct: 0, wrong: 0 });
      const value = outcome.get(answer.id);
      if (answer.correct) value.correct += 1;
      else value.wrong += 1;
    });
    return outcome;
  }

  function sessionMiniMap(answers = state.sessionAnswers) {
    const outcome = sessionOutcomeByCountry(answers);
    const svg = svgElement('svg', {
      class: 'session-mini-map', viewBox: `${WORLD.x} ${WORLD.y} ${WORLD.w} ${WORLD.h}`,
      role: 'img', 'aria-label': 'Mapa dos países praticados nesta sessão',
    });
    DATA.forEach((country) => {
      const result = outcome.get(country.id);
      svg.append(svgElement('path', {
        d: country.d,
        class: result ? (result.wrong ? 'session-map-hard' : 'session-map-good') : 'session-map-neutral',
        'fill-rule': 'evenodd', 'clip-rule': 'evenodd',
      }));
    });
    return svg;
  }

  function nextReviewCopy() {
    return Study.nextReview(attemptedSkills());
  }

  function pendingCards() {
    return Study.duePlan(Core, DATA, progress, effectiveDirections(), state.region);
  }

  function startDue() {
    const cards = pendingCards().slice(0, 30);
    if (cards.length) startExam(cards.length, cards, 'due');
    else { state.exam = null; setView('prog'); announce('Nenhuma revisão pendente nestes filtros.'); }
  }

  function startDaily(size = state.dailySize || 10) {
    const cards = Study.plan(Core, DATA, progress, effectiveDirections(), state.region, Date.now(), size);
    if (cards.length) startExam(cards.length, cards);
  }

  function renderSessionResult() {
    const stats = sessionStats();
    const outcome = sessionOutcomeByCountry();
    const consolidated = [...outcome.entries()]
      .filter(([, result]) => result.correct > 0 && result.wrong === 0)
      .map(([id]) => byId[id]);
    // No fechamento vale a lista completa e ordenada por gravidade, não só o
    // que ficou pendente: um país errado três vezes e acertado no fim continua
    // sendo o mais frágil da sessão, e é ele que precisa voltar primeiro.
    const mistakes = focusedMistakes();
    atlas.detach();
    clear(dom.panel); clearMapMarks(); stopTimer();
    dom.shell.dataset.questionMap = 'false';
    dom.panel.append(create('div', { className: 'plate' }, [
      create('span', { text: 'Sessão concluída' }),
      create('span', { text: `${stats.total} ${stats.total === 1 ? 'pergunta' : 'perguntas'}` }),
    ]));
    dom.panel.append(create('h2', { id: 'questionTitle', className: 'subject session-result-title', text: `${formatPercent(stats.accuracy)} de precisão`, attrs: { tabindex: '-1' } }));
    dom.panel.append(create('div', { className: 'session-result-stats' }, [
      create('span', {}, [create('b', { text: stats.hits }), document.createTextNode(' acertos')]),
      create('span', {}, [create('b', { text: stats.misses }), document.createTextNode(' erros')]),
      create('span', {}, [create('b', { text: stats.averageSeconds === null ? '—' : `${stats.averageSeconds.toFixed(1).replace('.', ',')}s` }), document.createTextNode(' por resposta')]),
    ]));
    dom.panel.append(sessionMiniMap());
    Study.note(dom.panel, Study.evolution(state.sessionAnswers));
    const learned = create('section', { className: 'pgroup session-result-group' });
    learned.append(create('h3', { text: 'Consolidados nesta sessão' }));
    learned.append(create('p', { className: 'section-copy', text: consolidated.length
      ? consolidated.slice(0, 8).map((country) => country.n).join(' · ')
      : 'Nenhum país foi consolidado sem erros nesta sessão.' }));
    dom.panel.append(learned);
    const difficult = create('section', { className: 'pgroup session-result-group' });
    difficult.append(create('h3', { text: 'Para reforçar' }));
    const weak = create('div', { className: 'weak' });
    // A contagem de erros aparece no chip: ela é o critério da ordem, e sem ela
    // a lista pareceria arbitrária.
    mistakes.slice(0, 10).forEach((item) => weak.append(create('span', {
      className: `chip${item.recovered ? '' : ' chip-urgent'}`,
      text: item.misses > 1
        ? `${byId[item.id].n} · ${DIRECTION_LABEL[item.direction]} · ${item.misses}×`
        : `${byId[item.id].n} · ${DIRECTION_LABEL[item.direction]}`,
    })));
    if (!mistakes.length) weak.append(create('p', { className: 'empty', text: 'Nenhum erro pendente. Excelente fechamento.' }));
    difficult.append(weak, create('p', { className: 'next-review-copy', text: nextReviewCopy() }));
    dom.panel.append(difficult);
    const actions = create('div', { className: 'button-row session-result-actions' });
    // Com erros na sessão, revisar é a ação principal: é o momento em que a
    // revisão rende mais, e deixá-la como botão secundário fazia o fechamento
    // convidar a começar tudo de novo sem fechar as lacunas que acabaram de
    // aparecer.
    if (mistakes.length) {
      const review = create('button', {
        className: 'btn wide', type: 'button',
        text: mistakes.length === 1
          ? 'Revisar o erro desta sessão'
          : `Revisar os ${mistakes.length} pontos fracos desta sessão`,
      });
      review.addEventListener('click', startMistakeDeck);
      dom.panel.append(review);
      dom.panel.append(create('p', {
        className: 'section-copy review-hint',
        text: 'A revisão começa pelo que você mais errou, e cada habilidade só sai do baralho depois de dois acertos separados por outras perguntas.',
      }));
    }
    const again = create('button', { className: mistakes.length ? 'btn ghost' : 'btn', type: 'button', text: 'Nova sessão' });
    again.addEventListener('click', startNewSession);
    actions.append(again);
    const seeProgress = create('button', { className: 'btn ghost', type: 'button', text: 'Ver progresso' });
    seeProgress.addEventListener('click', () => setView('prog'));
    actions.append(seeProgress);
    dom.panel.append(actions);
    renderScorebar();
    document.getElementById('questionTitle')?.focus();
  }

  function finishSession() {
    if (!state.sessionAnswers.length) return;
    state.sessionEnded = true;
    renderSessionResult();
    announce('Sessão encerrada. O resumo do aprendizado está disponível.');
  }

  function startNewSession() {
    abandonExercise();
    state.hits = 0; state.misses = 0; state.streak = 0; state.questionNumber = 0;
    state.sessionAnswers = []; state.reviewQueue = []; state.forcedQuestion = null;
    state.fromDeck = false; state.deckPending = false; state.sessionEnded = false;
    state.reviewCard = null; state.reviewStats = null; state.reviewDone = null;
    createNextQuestion({ focus: true });
  }

  /* ------------------------------------------------------------------ *
   * Conta (opcional): vive em src/account.js. Aqui ficam só as pontes com o
   * estado do app — o módulo não conhece `state` nem `progress` diretamente,
   * recebe o que precisa e devolve uma API pequena.
   * ------------------------------------------------------------------ */

  const CLOUD_CONFIG = typeof CLOUD === 'undefined' ? null : CLOUD;
  const account = globalThis.AtlasAccount.create({
    Core, SyncQueue, config: CLOUD_CONFIG, ids: IDS, el: create,
    getProgress: () => progress,
    setProgress: (next) => { progress = next; },
    onRemoteProgress: () => {
      queueProgressSave(true);
      if (state.view === 'quiz') renderScorebar();
    },
    rerender: () => { if (state.view === 'prog') renderProgress(); },
  });

  // A aba Progresso mora em src/progress.js, na mesma linha da conta e do
  // Atlas: o módulo recebe o estado e as ações e devolve `render`.
  const progressView = globalThis.AtlasProgress.create({
    Core, Study, state, sounds, account,
    getProgress: () => progress,
    setProgress: (next) => { progress = next; },
    data: {
      countries: DATA, ids: IDS, byId, directions: DIRECTIONS,
      families: FAMILY_DIRECTIONS, labels: DIRECTION_LABEL, mapMeta: MAP_META,
    },
    ui: {
      create, announce, formatPercent, numero, panel: () => dom.panel,
      prepare: () => { atlas.detach(); clear(dom.panel); renderScorebar(); },
      familyLevel: countryFamilyLevel, regionMastery, storageStatus: setStorageStatus,
      lockShell: (locked) => {
        dom.shell.classList.toggle('is-resetting', locked);
        dom.topbar.toggleAttribute('inert', locked);
        dom.controls.toggleAttribute('inert', locked);
      },
    },
    actions: {
      attempted: attemptedSkills, pending: pendingCards, nextReview: nextReviewCopy,
      sessionStats, mistakes: focusedMistakes, startMistakeDeck, startReview,
      startDaily, startExam, startDue, savePreferences, saveNow: () => queueProgressSave(true),
      openCountry: (id) => { state.atlasSelected = id; setView('atlas'); atlas.select(id, true); },
      resetAll: resetAllProgress,
    },
  });
  function renderProgress() { progressView.render(); }

  // Apagar de verdade. A conversa do recomeço mora em src/progress.js, mas só
  // o app sabe gravar: funde o que o armazenamento já tinha antes de apagar e
  // lança se não conseguir gravar, para a aba Progresso avisar.
  async function resetAllProgress() {
    resetSyncDirty = false;
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
    if (navigator.locks && typeof navigator.locks.request === 'function') {
      await navigator.locks.request(RESET_LOCK_KEY, performReset);
    } else await performReset();
    account.schedule();
    state.hits = 0;
    state.misses = 0;
    state.streak = 0;
    state.sessionAnswers = []; state.questionNumber = 0;
    state.question = null; state.answered = false; state.sessionEnded = false;
    abandonExercise();
  }

  function setView(view) {
    if (!['quiz', 'atlas', 'prog'].includes(view)) return;
    state.view = view;
    document.body.dataset.view = view;
    dom.shell.dataset.view = view;
    dom.shell.classList.toggle('is-focus-mode', state.focusMode && view === 'quiz');
    dom.tabs.forEach((tab) => {
      if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    dom.skipVisual.hidden = true;
    dom.map.classList.remove('picking');
    stopTimer();
    if (view === 'quiz' && state.sessionEnded) renderSessionResult();
    else if (view === 'quiz' && !state.question && state.examDraft) renderExamResume();
    else if (view === 'quiz' && !state.question && !state.exam && !state.fromDeck && !state.forcedQuestion) createNextQuestion();
    else if (view === 'quiz') { renderQuiz(); syncMapForQuestion(); startTimer(); }
    else if (view === 'atlas') atlas.render();
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
    dom.modeSeg.querySelectorAll('[data-mode]').forEach((button) => {
      const regionOnly = button.dataset.mode === 'reg';
      button.disabled = regionOnly && state.region !== 'Mundo inteiro';
      button.title = button.disabled ? 'As perguntas de região estão disponíveis apenas em Mundo inteiro.' : '';
      button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    });
    dom.timeSeg.querySelectorAll('[data-time]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.time) === state.timeLimit)));
    dom.visualToggle.checked = state.includeVisual;
    const modeLabel = { mix: 'Misto', flag: 'Bandeiras', cap: 'Capitais', loc: 'Localização', reg: 'Regiões' }[state.mode];
    const timeLabel = state.timeLimit ? `${state.timeLimit}s` : 'Livre';
    dom.filterSummary.textContent = `${modeLabel} · ${state.region} · ${timeLabel}`;
    dom.focusToggle.setAttribute('aria-pressed', String(state.focusMode));
    dom.focusToggle.title = state.focusMode ? 'Sair do modo foco' : 'Ocultar distrações';
    dom.shell.classList.toggle('is-focus-mode', state.focusMode && state.view === 'quiz');
    applyTheme();
    dom.region.value = state.region;
    setMapCollapsed(state.mapCollapsed, false);
    syncFilterLayout();
  }

  // Sem escolha guardada, a barra fica aberta no computador e no tablet e
  // recolhida no celular, onde ocuparia a primeira tela inteira e empurraria as
  // alternativas para baixo da dobra. Abrir ou recolher pelo botão vira escolha
  // da pessoa e passa a valer em qualquer tamanho.
  const PHONE_LAYOUT = matchMedia('(max-width: 560px), (max-height: 500px)');
  function filtersHidden() {
    return typeof state.filtersCollapsed === 'boolean' ? state.filtersCollapsed : PHONE_LAYOUT.matches;
  }

  function setFiltersCollapsed(collapsed) {
    state.filtersCollapsed = Boolean(collapsed);
    syncFilterLayout();
    savePreferences();
  }

  function syncFilterLayout() {
    const hidden = filtersHidden();
    dom.controls.hidden = hidden;
    dom.filterToggle.setAttribute('aria-expanded', String(!hidden));
    const icon = dom.filterToggle.querySelector('.filter-toggle-icon');
    if (icon) icon.textContent = hidden ? '+' : '−';
  }

  function bindControls() {
    dom.tabs.forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));
    dom.modeSeg.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode]');
      if (!button || button.disabled) return;
      abandonExercise();
      state.mode = button.dataset.mode;
      if (!state.includeVisual && (state.mode === 'flag' || state.mode === 'loc')) {
        state.mode = 'cap';
        announce('Com perguntas visuais desativadas, o modo foi ajustado para Capitais.');
      }
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
    dom.focusToggle.addEventListener('click', () => {
      // O foco esconde a barra pelo CSS; ao sair, ela volta ao que a pessoa escolheu.
      state.focusMode = !state.focusMode;
      syncControls(); savePreferences();
      announce(state.focusMode ? 'Modo foco ativado.' : 'Modo foco desativado.');
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
      abandonExercise();
      state.region = REGIONS.includes(dom.region.value) ? dom.region.value : 'Mundo inteiro';
      if (state.region !== 'Mundo inteiro' && state.mode === 'reg') {
        state.mode = 'mix';
        announce('O modo foi ajustado para Misto: perguntas de região só aparecem em Mundo inteiro.');
      }
      syncControls(); savePreferences();
      if (state.view !== 'quiz') setView('quiz');
      createNextQuestion();
    });
    dom.visualToggle.addEventListener('change', () => {
      abandonExercise();
      state.includeVisual = dom.visualToggle.checked;
      if (!state.includeVisual && (state.mode === 'flag' || state.mode === 'loc')) state.mode = 'cap';
      syncControls(); savePreferences();
      if (state.view !== 'quiz') setView('quiz');
      createNextQuestion();
      announce(state.includeVisual ? 'Perguntas visuais ativadas.' : 'Perguntas visuais desativadas; o treino usará capitais.');
    });
    dom.filterToggle.addEventListener('click', () => {
      const expanded = dom.filterToggle.getAttribute('aria-expanded') === 'true';
      setFiltersCollapsed(expanded);
    });
    if (PHONE_LAYOUT.addEventListener) PHONE_LAYOUT.addEventListener('change', syncFilterLayout);
    else PHONE_LAYOUT.addListener(syncFilterLayout);
    syncFilterLayout();
    dom.mapToggle.addEventListener('click', () => setMapCollapsed(!state.mapCollapsed));
    dom.skipVisual.addEventListener('click', skipVisualQuestion);
    dom.zoomIn.addEventListener('click', () => zoomAt(1.4));
    dom.zoomOut.addEventListener('click', () => zoomAt(1 / 1.4));
    dom.zoomReset.addEventListener('click', resetMapView);
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const interactive = target && target.closest('button, input, select, textarea, a, [contenteditable="true"]');
      // Depois de clicar numa aba o foco fica no botão dela; os atalhos de
      // resposta continuam valendo ali, senão parecem quebrados até o próximo
      // clique. Enter e Espaço não: nesses o botão da aba tem o próprio efeito.
      const onTab = Boolean(interactive && interactive.classList.contains('tab'));
      if ((interactive && !onTab) || state.view !== 'quiz' || !state.question) return;
      if (!state.answered && /^[1-4]$/.test(event.key)) {
        const option = dom.panel.querySelectorAll('[data-answer]')[Number(event.key) - 1];
        if (option) { event.preventDefault(); option.click(); }
      } else if (!onTab && state.answered && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); createNextQuestion({ focus: true });
      }
    });
    document.addEventListener('visibilitychange', pauseTimerWhileHidden);
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
      // As conquistas foram removidas em 2026-09-16; o registro antigo delas
      // não tem mais leitor e é apagado para não ficar lixo no navegador.
      try { localStorage.removeItem('atlas195:conquistas:v1'); } catch (_) { /* modo privado */ }
      await hydrateProgress();
      refreshMapMastery();
      absorbPendingProgress();
      state.ready = true;
      bindMapEvents();
      bindControls();
      state.examDraft = readExamDraft();
      if (state.examDraft) renderExamResume(); else createNextQuestion();
      // A conta entra depois que o treino já está de pé: nada aqui pode atrasar
      // ou impedir a primeira pergunta aparecer.
      account.initialize();
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

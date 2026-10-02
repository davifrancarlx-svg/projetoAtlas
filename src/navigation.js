(function (root) {
  'use strict';
  function create({ state, dom, actions, environment = root }) {
    const { document, location, history } = environment;
    const matchMedia = environment.matchMedia.bind(environment);
    const requestAnimationFrame = environment.requestAnimationFrame.bind(environment);
    function setView(view) {
      if (!['quiz', 'atlas', 'prog'].includes(view)) return;
      actions.checkpointStudy();
      state.view = view;
      actions.setActiveSince(view === 'quiz' && state.question && !state.answered && !document.hidden ? Date.now() : 0);
      document.body.dataset.view = view;
      dom.shell.dataset.view = view;
      if (view !== 'atlas' && /^#pais=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      dom.shell.classList.toggle('is-focus-mode', state.focusMode && view === 'quiz');
      dom.tabs.forEach((tab) => {
        if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page');
        else tab.removeAttribute('aria-current');
      });
      dom.skipVisual.hidden = true;
      dom.map.classList.remove('picking');
      actions.stopTimer();
      if (view === 'quiz' && state.sessionEnded) actions.renderSessionResult();
      else if (view === 'quiz' && !state.question && state.examDraft) actions.renderExamResume();
      else if (view === 'quiz' && !state.question && !state.exam && !state.fromDeck && !state.forcedQuestion) actions.createNextQuestion();
      else if (view === 'quiz') { actions.renderQuiz(); actions.syncMapForQuestion(); actions.startTimer(); }
      else if (view === 'atlas') actions.renderAtlas();
      else { actions.clearMapMarks(); actions.renderProgress(); }
      if (matchMedia('(max-width: 820px)').matches) {
        (view === 'quiz' && actions.isMapQuestion(state.question) && !state.sessionEnded ? dom.mapRegion : dom.panel)
          .scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      actions.announce(view === 'quiz' ? 'Treino aberto.' : view === 'atlas' ? 'Atlas aberto.' : 'Progresso aberto.');
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
      if (persist) actions.savePreferences();
      if (!state.mapCollapsed) requestAnimationFrame(actions.updateMapScaleSensitiveElements);
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
      actions.savePreferences();
    }

    function syncFilterLayout() {
      const hidden = filtersHidden();
      dom.controls.hidden = hidden;
      dom.filterToggle.setAttribute('aria-expanded', String(!hidden));
      const icon = dom.filterToggle.querySelector('.filter-toggle-icon');
      if (icon) icon.textContent = hidden ? '+' : '−';
    }


    function observeFilters() {
      if (PHONE_LAYOUT.addEventListener) PHONE_LAYOUT.addEventListener('change', syncFilterLayout);
      else PHONE_LAYOUT.addListener(syncFilterLayout);
      syncFilterLayout();
    }
    return { setView, setMapCollapsed, setFiltersCollapsed, syncFilterLayout, observeFilters };
  }
  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AtlasNavigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

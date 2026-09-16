(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * A aba Atlas: busca, filtro por área, ficha do país e territórios.
   *
   * Vive fora de app.js pelo mesmo motivo da conta: é um bloco coeso, que
   * cresce por conta própria, e o app principal já estava no teto do
   * orçamento. O módulo não conhece o app — recebe por `deps` o núcleo, o
   * estado compartilhado, os fabricantes de elemento e as operações de mapa.
   * ------------------------------------------------------------------ */

  function create(deps) {
    const { Core, state, ui, map, data } = deps;
    const { countries, byId, territoriesByCountry, indicatorMeta, families } = data;
    const { create: el, clear, flagImage, formatArea, formatList, announce } = ui;
    const getProgress = deps.getProgress;
    const onPractice = deps.onPractice;

    // Áreas de estudo do núcleo: os baldes amplos e, sob cada um, as
    // subregiões em que ele se divide. É a mesma lista do filtro de treino.
    const AREAS = Core.studyAreasOf(countries);
    const SORTED = countries.slice().sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
    let elements = null;
    let searchTimer = 0;

    function detach() { elements = null; }
    function territoriesOf(id) { return territoriesByCountry.get(id) || []; }

    function matchedTerritory(country, query) {
      if (!query) return null;
      return territoriesOf(country.id).find((territory) => (
        [territory.n, territory.cap, territory.r, territory.sr].map(Core.normalizeText).join(' ').includes(query)
      )) || null;
    }

    // O balde do filtro ativo. Escolher "Caribe" mantém "América do Norte,
    // Central e Caribe" aberto, para a volta ao balde amplo ser um clique.
    function activeRegion() {
      const found = AREAS.find((area) => area.value === state.atlasArea);
      return found ? found.region : '';
    }

    function matchesArea(country) {
      const area = state.atlasArea;
      return !area || country.r === area || country.sr === area;
    }

    function matches() {
      const query = Core.normalizeText(state.atlasQuery);
      return SORTED.filter((country) => {
        if (!matchesArea(country)) return false;
        if (!query) return true;
        const aliases = (country.aliases || []).map((alias) => alias.value);
        // O idioma entra na busca ("francês" lista quem o tem como oficial), e
        // a moeda também ("euro", "EUR"). Nenhum dos dois é resposta do quiz.
        const idiomas = Array.isArray(country.idiomas) ? country.idiomas : [];
        const moedas = (country.moedas || []).flatMap((moeda) => [moeda.nome, moeda.codigo]);
        if ([country.n, country.cap, country.r, country.sr, ...aliases, ...idiomas, ...moedas]
          .map(Core.normalizeText).join(' ').includes(query)) return true;
        // Quem procura por "Guiana Francesa" ou "Caiena" precisa achar o país
        // que responde por esse território, com a distinção explicada na ficha.
        return Boolean(matchedTerritory(country, query));
      });
    }

    function chip(area, sub) {
      const active = state.atlasArea === area.value;
      const button = el('button', {
        className: `atlas-area${sub ? ' is-sub' : ''}${active ? ' is-active' : ''}`,
        type: 'button', text: sub ? `↳ ${area.value}` : (area.value || 'Todos'),
        attrs: { 'data-area': area.value, 'aria-pressed': String(active) },
      });
      button.addEventListener('click', () => {
        // Clicar de novo no filtro ativo volta para "Todos": sem isso, limpar
        // exigiria procurar o primeiro botão da fila.
        state.atlasArea = active ? '' : area.value;
        state.atlasLimit = 60;
        renderAreas();
        renderList();
        announce(state.atlasArea ? `Atlas filtrado por ${state.atlasArea}.` : 'Filtro de área removido.');
      });
      return button;
    }

    function renderAreas() {
      if (!elements) return;
      clear(elements.areas);
      const aberto = activeRegion();
      elements.areas.append(chip({ value: '' }, false));
      AREAS.filter((area) => !area.subregion).forEach((area) => {
        elements.areas.append(chip(area, false));
        if (area.value !== aberto) return;
        AREAS.filter((sub) => sub.subregion && sub.region === area.value)
          .forEach((sub) => elements.areas.append(chip(sub, true)));
      });
    }

    function render() {
      map.setCursor(state.atlasSelected, false);
      clear(ui.panel());
      ui.renderScorebar();
      ui.panel().append(el('div', { className: 'plate' }, [
        el('span', { text: 'Atlas dos países' }),
        el('span', { text: `195 estados · ${data.territories.length} territórios` }),
      ]));
      ui.panel().append(el('h2', { className: 'panel-title', text: 'Explorar o mundo' }));
      const search = el('input', { className: 'search', attrs: {
        type: 'search', placeholder: 'Buscar país, capital, região, idioma ou moeda',
        'aria-label': 'Buscar no Atlas', value: state.atlasQuery,
      } });
      const areas = el('div', { className: 'atlas-areas', attrs: { role: 'group', 'aria-label': 'Filtrar por área' } });
      const detail = el('section', { className: 'atlas-detail', attrs: { 'aria-live': 'polite', 'aria-label': 'País selecionado' } });
      const count = el('p', { className: 'count' });
      const list = el('div', { className: 'list', attrs: { 'aria-label': 'Resultados da busca' } });
      const more = el('button', { className: 'btn ghost wide', text: 'Mostrar mais países', type: 'button' });
      search.addEventListener('input', () => {
        state.atlasQuery = search.value;
        state.atlasLimit = 60;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderList, 120);
      });
      more.addEventListener('click', () => { state.atlasLimit += 60; renderList(); });
      ui.panel().append(search, areas, detail, count, list, more);
      elements = { search, areas, detail, count, list, more };
      renderAreas();
      renderDetail();
      renderList();
      map.clearMarks();
      map.mark(state.atlasSelected, 'on');
      map.reticle(state.atlasSelected);
    }

    function renderDetail() {
      if (!elements) return;
      const country = byId[state.atlasSelected] || countries[0];
      clear(elements.detail);
      const idiomas = Array.isArray(country.idiomas) ? country.idiomas : [];
      const moedas = Array.isArray(country.moedas) ? country.moedas : [];
      const copy = el('div', { className: 'atlas-detail-copy' }, [
        el('h3', { text: country.n }),
        el('p', { text: `Capital: ${country.cap}` }),
        el('p', { text: `${country.sr} · ${formatArea(country.ar)}` }),
      ]);
      // Idioma e moeda ficam junto da capital: são do mesmo tipo de dado de
      // identidade do país, não indicadores com ano. A nota só existe quando o
      // uso cotidiano diverge do que vale por lei.
      if (idiomas.length) {
        copy.append(el('p', {
          className: 'idiomas',
          text: `${idiomas.length === 1 ? 'Idioma' : 'Idiomas'}: ${formatList(idiomas)}`,
        }));
        if (country.idiomasNota) copy.append(el('p', { className: 'note', text: country.idiomasNota }));
      }
      if (moedas.length) {
        copy.append(el('p', {
          className: 'moedas',
          text: `${moedas.length === 1 ? 'Moeda' : 'Moedas'}: ${formatList(moedas.map((moeda) => `${moeda.nome} (${moeda.codigo})`))}`,
        }));
        if (country.moedaNota) copy.append(el('p', { className: 'note', text: country.moedaNota }));
      }
      // Fronteiras terrestres, editoriais (src/borders.json). Quem é ilha diz isso.
      const vizinhos = (country.nb || []).map((id) => byId[id]).filter(Boolean);
      copy.append(el('p', { className: 'fronteiras', text: vizinhos.length
        ? `${vizinhos.length === 1 ? 'Fronteira terrestre' : `Fronteiras terrestres (${vizinhos.length})`}: ${formatList(vizinhos.map((outro) => {
          const nota = country.nbNotas && country.nbNotas[outro.id];
          return nota ? `${outro.n} (${nota})` : outro.n;
        }))}`
        : 'Sem fronteiras terrestres.' }));
      elements.detail.append(flagImage(country, { eager: true }), copy);
      elements.detail.append(masteryCard(country));

      const indicadores = ui.indicadores(country);
      if (indicadores.length) {
        const lista = el('dl', { className: 'indicadores' });
        indicadores.forEach((item) => {
          lista.append(
            el('dt', { text: item.rotulo }),
            el('dd', {}, [
              el('span', { className: 'valor', text: item.valor }),
              // O ano fica visivelmente secundário: precisa estar lá para o
              // número não passar por permanente, sem competir com ele.
              el('span', { className: 'ano', text: String(item.ano) }),
            ])
          );
        });
        elements.detail.append(lista);
      }

      const fatos = ui.fatos(country);
      if (fatos.length) {
        const bloco = el('ul', { className: 'fatos', attrs: { 'aria-label': `Destaques de ${country.n}` } });
        fatos.forEach((fato) => bloco.append(el('li', { text: fato })));
        elements.detail.append(bloco);
      }

      // A explicação da ausência só aparece para quem realmente não tem o dado.
      [country.bmNota, country.hdiNota].filter(Boolean).forEach((nota) => {
        elements.detail.append(el('p', { className: 'note', text: nota }));
      });
      elements.detail.append(el('p', {
        className: 'source-note',
        text: `Indicadores: ${indicatorMeta.bancoMundial.fonte} (${indicatorMeta.bancoMundial.licenca}). IDH: ${indicatorMeta.idh.fonte}.`,
      }));
      territoriesOf(country.id).forEach((territory) => {
        elements.detail.append(territoryCard(country, territory));
      });
    }

    // A ficha diz onde o jogador está com aquele país e oferece o atalho para
    // praticá-lo. Antes o caminho só existia no sentido contrário, do mapa de
    // domínio para o Atlas.
    function masteryCard(country) {
      const card = el('section', { className: 'atlas-mastery', attrs: { 'aria-label': `Seu domínio de ${country.n}` } });
      const list = el('dl');
      const now = Date.now();
      Object.entries(families).forEach(([label, directions]) => {
        const skills = directions.map((direction) => Core.skillOf(getProgress(), country.id, direction));
        const attempted = skills.some((skill) => skill.attempts > 0);
        const due = skills.some((skill) => skill.attempts > 0 && Core.isDue(skill, now));
        const level = Math.round(ui.familyLevel(country, directions) * Core.MAX_LEVEL);
        const dots = el('span', { className: 'mastery-skills', attrs: { 'aria-hidden': 'true' } });
        dots.append(el('i', { attrs: { 'data-level': level } }));
        const status = attempted
          ? `nível ${level} de ${Core.MAX_LEVEL}${due ? ' · revisão vencida' : ''}`
          : 'ainda não praticado';
        list.append(el('dt', { text: label }), el('dd', {}, [dots, el('span', { text: status })]));
      });
      card.append(list);
      const practice = el('button', { className: 'btn ghost', type: 'button', text: `Praticar ${country.n}` });
      practice.addEventListener('click', () => onPractice(country.id));
      card.append(practice);
      return card;
    }

    function territoryCard(country, territory) {
      const card = el('div', { className: 'territory-card', attrs: { 'data-territory': territory.id } });
      card.append(el('h4', {}, [
        el('span', { text: territory.n }),
        el('span', { className: 'territory-tag', text: territory.tag || 'território' }),
      ]));
      card.append(el('p', { className: 'territory-meta', text: `${territory.status} · capital regional ${territory.cap}` }));
      card.append(el('p', { className: 'territory-meta', text: `${territory.sr} · ${formatArea(territory.ar)}` }));
      (territory.notes || []).forEach((note) => card.append(el('p', { className: 'note', text: note })));
      const locate = el('button', {
        className: 'btn ghost', type: 'button', text: `Ver ${territory.n} no mapa`,
      });
      locate.addEventListener('click', () => {
        map.clearMarks();
        map.mark(country.id, 'on');
        map.reticle(country.id, map.territoryPoint(territory));
        map.fitTerritory(territory);
        announce(`${territory.n} no mapa. ${territory.status}. Capital regional ${territory.cap}.`);
      });
      card.append(locate);
      return card;
    }

    function renderList() {
      if (!elements) return;
      const found = matches();
      const visible = found.slice(0, state.atlasLimit);
      clear(elements.list);
      elements.count.textContent = `${found.length} ${found.length === 1 ? 'resultado' : 'resultados'}`
        + (state.atlasArea ? ` em ${state.atlasArea}` : '');
      const query = Core.normalizeText(state.atlasQuery);
      visible.forEach((country) => {
        const territory = matchedTerritory(country, query);
        const row = el('button', { className: 'row', type: 'button', attrs: {
          'data-country': country.id, 'aria-current': country.id === state.atlasSelected ? 'true' : null,
        } });
        row.append(flagImage(country, { decorative: true }), el('span', { className: 'row-txt' }, [
          el('span', { className: 'row-n', text: country.n }),
          el('span', { className: 'row-c', text: territory ? `${country.cap} · inclui ${territory.n}` : `${country.cap} · ${country.sr}` }),
        ]));
        row.addEventListener('click', () => select(country.id, true, territory));
        elements.list.append(row);
      });
      elements.more.hidden = visible.length >= found.length;
      elements.more.textContent = `Mostrar mais (${found.length - visible.length})`;
      if (!found.length) elements.list.append(el('p', { className: 'empty', text: state.atlasArea
        ? 'Nada corresponde à busca dentro dessa área. Toque no filtro ativo para ver o mundo inteiro.'
        : 'Nenhum país, capital, região, idioma ou moeda corresponde à busca.' }));
    }

    function select(id, fit = false, territory = null) {
      if (!byId[id]) return;
      const focused = territory && territory.of === id ? territory : null;
      state.atlasSelected = id;
      map.setCursor(id, false);
      map.clearMarks();
      map.mark(id, 'on');
      map.reticle(id, focused ? map.territoryPoint(focused) : null);
      if (fit) {
        if (focused) map.fitTerritory(focused);
        else map.fitCountry(id);
      }
      renderDetail();
      if (elements) elements.list.querySelectorAll('[data-country]').forEach((row) => {
        if (row.dataset.country === id) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
      });
      if (focused && elements) {
        const card = elements.detail.querySelector(`[data-territory="${focused.id}"]`);
        if (card) card.classList.add('is-focused');
      }
      announce(focused
        ? `${focused.n}. ${focused.status}. Capital regional ${focused.cap}. Selecionado como ${byId[id].n}.`
        : `${byId[id].n}. Capital ${byId[id].cap}. ${byId[id].sr}.`);
    }

    return Object.freeze({ render, renderDetail, renderList, select, detach });
  }

  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasBrowser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

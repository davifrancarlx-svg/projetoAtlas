(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * A aba Progresso: totais, domínio, revisões, prova, backup e recomeço.
   *
   * Saiu de app.js pelo mesmo motivo da conta e do Atlas: é um bloco coeso e
   * o app principal tinha voltado ao teto do orçamento. O módulo não conhece o
   * armazenamento nem o mapa — recebe por `deps` o núcleo, o estado, os
   * fabricantes de elemento e as ações do app, e devolve `render`. Apagar o
   * progresso de verdade continua no app (`actions.resetAll`), que é quem
   * sabe gravar; aqui fica só a conversa com a pessoa.
   * ------------------------------------------------------------------ */

  function create(deps) {
    const { Core, Study, state, data, ui, actions, sounds, account, getProgress, setProgress } = deps;
    const { countries, ids: IDS, byId, directions: DIRECTIONS, families, labels, mapMeta } = data;
    const { create: el, announce, formatPercent, numero } = ui;
    const SORTED = countries.slice().sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));

    function familyPercent(directions) {
      const progress = getProgress();
      const maximum = countries.length * directions.length * Core.MAX_LEVEL;
      const score = countries.reduce((total, country) => total
        + directions.reduce((sum, direction) => sum + Core.levelOf(progress, country.id, direction), 0), 0);
      return { score, maximum, percent: maximum ? score / maximum * 100 : 0 };
    }

    function progressBar(label, directions) {
      const value = familyPercent(directions);
      const wrapper = el('div', { className: 'bar' });
      wrapper.append(el('div', { className: 'bar-top' }, [
        el('strong', { text: label }), el('span', { text: formatPercent(value.percent) }),
      ]));
      wrapper.append(el('progress', { className: 'progress-native', attrs: {
        max: value.maximum, value: value.score,
        'aria-label': `Domínio em ${label}: ${formatPercent(value.percent)}`,
      } }));
      return wrapper;
    }

    function masteryOverview() {
      const section = el('section', { className: 'pgroup mastery-overview', attrs: { 'aria-labelledby': 'countryMasteryTitle' } });
      section.append(el('h3', { id: 'countryMasteryTitle', text: 'Mapa de domínio' }));
      const regions = el('div', { className: 'region-badges', attrs: { role: 'group', 'aria-label': 'Domínio por região' } });
      Core.regionsOf(countries).forEach((region) => {
        const value = ui.regionMastery(region);
        const badge = el('div', { className: `region-badge${value.complete ? ' is-complete' : ''}` });
        badge.append(el('span', { className: 'region-badge-mark', text: value.complete ? '◆' : '◇', attrs: { 'aria-hidden': 'true' } }));
        badge.append(el('span', {}, [el('strong', { text: region }), el('small', { text: formatPercent(value.percent) })]));
        regions.append(badge);
      });
      section.append(regions);
      const details = el('details', { className: 'mastery-details' });
      details.append(el('summary', { text: 'Ver os 195 países por habilidade' }));
      const legend = el('p', { className: 'mastery-legend', text: 'Bandeira · Capital · Localização' });
      const grid = el('div', { className: 'mastery-grid' });
      let populated = false;
      details.addEventListener('toggle', () => {
        if (!details.open || populated) return;
        populated = true;
        SORTED.forEach((country) => {
          const values = [families.Bandeiras, families.Capitais, families.Localização]
            .map((directions) => Math.round(ui.familyLevel(country, directions) * 5));
          const tile = el('button', { className: 'mastery-tile', type: 'button', attrs: {
            title: country.n,
            'aria-label': `${country.n}: bandeira nível ${values[0]}, capital nível ${values[1]}, localização nível ${values[2]}`,
          } });
          tile.append(el('b', { text: country.id }));
          const skills = el('span', { className: 'mastery-skills', attrs: { 'aria-hidden': 'true' } });
          values.forEach((value) => skills.append(el('i', { attrs: { 'data-level': value } })));
          tile.append(skills);
          tile.addEventListener('click', () => actions.openCountry(country.id));
          grid.append(tile);
        });
      });
      details.append(legend, grid);
      section.append(details);
      return section;
    }

    function renderSessionSummary(container) {
      const stats = actions.sessionStats();
      const section = el('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'sessionTitle' } });
      section.append(el('h3', { id: 'sessionTitle', text: 'Esta sessão' }));
      if (!stats.total) {
        section.append(el('p', { className: 'empty', text: 'Nenhuma pergunta respondida nesta sessão ainda.' }));
        container.append(section);
        return;
      }
      const facts = [
        `${stats.total} ${stats.total === 1 ? 'pergunta' : 'perguntas'}`,
        `${formatPercent(stats.accuracy)} de precisão`,
        stats.averageSeconds !== null ? `${stats.averageSeconds.toFixed(1).replace('.', ',')}s por resposta` : null,
        stats.expired ? `${stats.expired} por tempo esgotado` : null,
      ].filter(Boolean);
      section.append(el('p', { className: 'section-copy', text: facts.join(' · ') }));
      Study.note(section, Study.evolution(state.sessionAnswers));

      // A mesma lista do fechamento da sessão, na mesma ordem de gravidade: dois
      // lugares contando "os erros desta sessão" de jeitos diferentes confundiam.
      const mistakes = actions.mistakes();
      if (mistakes.length) {
        const deck = el('button', {
          className: 'btn wide', type: 'button',
          text: mistakes.length === 1
            ? 'Revisar o erro desta sessão'
            : `Revisar os ${mistakes.length} pontos fracos desta sessão`,
        });
        deck.addEventListener('click', actions.startMistakeDeck);
        section.append(deck);
        const list = el('div', { className: 'weak' });
        mistakes.forEach((item) => {
          const chip = el('button', {
            className: `chip${item.recovered ? '' : ' chip-urgent'}`, type: 'button',
            text: item.misses > 1
              ? `${byId[item.id].n} · ${labels[item.direction]} · ${item.misses}×`
              : `${byId[item.id].n} · ${labels[item.direction]}`,
          });
          chip.addEventListener('click', () => actions.startReview(item.id, item.direction));
          list.append(chip);
        });
        section.append(expandList(list, 'Ver todos os erros, por gravidade'));
      } else {
        section.append(el('p', { className: 'empty', text: 'Nenhum erro pendente nesta sessão.' }));
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
      const progress = getProgress();
      const serialized = Core.serializeProgress(progress, { countryIds: IDS });
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = el('a', { attrs: { href: url, download: progressFileName() } });
      document.body.append(link);
      link.click();
      link.remove();
      // O objeto fica vivo até o download começar; um tempo curto basta e evita
      // vazar a URL na sessão.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      const studied = Object.keys(progress.countries || {}).length;
      state.importStatus = { kind: 'ok', text: `Arquivo gerado com ${studied} ${studied === 1 ? 'país' : 'países'} no histórico.` };
      render();
      announce('Progresso exportado para arquivo.');
    }

    // A importação funde, nunca sobrescreve: mergeProgress resolve por geração,
    // época e revisão, então trazer um backup antigo não apaga o que já existe
    // neste navegador, e um reset mais recente continua vencendo.
    async function importProgressFile(file) {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        state.importStatus = { kind: 'error', text: 'Arquivo grande demais para ser um progresso do Atlas.' };
        render();
        announce('Arquivo recusado: tamanho incompatível.');
        return;
      }
      let raw;
      try {
        raw = await file.text();
      } catch (_) {
        state.importStatus = { kind: 'error', text: 'Não foi possível ler o arquivo escolhido.' };
        render();
        return;
      }
      const decoded = Core.deserializeProgress(raw, { countryIds: IDS });
      if (decoded.recovered) {
        state.importStatus = { kind: 'error', text: 'Este arquivo não é um progresso válido do Atlas 195. Nada foi alterado.' };
        render();
        announce('Importação recusada: arquivo inválido.');
        return;
      }
      const progress = getProgress();
      const before = Core.serializeProgress(progress, { countryIds: IDS });
      const merged = Core.mergeProgress(progress, decoded.progress, { countryIds: IDS });
      const after = Core.serializeProgress(merged, { countryIds: IDS });
      setProgress(merged);
      const incomingCountries = Object.keys(decoded.progress.countries || {}).length;
      const totalCountries = Object.keys(merged.countries || {}).length;
      if (after === before) {
        state.importStatus = { kind: 'ok', text: 'Arquivo válido, mas ele não trazia nada novo além do que já estava aqui.' };
      } else {
        actions.saveNow();
        state.importStatus = {
          kind: 'ok',
          text: `Progresso fundido: ${incomingCountries} ${incomingCountries === 1 ? 'país' : 'países'} no arquivo, `
            + `${totalCountries} no histórico agora.`,
        };
      }
      render();
      announce(state.importStatus.text);
    }

    function renderBackup(container) {
      const card = el('section', { className: 'source-card', attrs: { 'aria-labelledby': 'backupTitle' } });
      card.append(el('h3', { id: 'backupTitle', text: 'Backup do progresso' }));
      card.append(el('p', {
        text: 'O progresso vive somente neste navegador. Exporte um arquivo para guardar ou levar '
          + 'para outro aparelho; a importação funde com o que já existe aqui, sem apagar nada.',
      }));
      const row = el('div', { className: 'button-row' });
      const exportButton = el('button', { className: 'btn ghost', type: 'button', text: 'Exportar progresso' });
      exportButton.addEventListener('click', exportProgress);
      const input = el('input', {
        id: 'importProgressInput', className: 'file-input',
        attrs: { type: 'file', accept: 'application/json,.json' },
      });
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.value = '';
        importProgressFile(file);
      });
      const label = el('label', {
        className: 'btn ghost', text: 'Importar progresso',
        attrs: { for: 'importProgressInput' },
      });
      row.append(exportButton, input, label);
      card.append(row);
      if (state.importStatus) {
        card.append(el('p', {
          className: `note${state.importStatus.kind === 'error' ? ' note-error' : ''}`,
          text: state.importStatus.text, attrs: { role: 'status' },
        }));
      }
      container.append(card);
    }

    // Números de toda a história, não só desta sessão. O recorde de sequência já
    // era salvo e sincronizado, mas nunca aparecia em lugar nenhum.
    function overallStats(attempted) {
      const attempts = attempted.reduce((sum, item) => sum + item.skill.attempts, 0);
      const correct = attempted.reduce((sum, item) => sum + item.skill.correct, 0);
      const strip = el('div', { className: 'session-result-stats overall-stats', attrs: { role: 'group', 'aria-label': 'Totais de todo o histórico' } });
      strip.append(
        el('span', {}, [el('b', { text: numero(attempts) }), document.createTextNode(attempts === 1 ? ' resposta' : ' respostas')]),
        el('span', {}, [el('b', { text: attempts ? formatPercent(correct / attempts * 100) : '—' }), document.createTextNode(' de acerto')]),
        el('span', {}, [el('b', { text: numero(getProgress().bestStreak) }), document.createTextNode(' recorde de sequência')]),
      );
      return strip;
    }

    function expandList(list, label) {
      if (list.children.length <= 12) return list;
      const details = el('details');
      details.append(el('summary', { text: label + ' (' + list.children.length + ')' }));
      const rest = el('div', { className: 'weak' });
      [...list.children].slice(12).forEach(child => rest.append(child));
      details.append(rest);
      return el('div', {}, [list, details]);
    }

    function skillChips(items, className, empty) {
      const list = el('div', { className: 'weak' });
      items.forEach((item) => {
        const button = el('button', { className, type: 'button', text: `${item.country.n} · ${labels[item.direction]}` });
        button.addEventListener('click', () => actions.startReview(item.country.id, item.direction));
        list.append(button);
      });
      if (!items.length) list.append(el('p', { className: 'empty', text: empty }));
      return expandList(list, 'Ver todas');
    }

    function sourceCard() {
      const source = mapMeta && mapMeta.source || {};
      const section = el('section', { className: 'source-card', attrs: { 'aria-labelledby': 'sourceTitle' } });
      section.append(el('h3', { id: 'sourceTitle', text: 'Dados cartográficos' }));
      section.append(el('p', { text: `${source.name || 'Natural Earth'} · ${mapMeta.scale || '1:10m'} · versão ${mapMeta.version || '5.1.1'} · ${source.boundaryPolicy || 'visão de fronteiras padrão'}.` }));
      section.append(el('p', { className: 'source-note', text: `${mapMeta.stats && mapMeta.stats.worldPolygons
        ? new Intl.NumberFormat('pt-BR').format(mapMeta.stats.worldPolygons) : 'Milhares de'} componentes territoriais mundiais preservados. Dados em domínio público.` }));
      section.append(el('p', { className: 'source-note', text: 'Bandeiras: flag-icons 7.5.0, coleção SVG sob licença MIT.' }));
      return section;
    }

    function focusById(id) { document.getElementById(id)?.focus(); }

    // Apagar trava a barra e as abas até o app confirmar que gravou: um clique
    // no meio do caminho não pode começar uma pergunta num progresso que ainda
    // está sendo substituído.
    async function confirmReset() {
      if (state.resetPending) return;
      state.resetPending = true;
      ui.lockShell(true);
      render();
      focusById('resetPendingStatus');
      try {
        await actions.resetAll();
        state.resetPending = false;
        state.resetArmed = false;
        ui.lockShell(false);
        if (state.view === 'prog') render();
        announce('Todo o progresso foi apagado.');
        if (state.view === 'prog') focusById('progressTitle');
      } catch (_) {
        state.resetPending = false;
        ui.lockShell(false);
        if (state.view === 'prog') render();
        ui.storageStatus('Não foi possível apagar o progresso com segurança.', 'error', true);
        if (state.view === 'prog') focusById('confirmReset');
      }
    }

    function resetZone() {
      const reset = el('section', { className: 'reset-zone', attrs: { 'aria-labelledby': 'resetTitle' } });
      reset.append(el('h3', { id: 'resetTitle', text: 'Recomeçar' }));
      if (!state.resetArmed) {
        const button = el('button', { id: 'resetProgress', className: 'btn ghost', text: 'Apagar todo o progresso', type: 'button' });
        button.addEventListener('click', () => {
          state.resetArmed = true;
          render();
          focusById('confirmReset');
        });
        reset.append(button);
        return reset;
      }
      reset.append(el('p', {
        id: state.resetPending ? 'resetPendingStatus' : null,
        className: 'note',
        text: state.resetPending
          ? 'Conferindo os dados mais recentes antes de apagar…'
          : 'Esta ação apaga níveis, histórico de revisão, tempo de estudo, confusões e recorde. As preferências e o apelido serão mantidos.',
        attrs: state.resetPending ? { role: 'status', 'aria-live': 'polite', tabindex: '-1' } : {},
      }));
      const row = el('div', { className: 'button-row' });
      const cancel = el('button', { className: 'btn ghost', text: 'Cancelar', type: 'button', attrs: {
        disabled: state.resetPending ? '' : null,
      } });
      const confirm = el('button', { id: 'confirmReset', className: 'btn danger', text: 'Confirmar exclusão', type: 'button', attrs: {
        disabled: state.resetPending ? '' : null,
      } });
      cancel.addEventListener('click', () => {
        if (state.resetPending) return;
        state.resetArmed = false;
        render();
        focusById('resetProgress');
      });
      confirm.addEventListener('click', confirmReset);
      row.append(cancel, confirm);
      reset.append(row);
      return reset;
    }

    function render() {
      const focused = document.activeElement;
      const accountFocus = focused && ['contaEmail', 'pedirLink', 'retomarConta', 'contaApelido', 'salvarApelido'].includes(focused.id)
        ? { id: focused.id, start: focused.selectionStart, end: focused.selectionEnd } : null;
      ui.prepare();
      const panel = ui.panel();
      const progress = getProgress();
      const attempted = actions.attempted();
      const now = Date.now();
      const due = attempted.filter((item) => item.skill.nextReviewAt && Date.parse(item.skill.nextReviewAt) <= now)
        .sort((a, b) => Date.parse(a.skill.nextReviewAt) - Date.parse(b.skill.nextReviewAt));
      const attemptedCountries = new Set(attempted.map((item) => item.country.id));
      const mastered = countries.filter((country) => DIRECTIONS.every((direction) => Core.levelOf(progress, country.id, direction) === Core.MAX_LEVEL)).length;
      panel.append(el('div', { className: 'plate' }, [
        el('span', { text: 'Progresso validado' }), el('span', { text: `esquema v${Core.SCHEMA_VERSION}` }),
      ]));
      panel.append(el('h2', { id: 'progressTitle', className: 'panel-title', text: 'Seu aprendizado', attrs: { tabindex: '-1' } }));
      panel.append(el('p', { className: 'section-copy', text: `${attemptedCountries.size} países estudados · ${countries.length - attemptedCountries.size} ainda não estudados · ${mastered} dominados · ${due.length} revisões vencidas` }));
      const fresh = actions.fresh();
      const pending = actions.pending();
      const recommended = Study.recommendation({ pending, fresh, mistakes: actions.mistakes() });
      const next = el('section', { className: 'source-card next-study', attrs: { 'aria-labelledby': 'nextStudyTitle' } });
      next.append(el('h3', { id: 'nextStudyTitle', text: 'Seu próximo passo' }),
        el('p', { text: recommended.text }));
      const begin = el('button', { id: 'recommendedTraining', className: 'btn wide', type: 'button', text: recommended.title,
        attrs: { 'data-recommendation': recommended.kind } });
      begin.addEventListener('click', () => {
        if (recommended.kind === 'due') actions.startDue();
        else if (recommended.kind === 'mistakes') actions.startMistakeDeck();
        else if (recommended.kind === 'fresh') actions.startFresh();
        else actions.startDaily(state.dailySize || 10);
      });
      next.append(begin); panel.append(next);
      panel.append(overallStats(attempted));

      renderSessionSummary(panel);
      Study.note(panel, actions.nextReview());
      const otherTraining = el('details', { className: 'pgroup', attrs: { 'data-other-training': '' } });
      otherTraining.append(el('summary', { text: 'Escolher outro treino' }));
      Study.card(otherTraining, actions.startDaily, state.dailySize || 10, (size) => { state.dailySize = size; actions.savePreferences(); });
      const newButton = el('button', { id: 'freshTraining', className: 'btn', type: 'button', text: 'Treinar somente novidades', attrs: { disabled: fresh.length ? null : '' } });
      newButton.addEventListener('click', actions.startFresh);
      otherTraining.append(newButton);
      Study.note(otherTraining, fresh.length + ' habilidades ainda não praticadas nestes filtros. Lotes de até 30 perguntas.');
      panel.append(otherTraining);
      Core.Learning.panel(panel, progress, { el, byId, labels, practicePair: actions.practicePair, comparePair: actions.comparePair });
      Study.shortcuts(panel);

      // O treino livre é infinito, o que serve para revisar mas não para medir.
      // A prova fecha uma série e dá uma nota, respeitando o modo e a área de
      // estudo escolhidos na barra de controles.
      const prova = el('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'examTitle' } });
      prova.append(el('h3', { id: 'examTitle', text: 'Prova' }));
      prova.append(el('p', {
        className: 'section-copy',
        text: 'Uma série fechada, com nota no fim. Usa o modo e a área de estudo selecionados.',
      }));
      const opcoes = el('div', { className: 'button-row' });
      [10, 20, 30].forEach((total) => {
        const botao = el('button', {
          className: total === 20 ? 'btn' : 'btn ghost', type: 'button',
          text: `${total} perguntas`,
          attrs: { 'aria-label': `Iniciar prova de ${total} perguntas` },
        });
        botao.addEventListener('click', () => actions.startExam(total));
        opcoes.append(botao);
      });
      prova.append(opcoes);
      panel.append(prova);

      const mastery = el('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'masteryTitle' } });
      mastery.append(el('h3', { id: 'masteryTitle', text: 'Domínio por habilidade' }));
      Object.entries(families).forEach(([label, directions]) => mastery.append(progressBar(label, directions)));
      panel.append(mastery);
      panel.append(masteryOverview());

      const review = el('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'reviewTitle' } });
      review.append(el('h3', { id: 'reviewTitle', text: 'Revisões recomendadas' }));
      const reviewAll = el('button', { id: 'dueTraining', className: 'btn', type: 'button', text: 'Revisar somente pendências', attrs: { disabled: pending.length ? null : '' } });
      reviewAll.addEventListener('click', actions.startDue);
      review.append(reviewAll);
      Study.note(review, `${pending.length} habilidades vencidas no modo e na área selecionados. Lotes de até 30 perguntas, das mais antigas às mais recentes; ao terminar, você pode continuar com as próximas.`);
      Study.note(review, 'Lista geral: revisões mais antigas primeiro, independentemente dos filtros de treino.');
      review.append(skillChips(due, 'chip hot', attempted.length
        ? 'Tudo revisado por enquanto. Novas revisões aparecerão na data adequada.'
        : 'Responda algumas perguntas para criar seu primeiro ciclo de revisão.'));
      panel.append(review);

      const weakItems = attempted.filter((item) => item.skill.level <= 1)
        .sort((a, b) => a.skill.level - b.skill.level || a.skill.correct / a.skill.attempts - b.skill.correct / b.skill.attempts);
      const weakSection = el('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'weakTitle' } });
      weakSection.append(el('h3', { id: 'weakTitle', text: 'Pontos para reforçar' }));
      Study.note(weakSection, 'Lista geral: menor nível primeiro; em empate, menor proporção de acertos.');
      weakSection.append(skillChips(weakItems, 'chip', attempted.length
        ? 'Nenhuma habilidade fraca registrada.' : 'Ainda não há histórico suficiente para apontar dificuldades.'));
      panel.append(weakSection);

      // O botão do topo liga e desliga; volume, estilo e quando tocar ficam aqui,
      // junto das outras preferências. O módulo monta o próprio painel.
      sounds.panel(panel);
      account.render(panel);
      renderBackup(panel);
      panel.append(sourceCard(), resetZone());
      // Conserva títulos e controles; detalhes secundários deixam de competir
      // com o treino recomendado. Foco de conta/backup permanece visível.
      for (const [id, title] of [['historyTitle', 'Evolução e histórico de estudo'], ['examTitle', 'Fazer uma prova'],
        ['masteryTitle', 'Domínio por habilidade'], ['reviewTitle', 'Ver todas as revisões'], ['weakTitle', 'Ver pontos para reforçar']]) {
        const section = panel.querySelector('#' + id)?.parentElement;
        if (!section) continue;
        const details = el('details', { className: 'pgroup progress-details', attrs: { 'data-progress-details': id } });
        details.append(el('summary', { text: title }));
        section.replaceWith(details); details.append(section);
      }
      if (accountFocus) {
        const restored = document.getElementById(accountFocus.id)
          || (accountFocus.id === 'retomarConta' && document.getElementById('contaApelido'));
        restored?.focus({ preventScroll: true });
        if (restored && accountFocus.start !== null && accountFocus.start !== undefined) {
          restored.setSelectionRange(accountFocus.start, accountFocus.end);
        }
      }
    }

    return Object.freeze({ render });
  }

  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

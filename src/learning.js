(function (root) {
  'use strict';
  const REASONS = {
    'flag-similar': 'bandeiras parecidas', 'capital-similar': 'capitais com nomes parecidos',
    'capital-initial': 'capitais com a mesma inicial', border: 'fronteira em comum',
    neighbour: 'proximidade no mapa', 'same-subregion': 'mesma subregião',
    'same-region': 'mesma região', other: 'outra confusão',
  };
  const empty = () => ({ devices: {}, sessions: {}, errors: {} });
  const clone = value => JSON.parse(JSON.stringify(value || empty()));
  const plain = value => value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
  const identifier = value => typeof value === 'string' && /^[a-z0-9-]{8,80}$/.test(value);
  function valid(value, ids, directions) {
    if (!plain(value) || Object.keys(value).sort().join() !== 'devices,errors,sessions') return false;
    const limits = { devices: 256, sessions: 200, errors: 1000 };
    return Object.keys(limits).every(kind => {
      const entries = value[kind];
      if (!plain(entries) || Object.keys(entries).length > limits[kind]) return false;
      return Object.entries(entries).every(([key, row]) => {
        if (!identifier(key) || !plain(row)) return false;
        if (kind === 'devices') return Object.keys(row).sort().join() === 'answers,ms'
          && integer(row.ms) && integer(row.answers);
        if (!date(row.at)) return false;
        if (kind === 'sessions') {
          if (!['answers,at,ms', 'answers,at,ms,skills'].includes(Object.keys(row).sort().join())
            || !integer(row.ms) || !integer(row.answers)) return false;
          if (!Object.hasOwn(row, 'skills')) return true;
          return plain(row.skills) && Object.entries(row.skills).every(([direction, counts]) =>
            directions.includes(direction) && plain(counts) && Object.keys(counts).sort().join() === 'answers,correct'
            && integer(counts.answers) && integer(counts.correct) && counts.correct <= counts.answers)
            && Object.values(row.skills).reduce((sum, counts) => sum + counts.answers, 0) <= row.answers;
        }
        return Object.keys(row).sort().join() === 'at,chosen,direction,id,reason'
          && /^[A-Z]{2}$/.test(row.id) && /^[A-Z]{2}$/.test(row.chosen) && row.id !== row.chosen
          && (!ids || (ids[row.id] && ids[row.chosen])) && directions.includes(row.direction)
          && Object.hasOwn(REASONS, row.reason);
      });
    });
  }
  function trim(entries, limit) {
    return Object.fromEntries(Object.entries(entries).sort((a, b) => b[1].at.localeCompare(a[1].at)
      || b[0].localeCompare(a[0])).slice(0, limit).sort((a, b) => a[0].localeCompare(b[0])));
  }
  function merge(left, right) {
    const result = empty();
    for (const kind of Object.keys(result)) {
      for (const source of [left || empty(), right || empty()]) {
        for (const [key, row] of Object.entries(source[kind])) {
          const previous = result[kind][key];
          if (!previous) result[kind][key] = { ...row, ...(row.skills ? {
            skills: Object.fromEntries(Object.entries(row.skills).sort((a, b) => a[0].localeCompare(b[0])).map(([direction, counts]) => [direction, { ...counts }]))
          } : {}) };
          else if (kind === 'errors') result[kind][key] = JSON.stringify(previous) >= JSON.stringify(row) ? previous : { ...row };
          else {
            const merged = { ms: Math.max(previous.ms, row.ms), answers: Math.max(previous.answers, row.answers),
              ...(kind === 'sessions' ? { at: previous.at < row.at ? previous.at : row.at } : {}) };
            if (kind === 'sessions' && (previous.skills || row.skills)) {
              merged.skills = {};
              for (const direction of [...new Set([...Object.keys(previous.skills || {}), ...Object.keys(row.skills || {})])].sort()) {
                const a = previous.skills?.[direction] || { answers: 0, correct: 0 };
                const b = row.skills?.[direction] || { answers: 0, correct: 0 };
                merged.skills[direction] = { answers: Math.max(a.answers, b.answers), correct: Math.max(a.correct, b.correct) };
              }
              merged.answers = Math.max(merged.answers, Object.values(merged.skills).reduce((sum, c) => sum + c.answers, 0));
            }
            result[kind][key] = merged;
          }
        }
      }
      result[kind] = kind === 'devices'
        ? Object.fromEntries(Object.entries(result[kind]).sort((a, b) => a[0].localeCompare(b[0])))
        : trim(result[kind], kind === 'sessions' ? 200 : 1000);
    }
    return result;
  }
  function record(value, event) {
    const source = value || empty();
    const result = { devices: { ...source.devices }, sessions: { ...source.sessions }, errors: { ...source.errors } };
    if (!identifier(event.device) || !identifier(event.session) || !identifier(event.event)) throw new TypeError('Invalid learning identifier');
    const ms = Math.round(Math.max(0, Math.min(3600000, Number.isFinite(event.ms) ? event.ms : 0)));
    for (const [kind, key] of [['devices', event.device], ['sessions', event.session]]) {
      const row = result[kind][key] || { ms: 0, answers: 0, ...(kind === 'sessions' ? { at: event.at } : {}) };
      result[kind][key] = { ...row, ms: row.ms + ms, answers: row.answers + 1 };
      if (kind === 'sessions' && typeof event.correct === 'boolean') {
        const skills = result[kind][key].skills = { ...row.skills };
        const counts = skills[event.direction] = { ...(row.skills?.[event.direction] || { answers: 0, correct: 0 }) };
        counts.answers += 1;
        if (event.correct) counts.correct += 1;
      }
    }
    if (event.chosen && event.chosen !== event.id) result.errors[event.event] = {
      at: event.at, id: event.id, chosen: event.chosen, direction: event.direction, reason: event.reason || 'other',
    };
    return merge(result, empty());
  }
  function summary(value) {
    const history = value || empty();
    const groups = new Map();
    Object.values(history.errors).forEach(row => {
      const key = [row.id, row.chosen, row.direction, row.reason].join(':');
      const group = groups.get(key) || { ...row, count: 0 };
      group.count += 1;
      if (row.at > group.at) group.at = row.at;
      groups.set(key, group);
    });
    return { ms: Object.values(history.devices).reduce((sum, row) => sum + row.ms, 0),
      sessions: Object.values(history.sessions).sort((a, b) => b.at.localeCompare(a.at)),
      confusions: [...groups.values()].sort((a, b) => b.count - a.count || b.at.localeCompare(a.at)) };
  }
  const duration = ms => {
    const seconds = Math.round(ms / 1000);
    return seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}min`
      : seconds >= 60 ? `${Math.floor(seconds / 60)}min ${seconds % 60}s` : `${seconds}s`;
  };
  const FAMILIES = { Capitais: ['cap', 'capOf'], Bandeiras: ['flag', 'flagOf'], Localização: ['mapId', 'locate'], Regiões: ['reg'] };
  function evolution(value) {
    const sessions = Object.values(value?.sessions || {}).filter(row => row.skills).sort((a, b) => b.at.localeCompare(a.at));
    return Object.entries(FAMILIES).map(([label, directions]) => {
      const samples = sessions.map(row => ({ at: row.at, ...directions.reduce((sum, direction) => {
        const counts = row.skills[direction];
        if (counts) { sum.answers += counts.answers; sum.correct += counts.correct; }
        return sum;
      }, { answers: 0, correct: 0 }) })).filter(row => row.answers);
      // Compara duas sessões distintas da mesma habilidade; nunca usa erros
      // identificáveis como substituto de todos os erros ou inventa o passado.
      const [recent, previous] = samples;
      const enough = recent?.answers >= 5 && previous?.answers >= 5;
      const delta = enough ? (recent.correct / recent.answers - previous.correct / previous.answers) * 100 : null;
      return { label, recent, previous, delta };
    });
  }
  function pairPlan(id, chosen, direction, includeVisual = true) {
    if (!id || !chosen || id === chosen) return [];
    const visual = ['flag', 'flagOf', 'mapId', 'locate'];
    const focus = ['cap', 'capOf', ...visual].includes(direction)
      && (includeVisual || !visual.includes(direction)) ? direction : 'cap';
    const complementary = focus === 'cap' ? 'capOf' : 'cap';
    return [focus, complementary, focus].flatMap(skill =>
      [id, chosen].map((country, i) => ({ id: country, direction: skill, opponent: i ? id : chosen })));
  }
  function panel(container, progress, { el, byId, labels, practicePair, comparePair }) {
    const data = summary(progress.learning);
    const section = el('section', { className: 'pgroup', attrs: { 'aria-labelledby': 'historyTitle' } });
    section.append(el('h3', { id: 'historyTitle', text: 'Histórico de estudo' }),
      el('p', { text: `${duration(data.ms)} de tempo ativo respondendo` }),
      el('p', { className: 'note', text: 'O tempo inclui somente perguntas respondidas, sem o tempo em outra aba. Cada visita inicia uma sessão. O histórico acompanha o backup e a conta opcional.' }));
    const trends = el('section', { attrs: { 'aria-labelledby': 'evolutionTitle' } });
    trends.append(el('h4', { id: 'evolutionTitle', text: 'Evolução entre sessões' }),
      el('p', { className: 'note', text: 'Acertos nas duas sessões mais recentes de cada habilidade, com pelo menos 5 respostas em cada. A dificuldade e os países podem variar; esta comparação não mede domínio. A sessão atual muda enquanto você joga. Sessões antigas sem acertos registrados não entram.' }));
    evolution(progress.learning).forEach(row => {
      const item = el('p', { className: 'learning-trend' });
      item.append(el('strong', { text: row.label + ': ' }));
      const percent = counts => `${Math.round(counts.correct / counts.answers * 100)}% (${counts.correct}/${counts.answers})`;
      item.append(el('span', { text: row.delta === null
        ? `Ainda faltam duas sessões com 5 respostas.${row.recent ? ` Mais recente: ${percent(row.recent)}.` : ''}`
        : `${percent(row.previous)} → ${percent(row.recent)} · ${Math.abs(row.delta) < .5 ? 'percentual estável' : `${row.delta > 0 ? '+' : '−'}${Math.abs(row.delta).toFixed(1).replace('.', ',')} pontos percentuais`}.` }));
      trends.append(item);
    });
    section.append(trends);
    const sessions = el('details');
    sessions.append(el('summary', { text: `Ver sessões recentes (${data.sessions.length})` }));
    const list = el('ul');
    let listed = false;
    sessions.addEventListener('toggle', () => {
      if (!sessions.open || listed) return;
      listed = true;
      data.sessions.forEach(row => list.append(el('li', { text: `${new Date(row.at).toLocaleString('pt-BR')} · ${row.answers} respostas · ${duration(row.ms)}` })));
    });
    sessions.append(list, el('p', { className: 'note', text: 'Até 200 sessões recentes. O tempo acumulado inclui as anteriores.' }));
    section.append(sessions);
    const details = el('details', { className: 'learning-confusions' });
    details.append(el('summary', { text: `Confusões recorrentes (${data.confusions.length})` }),
      el('p', { className: 'note', text: 'Agrupadas pelas últimas 1.000 escolhas incorretas identificáveis, da mais frequente à mais recente. Regiões e tempo esgotado não identificam outro país.' }));
    let expanded = false;
    details.addEventListener('toggle', () => {
      if (!details.open || expanded) return;
      expanded = true;
      data.confusions.forEach(row => {
        const item = el('p');
        const names = `${byId[row.id].n} e ${byId[row.chosen].n}`;
        item.append(el('strong', { text: `${byId[row.id].n} → ${byId[row.chosen].n} · ${row.count}×` }),
          el('span', { text: ` ${labels[row.direction]} · ${REASONS[row.reason]} · última: ${new Date(row.at).toLocaleDateString('pt-BR')}` }));
        const actions = el('span', { className: 'button-row' });
        const train = el('button', { className: 'chip', type: 'button', text: 'Treinar este par', attrs: { 'aria-label': `Treinar ${names}`, 'data-practice-pair': row.id + ':' + row.chosen } });
        train.addEventListener('click', () => practicePair(row.id, row.chosen, row.direction));
        const compare = el('button', { className: 'chip', type: 'button', text: 'Comparar os dois', attrs: { 'aria-label': `Comparar ${names}`, 'data-compare-pair': row.id + ':' + row.chosen } });
        compare.addEventListener('click', () => comparePair(row.id, row.chosen));
        actions.append(compare, train); item.append(actions);
        details.append(item);
      });
    });
    if (!data.confusions.length) details.append(el('p', { text: 'Nenhuma confusão registrada ainda.' }));
    section.append(details); container.append(section);
  }
  const api = { empty, clone, valid, merge, record, summary, duration, panel, pairPlan, evolution, REASONS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasLearning = api;
})(globalThis);

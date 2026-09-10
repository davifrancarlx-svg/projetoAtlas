(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasAchievementRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const catalog = [
    ['first', 'Já Posso Apontar no Globo', 'Primeiro acerto. O dedo já tem destino.', 'Bronze'],
    ['countries25', 'Só Mais Um País', 'Responda sobre 25 países diferentes. Só mais um, prometo.', 'Bronze'],
    ['countries195', 'Meu Sofá Deu a Volta ao Mundo', 'Responda sobre os 195 países. Milhas do sofá acumuladas.', 'Prata'],
    ['master1', 'Esse Já Mora na Minha Cabeça', 'Domine um país nas sete direções. Aluguel: zero.', 'Bronze'],
    ['master10', 'Condomínio na Memória', 'Domine dez países nas sete direções. A memória ganhou vizinhos.', 'Prata'],
    ['region', 'Autoridade Regional', 'Domine todos os países de uma região nas sete direções. Pode conferir.', 'Prata'],
    ['world', 'Rodei o Mundo Sem Sair de Casa', 'Nível máximo nos 195 países, nas sete direções. O sofá merece férias.', 'Platina'],
    ['flags', 'Varal de Respeito', 'Domine as duas direções de bandeiras nos 195 países. Haja espaço no varal.', 'Ouro'],
    ['capitals', 'Agenda de Endereços', 'Domine as duas direções de capitais nos 195 países. Agenda mental lotada.', 'Ouro'],
    ['maps', 'GPS de Cabeça', 'Domine as duas direções de localização nos 195 países. Recalculando? Hoje não.', 'Ouro'],
    ['regions', 'Cada Um no Seu Quadrado', 'Domine país → região nos 195 países. Tudo no lugar.', 'Ouro'],
    ['typed10', 'Sei de Cor e Salteado', 'Dez acertos seguidos digitando. Erro ou resposta por escolha interrompe a sequência.', 'Prata'],
    ['streak25', 'Hoje Meu Cérebro Veio', 'Alcance 25 acertos seguidos. Presença confirmada.', 'Prata'],
    ['last5', 'No Último Suspiro', 'Acerte com até cinco segundos restantes, antes de o tempo acabar. Ufa.', 'Bronze'],
    ['exam10', 'Dez de Dez, Sem Conversa', 'Conclua uma prova de dez perguntas sem erros. Pode contar de novo.', 'Prata'],
    ['exam30', 'Gabaritei Geografia', 'Conclua uma prova de 30 perguntas sem erros. A caneta imaginária agradece.', 'Ouro'],
    ['examDone', 'Fui Até os Créditos', 'Conclua uma prova de 30 perguntas. Fiquei até o fim.', 'Bronze'],
    ['review', 'Agora Vai Ficar', 'Consolide uma habilidade no baralho de erros com os dois acertos exigidos. Agora vai.', 'Bronze'],
    ['six', 'Essa Aqui Não Me Deixa em Paz', 'Responda à sexta aparição de uma habilidade no mesmo baralho. Nos encontramos de novo.', 'Bronze'],
    ['debt', 'Zerei a Dívida', 'Revise corretamente todas as habilidades vencidas no início do seu dia de treino. A lista respirou.', 'Ouro'],
    ['loupe', 'Achei Com Lupa', 'Acerte localização de Vaticano, Mônaco, Tuvalu, Nauru ou San Marino em 60×. Achei!', 'Bronze'],
    ['micro5', 'Minha Lupa Tem Quilometragem', 'Acerte localização dos cinco microestados destacados. A lupa trabalhou.', 'Prata'],
    ['theme', 'Indeciso Com Estilo', 'Troque de tema três vezes na mesma abertura do app. Agora ficou. Talvez.', 'Bronze'],
    ['backup', 'Backup é Vida', 'Exporte o progresso. Seu futuro eu agradeceu.', 'Bronze'],
    ['cloud', 'Meu Progresso Veio Junto', 'Receba da conta aprendizado que acrescente ao navegador. A memória veio na bagagem.', 'Prata'],
  ].map(([id, name, description, rarity]) => Object.freeze({ id, name, description, rarity }));
  const ids = catalog.map(item => item.id);
  const microIds = ['VA', 'MC', 'TV', 'NR', 'SM'];
  const directions = ['flag', 'flagOf', 'cap', 'capOf', 'locate', 'mapId', 'reg'];
  const union = (a, b) => [...new Set([...a, ...b])].sort();
  const boundary = (a, b) => a.generation - b.generation || (a.epoch > b.epoch ? 1 : a.epoch < b.epoch ? -1 : 0);
  function create(progress) {
    return { version: 1, generation: progress.generation || 0, epoch: progress.epoch || '', unlocked: [], micro: [], day: null };
  }
  function valid(value) {
    const strings = (list, allowed) => Array.isArray(list) && list.length <= allowed.length
      && new Set(list).size === list.length && list.every(id => allowed.includes(id));
    const skills = list => Array.isArray(list) && list.length <= 1365 && new Set(list).size === list.length
      && list.every(key => /^[A-Z]{2}:(flag|flagOf|cap|capOf|locate|mapId|reg)$/.test(key));
    return Boolean(value && value.version === 1 && Number.isSafeInteger(value.generation) && value.generation >= 0
      && typeof value.epoch === 'string' && value.epoch.length <= 100
      && Object.keys(value).every(k => ['version', 'generation', 'epoch', 'unlocked', 'micro', 'day'].includes(k))
      && strings(value.unlocked, ids) && strings(value.micro, microIds)
      && (value.day === null || (value.day && /^\d{4}-\d{2}-\d{2}$/.test(value.day.date)
        && Object.keys(value.day).every(k => ['date', 'due', 'cleared'].includes(k))
        && skills(value.day.due) && skills(value.day.cleared))));
  }
  function merge(a, b) {
    if (!valid(a) || !valid(b)) throw new TypeError('Conquistas inválidas');
    const order = boundary(a, b);
    if (order) return JSON.parse(JSON.stringify(order > 0 ? a : b));
    let day = a.day;
    if (!day || (b.day && b.day.date > day.date)) day = b.day;
    else if (b.day && day.date === b.day.date) day = {
      date: day.date, due: union(day.due, b.day.due), cleared: union(day.cleared, b.day.cleared),
    };
    return { ...a, unlocked: union(a.unlocked, b.unlocked), micro: union(a.micro, b.micro), day: day && JSON.parse(JSON.stringify(day)) };
  }
  function evaluate(saved, progress, countries, event = {}) {
    const blank = create(progress);
    let next = valid(saved) && boundary(saved, blank) === 0 ? merge(saved, blank) : blank;
    const before = new Set(next.unlocked);
    const unlock = (id, condition) => { if (condition) next.unlocked = union(next.unlocked, [id]); };
    const skill = (id, d) => progress.countries[id]?.skills[d];
    const all = (group, ds) => group.length > 0 && group.every(c => ds.every(d => skill(c.id, d)?.level === 5));
    const studied = countries.filter(c => directions.some(d => skill(c.id, d)?.attempts > 0));
    const mastered = countries.filter(c => all([c], directions));
    unlock('first', studied.some(c => directions.some(d => skill(c.id, d)?.correct > 0)));
    unlock('countries25', studied.length >= 25);
    unlock('countries195', studied.length === 195);
    unlock('master1', mastered.length >= 1);
    unlock('master10', mastered.length >= 10);
    unlock('region', [...new Set(countries.map(c => c.r))].some(r => all(countries.filter(c => c.r === r), directions)));
    unlock('world', countries.length === 195 && all(countries, directions));
    for (const [id, ds] of [['flags', ['flag', 'flagOf']], ['capitals', ['cap', 'capOf']], ['maps', ['locate', 'mapId']], ['regions', ['reg']]]) {
      unlock(id, countries.length === 195 && all(countries, ds));
    }
    unlock('streak25', progress.bestStreak >= 25);
    if (event.date && (!next.day || next.day.date !== event.date)) {
      next.day = { date: event.date, due: studied.flatMap(c => directions.filter(d => {
        const s = skill(c.id, d); return s?.attempts > 0 && s.nextReviewAt && Date.parse(s.nextReviewAt) <= event.now;
      }).map(d => `${c.id}:${d}`)), cleared: [] };
    }
    if (event.type === 'answer') {
      unlock('typed10', event.correct && event.typedStreak >= 10);
      unlock('last5', event.correct && event.remaining > 0 && event.remaining <= 5000);
      unlock('six', event.tries >= 6);
      unlock('review', event.consolidated === true);
      if (event.correct && event.direction === 'locate' && microIds.includes(event.id)) {
        next.micro = union(next.micro, [event.id]);
        unlock('loupe', event.zoom >= 60 - 1e-6);
      }
      if (event.correct && next.day && next.day.date === event.date) {
        const key = `${event.id}:${event.direction}`;
        if (next.day.due.includes(key)) next.day.cleared = union(next.day.cleared, [key]);
      }
    }
    unlock('micro5', next.micro.length === 5);
    unlock('debt', next.day?.due.length > 0 && next.day.due.every(key => next.day.cleared.includes(key)));
    unlock('exam10', event.type === 'exam' && event.total === 10 && event.correct === 10);
    unlock('exam30', event.type === 'exam' && event.total === 30 && event.correct === 30);
    unlock('examDone', event.type === 'exam' && event.total === 30);
    unlock('theme', event.type === 'theme' && event.count >= 3);
    unlock('backup', event.type === 'backup');
    unlock('cloud', event.type === 'cloud' && event.added === true);
    return { state: next, added: next.unlocked.filter(id => !before.has(id)) };
  }
  return Object.freeze({ catalog: Object.freeze(catalog), create, valid, merge, evaluate });
});

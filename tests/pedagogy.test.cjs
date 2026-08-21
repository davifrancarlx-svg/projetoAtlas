'use strict';

// O que este arquivo protege é a parte do app que decide *o que perguntar e
// quando* — a única que age sobre a memória de quem joga. Um erro aqui não
// quebra a tela: só faz o treino render menos, silenciosamente, o que é bem
// pior de perceber.

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');

const NOW = '2026-08-21T12:00:00.000Z';
const IDS = ['BR', 'PT', 'AR', 'CL', 'UY', 'FR', 'ES', 'IT'];
const COUNTRIES = [
  { id: 'BR', n: 'Brasil', cap: 'Brasília', r: 'América do Sul', sr: 'América do Sul', c: [0, 0], fs: ['AR'] },
  { id: 'AR', n: 'Argentina', cap: 'Buenos Aires', r: 'América do Sul', sr: 'América do Sul', c: [10, 10], fs: ['BR'] },
  { id: 'CL', n: 'Chile', cap: 'Santiago', r: 'América do Sul', sr: 'América do Sul', c: [20, 20], fs: [] },
  { id: 'UY', n: 'Uruguai', cap: 'Montevidéu', r: 'América do Sul', sr: 'América do Sul', c: [400, 400], fs: [] },
  { id: 'PT', n: 'Portugal', cap: 'Lisboa', r: 'Europa', sr: 'Europa', c: [900, 100], fs: [] },
  { id: 'ES', n: 'Espanha', cap: 'Madri', r: 'Europa', sr: 'Europa', c: [905, 105], fs: [] },
  { id: 'FR', n: 'França', cap: 'Paris', r: 'Europa', sr: 'Europa', c: [910, 90], fs: [] },
  { id: 'IT', n: 'Itália', cap: 'Roma', r: 'Europa', sr: 'Europa', c: [960, 140], fs: [] },
];
const base = () => Core.createProgress({ now: NOW, countryIds: IDS });
const at = (days) => new Date(Date.parse(NOW) + days * 86400000).toISOString();

// --- nota da resposta -------------------------------------------------------

test('a nota separa recuperação fluente de acerto trabalhoso', () => {
  const typed = (ms) => Core.gradeAnswer({ correct: true, ms, answerMode: 'type' });
  const picked = (ms) => Core.gradeAnswer({ correct: true, ms, answerMode: 'pick', optionCount: 4 });

  assert.equal(Core.gradeAnswer({ correct: false, ms: 900 }), 'again', 'Errar sempre vale "again".');
  assert.equal(typed(1200), 'easy', 'Digitar de cabeça e rápido é a evidência mais forte que existe.');
  assert.equal(picked(1200), 'good', 'Escolher rápido entre quatro ainda carrega chance cega.');
  assert.equal(picked(20000), 'hard', 'Escolher devagar entre quatro é reconstrução, não memória.');
  assert.equal(typed(20000), 'good', 'Digitar devagar continua sendo produção da resposta.');

  // Sem tempo medido nada regride: a nota cai em 'good', que reproduz o
  // agendamento que o app tinha antes de existir nota.
  assert.equal(Core.gradeAnswer({ correct: true, ms: null }), 'good');
  assert.equal(Core.gradeAnswer({ correct: true }), 'good');
});

test('o limiar de fluência não depende do cronômetro escolhido', () => {
  // Lembrar em 3 s é lembrar na hora, com ou sem teto de tempo: o tempo de
  // recuperação é propriedade da memória, não da configuração da sessão.
  const semLimite = Core.gradeAnswer({ correct: true, ms: 3000, answerMode: 'type' });
  const comLimite = Core.gradeAnswer({ correct: true, ms: 3000, answerMode: 'type', timeLimit: 15 });
  assert.equal(semLimite, 'easy');
  assert.equal(comLimite, 'easy');
});

test('a nota muda o tamanho do passo e do intervalo', () => {
  assert.deepEqual(Core.scheduleFor(2, 'again'), { level: 0, intervalDays: 0 });
  assert.deepEqual(Core.scheduleFor(2, 'hard'), { level: 2, intervalDays: Core.REVIEW_INTERVAL_DAYS[2] });
  assert.deepEqual(Core.scheduleFor(2, 'good'), { level: 3, intervalDays: Core.REVIEW_INTERVAL_DAYS[3] });

  const easy = Core.scheduleFor(2, 'easy');
  assert.equal(easy.level, 3);
  assert.ok(easy.intervalDays > Core.REVIEW_INTERVAL_DAYS[3], 'A resposta fácil precisa esticar o intervalo.');

  // O teto de nível continua valendo, e o intervalo nunca sai do domínio aceito
  // pela validação do progresso.
  assert.equal(Core.scheduleFor(Core.MAX_LEVEL, 'good').level, Core.MAX_LEVEL);
  assert.ok(Core.scheduleFor(Core.MAX_LEVEL, 'easy').intervalDays <= 3650);
});

test('sem nota, o agendamento é idêntico ao anterior', () => {
  const semNota = Core.recordAnswer(base(), 'BR', 'flag', true, { now: NOW, countryIds: IDS });
  const comGood = Core.recordAnswer(base(), 'BR', 'flag', true, { now: NOW, countryIds: IDS, grade: 'good' });
  assert.deepEqual(Core.skillOf(semNota, 'BR', 'flag'), Core.skillOf(comGood, 'BR', 'flag'));

  // Uma nota incoerente com o resultado é corrigida, não aceita: 'easy' num erro
  // promoveria uma habilidade que acabou de falhar.
  const incoerente = Core.recordAnswer(base(), 'BR', 'flag', false, { now: NOW, countryIds: IDS, grade: 'easy' });
  assert.equal(Core.skillOf(incoerente, 'BR', 'flag').level, 0);
  assert.equal(Core.skillOf(incoerente, 'BR', 'flag').streak, 0);
});

test('a nota "hard" segura o nível em vez de promover resposta hesitante', () => {
  let value = Core.recordAnswer(base(), 'BR', 'cap', true, { now: NOW, countryIds: IDS, grade: 'good' });
  assert.equal(Core.skillOf(value, 'BR', 'cap').level, 1);
  value = Core.recordAnswer(value, 'BR', 'cap', true, { now: at(1), countryIds: IDS, grade: 'hard' });
  const skill = Core.skillOf(value, 'BR', 'cap');
  assert.equal(skill.level, 1, 'Um acerto trabalhoso não deveria promover.');
  assert.equal(skill.correct, 2, 'Mas continua sendo um acerto no histórico.');
  assert.equal(skill.streak, 2);
});

// --- prioridade na fila -----------------------------------------------------

test('o que está vencido há muito tempo compete com o que nunca foi visto', () => {
  // BR sobe até o nível máximo e depois é abandonado por meses.
  let value = base();
  for (let index = 0; index < 5; index += 1) {
    value = Core.recordAnswer(value, 'BR', 'flag', true, { now: at(index), countryIds: IDS, grade: 'good' });
  }
  assert.equal(Core.skillOf(value, 'BR', 'flag').level, Core.MAX_LEVEL);

  const inedito = (quando) => Core.weightForItem({ id: 'PT' }, 'flag', value, { now: quando });
  const esquecido = (quando) => Core.weightForItem({ id: 'BR' }, 'flag', value, { now: quando });

  // Em dia, o dominado cede lugar ao inédito — isso é correto e continua igual.
  assert.ok(esquecido(at(5)) < inedito(at(5)), 'Habilidade fresca não deveria disputar com país inédito.');

  // Vencido de pouco, já sobe. Vencido há muito, alcança o inédito: deixar
  // escapar o que custou cinco acertos é pior do que atrasar uma estreia.
  assert.ok(esquecido(at(40)) > esquecido(at(5)), 'O vencimento precisa aumentar a prioridade.');
  assert.ok(esquecido(at(400)) > esquecido(at(40)), 'Quanto mais atrasado, mais urgente.');
  assert.ok(
    esquecido(at(400)) >= inedito(at(400)),
    'Um nível máximo esquecido há mais de um ano ainda perdia para um país nunca visto.'
  );
});

test('a habilidade que sempre falha recebe mais espaço que a estável', () => {
  let teimosa = base();
  let estavel = base();
  // Mesma quantidade de tentativas, taxas de acerto opostas.
  for (let index = 0; index < 6; index += 1) {
    teimosa = Core.recordAnswer(teimosa, 'AR', 'cap', index % 3 === 0, { now: at(index), countryIds: IDS });
    estavel = Core.recordAnswer(estavel, 'AR', 'cap', true, { now: at(index), countryIds: IDS });
  }
  const comFalhas = Core.skillOf(teimosa, 'AR', 'cap');
  const semFalhas = Core.skillOf(estavel, 'AR', 'cap');
  assert.ok(Core.struggleFactor(comFalhas) > 1, 'Acerto baixo precisa pesar mais.');
  assert.equal(Core.struggleFactor(semFalhas), 1, 'Quem vai bem não deveria ganhar reforço.');

  // Poucas tentativas não bastam para rotular alguém de difícil.
  const cedoDemais = Core.recordAnswer(base(), 'CL', 'cap', false, { now: NOW, countryIds: IDS });
  assert.equal(Core.struggleFactor(Core.skillOf(cedoDemais, 'CL', 'cap')), 1);
});

// --- direção da pergunta ----------------------------------------------------

test('a direção segue a fraqueza sem apagar as demais', () => {
  // Bandeiras dominadas em todo o pool, capitais intocadas.
  let value = base();
  COUNTRIES.forEach((country) => {
    for (let index = 0; index < 5; index += 1) {
      value = Core.recordAnswer(value, country.id, 'flag', true, { now: at(index), countryIds: IDS, grade: 'good' });
    }
  });

  const contagem = { flag: 0, cap: 0 };
  const total = 4000;
  for (let index = 0; index < total; index += 1) {
    const rng = () => (index + 0.5) / total;
    contagem[Core.pickDirection(['flag', 'cap'], COUNTRIES, value, { rng, now: at(1) })] += 1;
  }
  assert.ok(contagem.cap > contagem.flag, 'A direção fraca precisa aparecer mais.');
  // O piso é deliberado: intercalar é o que faz a memória durar, então a
  // direção dominada não pode sumir do treino.
  assert.ok(contagem.flag / total > 0.25, `A direção dominada quase sumiu (${contagem.flag}/${total}).`);

  // Uma direção só continua sendo escolha trivial, sem consultar o progresso.
  assert.equal(Core.pickDirection(['reg'], COUNTRIES, value, { rng: () => 0.5 }), 'reg');
});

test('a pergunta continua determinística e respeita a direção forçada', () => {
  const feita = Core.createQuestion({
    countries: COUNTRIES, progress: base(), directions: ['cap'],
    region: 'Mundo inteiro', answerMode: 'pick', rng: () => 0.42, now: NOW,
  });
  assert.equal(feita.question.direction, 'cap');
  assert.equal(feita.question.opts.length, 4);
  assert.ok(feita.question.opts.includes(feita.question.id));
});

// --- revisão focada ---------------------------------------------------------

test('os erros da sessão são ordenados por gravidade, não por ordem de acontecimento', () => {
  const answers = [
    { id: 'BR', direction: 'cap', correct: false },
    { id: 'AR', direction: 'flag', correct: false },
    { id: 'AR', direction: 'flag', correct: false },
    { id: 'AR', direction: 'flag', correct: false },
    { id: 'CL', direction: 'cap', correct: false },
    { id: 'CL', direction: 'cap', correct: true },
    { id: 'PT', direction: 'cap', correct: true },
  ];
  const ranked = Core.rankMistakes(answers);

  assert.deepEqual(ranked.map((card) => card.id), ['AR', 'BR', 'CL']);
  assert.equal(ranked[0].misses, 3, 'O erro repetido precisa liderar.');
  assert.equal(ranked[2].recovered, true, 'O que foi retomado na sessão vai para o fim.');
  assert.ok(!ranked.some((card) => card.id === 'PT'), 'Quem só acertou não entra na revisão.');
});

test('acertar de primeira não conta como recuperação', () => {
  const ranked = Core.rankMistakes([
    { id: 'BR', direction: 'cap', correct: true },
    { id: 'BR', direction: 'cap', correct: false },
  ]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].recovered, false, 'Acertar antes de errar não apaga o erro que veio depois.');
});

test('o nível atual desempata erros de mesma gravidade', () => {
  let value = base();
  for (let index = 0; index < 3; index += 1) {
    value = Core.recordAnswer(value, 'PT', 'cap', true, { now: at(index), countryIds: IDS, grade: 'good' });
  }
  const answers = [
    { id: 'PT', direction: 'cap', correct: false },
    { id: 'ES', direction: 'cap', correct: false },
  ];
  const ranked = Core.rankMistakes(answers, { progress: value });
  assert.equal(ranked[0].id, 'ES', 'Entre dois erros iguais, o mais frágil vem primeiro.');
});

// --- contraste didático -----------------------------------------------------

test('o erro é explicado pela relação real entre as duas respostas', () => {
  const byId = Object.fromEntries(COUNTRIES.map((country) => [country.id, country]));
  assert.equal(Core.confusionReason(byId.BR, byId.AR, 'flag'), 'flag-similar');
  assert.equal(Core.confusionReason(byId.BR, byId.AR, 'locate'), 'neighbour');
  assert.equal(Core.confusionReason(byId.BR, byId.UY, 'locate'), 'same-subregion');
  assert.equal(Core.confusionReason(byId.BR, byId.PT, 'locate'), null, 'Longe e sem nada em comum não é confusão explicável.');
  assert.equal(Core.confusionReason(byId.BR, byId.BR, 'flag'), null, 'Sem confusão quando a resposta está certa.');
  assert.equal(Core.confusionReason(null, byId.BR, 'flag'), null);
});

test('capitais parecidas e capitais de mesma inicial são distinguidas', () => {
  const kingston = { id: 'JM', n: 'Jamaica', cap: 'Kingston', r: 'Caribe', sr: 'Caribe', c: [0, 0] };
  const kingstown = { id: 'VC', n: 'São Vicente', cap: 'Kingstown', r: 'Caribe', sr: 'Caribe', c: [300, 300] };
  const madri = { id: 'ES', n: 'Espanha', cap: 'Madri', r: 'Europa', sr: 'Europa', c: [900, 100] };
  const montevideu = { id: 'UY', n: 'Uruguai', cap: 'Montevidéu', r: 'América do Sul', sr: 'América do Sul', c: [400, 400] };

  // O par que o app inteiro tem cuidado de não confundir na validação é
  // exatamente o que mais merece explicação quando o erro acontece.
  assert.equal(Core.confusionReason(kingston, kingstown, 'cap'), 'capital-similar');
  assert.equal(Core.confusionReason(madri, montevideu, 'cap'), 'capital-initial');

  // Nomes só vagamente parecidos não podem virar "escrita muito parecida": o
  // app estaria inventando uma confusão que ninguém comete.
  const monaco = { id: 'MC', n: 'Mônaco', cap: 'Mônaco', r: 'Europa', sr: 'Europa', c: [900, 100] };
  const guine = { id: 'GN', n: 'Guiné', cap: 'Conacri', r: 'África', sr: 'África', c: [700, 400] };
  assert.notEqual(Core.confusionReason(guine, monaco, 'cap'), 'capital-similar');
});

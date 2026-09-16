'use strict';
// A revisão focada agora sobrevive ao fechamento da aba. O que este cenário
// protege é o ciclo: a fila, o placar e os dois acertos exigidos por
// habilidade precisam voltar como estavam, não recomeçar do zero.
const assert = require('node:assert/strict');

module.exports = async (client, evaluate, until) => {
  const ev = (code) => evaluate(client, code);
  const rascunho = async () => JSON.parse(await ev("localStorage.getItem('atlas195:serie:v1')") || 'null');

  // Recarregar zera as respostas da sessão, que vivem só na memória da página:
  // sem isso o baralho herdaria os erros dos cenários anteriores e o teste
  // dependeria da ordem em que eles rodaram.
  await ev("localStorage.removeItem('atlas195:serie:v1')");
  await client.send('Page.reload');
  await until('app reiniciado', () => ev(
    "Boolean(document.getElementById('questionTitle')) && !document.getElementById('appShell').classList.contains('is-initializing')"));
  // Regiões é o modo que sempre responde por alternativa: sem ele o cenário
  // dependeria de sorte para não cair numa pergunta de mapa.
  await ev("document.querySelector('[data-view=quiz]').click();document.querySelector('[data-mode=reg]').click()");
  for (let i = 0; i < 3; i += 1) {
    await until('pergunta de região', () => ev("Boolean(document.querySelector('[data-answer]:not(:disabled)'))"));
    await ev(`(() => {
      const titulo = document.getElementById('questionTitle').textContent;
      const pais = DATA.find(c => titulo.includes(c.n + '?'));
      [...document.querySelectorAll('[data-answer]')].find(b => b.dataset.answer !== pais.r).click();
      document.getElementById('nextQuestion').click();
    })()`);
  }
  // Sem série aberta e sem baralho, não há rascunho a guardar.
  assert.equal(await rascunho(), null, 'O treino livre não deixa rascunho.');

  await ev("document.querySelector('.session-finish').click()");
  await until('fechamento da sessão', () => ev("/de precisão/.test(document.getElementById('panel').textContent)"));
  await ev("[...document.querySelectorAll('button')].find(b => /^Revisar /.test(b.textContent)).click()");
  await until('revisão focada', () => ev("/Revisão focada/.test(document.getElementById('panel').textContent)"));

  const aberto = await rascunho();
  assert.equal(aberto.kind, 'review', 'A revisão precisa ser guardada como rascunho.');
  assert.equal(aberto.v, 2);
  assert.equal(aberto.deck.length, 3, 'As três habilidades erradas entram no baralho.');
  assert.ok(aberto.deck.every((card) => card.remaining === 2 && card.tries === 0),
    'Cada carta começa precisando de dois acertos.');
  assert.ok(aberto.answers.length >= 3, 'As respostas da sessão acompanham o rascunho.');

  // Uma resposta certa consome um dos dois acertos e a carta volta para a fila.
  await ev(`(() => {
    const titulo = document.getElementById('questionTitle').textContent;
    const pais = DATA.find(c => titulo.includes(c.n + '?'));
    [...document.querySelectorAll('[data-answer]')].find(b => b.dataset.answer === pais.r).click();
  })()`);
  await until('veredito da revisão', () => ev("Boolean(document.querySelector('.verdict'))"));
  const parcial = await rascunho();
  assert.equal(parcial.kind, 'review');
  assert.equal(parcial.deck.length, 3, 'A carta acertada uma vez continua no baralho.');
  assert.equal(parcial.deck.filter((card) => card.remaining === 1).length, 1,
    'Um acerto reduz a exigência daquela carta para um.');

  // Fechar e reabrir: é aqui que antes se perdia tudo.
  await client.send('Page.reload');
  await until('oferta de retomar', () => ev("Boolean(document.getElementById('resumeExam'))"));
  const oferta = JSON.parse(await ev(`JSON.stringify({
    plate: document.querySelector('.plate').textContent,
    titulo: document.getElementById('questionTitle').textContent,
    copy: document.querySelector('.section-copy').textContent
  })`));
  assert.match(oferta.plate, /Revisão interrompida/);
  assert.match(oferta.plate, /3 habilidades/);
  assert.match(oferta.titulo, /revisão pela metade/);
  assert.match(oferta.copy, /dois acertos/);

  await ev("document.getElementById('resumeExam').click()");
  await until('revisão retomada', () => ev("/Revisão focada/.test(document.getElementById('panel').textContent)"));
  const retomado = JSON.parse(await ev(`JSON.stringify({
    plate: document.querySelector('.plate').textContent,
    rascunho: JSON.parse(localStorage.getItem('atlas195:serie:v1') || 'null')
  })`));
  assert.match(retomado.plate, /Revisão focada · faltam 3/, 'A fila volta com as três habilidades.');
  assert.equal(retomado.rascunho.deck.filter((card) => card.remaining === 1).length, 1,
    'O ciclo de cada carta sobrevive ao recarregamento.');

  // Descartar apaga o rascunho e devolve o treino livre.
  await client.send('Page.reload');
  await until('oferta de novo', () => ev("Boolean(document.getElementById('resumeExam'))"));
  await ev("[...document.querySelectorAll('button')].find(b => b.textContent === 'Descartar').click()");
  await until('treino livre', () => ev("Boolean(document.querySelector('[data-answer]')) && !/Revisão focada|interrompida/.test(document.getElementById('panel').textContent)"));
  assert.equal(await rascunho(), null, 'Descartar precisa apagar o rascunho.');
};

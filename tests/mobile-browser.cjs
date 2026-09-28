'use strict';
// No celular o painel da pergunta e o mapa ficam empilhados, e a ordem decide o
// que cabe na primeira tela. O mapa só sobe quando ele é a própria pergunta:
// apontar nele ou ler o pin. Numa pergunta de bandeira ele não ajuda a
// responder, e em cima empurrava todas as alternativas para baixo da dobra.
// Na grade de bandeiras e de silhuetas a comparação é o próprio exercício, então
// as quatro precisam caber juntas: duas colunas também no celular.
//
// De quebra, a placa já diz a direção ("capital → país"); a linha de instrução
// logo abaixo só aparece quando acrescenta algo, nunca repetindo a placa.
const assert = require('node:assert/strict');

module.exports = async (client, evaluate, until) => {
  const ev = (code) => evaluate(client, code);
  const leitura = async () => JSON.parse(await ev(`(() => {
    scrollTo(0, 0);
    const topo = (el) => Math.round(el.getBoundingClientRect().top);
    const opcao = document.querySelector('[data-answer]');
    return JSON.stringify({
      rotulo: document.querySelector('.plate span:last-child')?.textContent || '',
      instrucao: document.querySelector('#panel .prompt')?.textContent || '',
      titulo: document.getElementById('questionTitle')?.textContent || '',
      picking: document.getElementById('map').classList.contains('picking'),
      pin: Boolean(document.querySelector('.reticle')),
      painel: topo(document.querySelector('.side')),
      mapa: topo(document.getElementById('mapRegion')),
      opcaoFim: opcao ? Math.round(opcao.getBoundingClientRect().bottom) : null,
      ultimaFim: Math.round([...document.querySelectorAll('[data-answer]')].pop()?.getBoundingClientRect().bottom || 0),
      dobra: Math.min(innerHeight, topo(document.getElementById('scorebar'))),
    });
  })()`));
  const semRepeticao = (q) => {
    if (q.instrucao) assert.notEqual(q.instrucao.toLowerCase(), q.rotulo.toLowerCase(),
      `A instrução repete a placa em "${q.titulo}".`);
  };
  const painelPrimeiro = (q) => {
    assert.ok(q.painel < q.mapa, `"${q.titulo}" não usa o mapa, que não pode vir antes do painel.`);
    assert.ok(q.opcaoFim !== null && q.opcaoFim <= q.dobra,
      `A primeira alternativa de "${q.titulo}" termina em ${q.opcaoFim}px, abaixo da dobra (${q.dobra}px).`);
    if (['país → bandeira', 'país → silhueta'].includes(q.rotulo)) assert.ok(q.ultimaFim <= q.dobra,
      `A grade de "${q.titulo}" termina em ${q.ultimaFim}px, abaixo da dobra (${q.dobra}px).`);
  };
  const mapaPrimeiro = (q) => assert.ok(q.mapa < q.painel, `"${q.titulo}" se responde pelo mapa, que precisa vir antes.`);
  const pular = () => ev("document.getElementById('skipVisualBtn').click()");
  const pergunta = () => until('pergunta', () => ev("Boolean(document.getElementById('questionTitle'))"));

  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  try {
    await ev("document.querySelector('[data-view=quiz]').click();document.querySelector('[data-mode=flag]').click()");
    const bandeiras = new Set();
    for (let volta = 0; volta < 40 && bandeiras.size < 2; volta += 1) {
      await pergunta();
      const q = await leitura();
      semRepeticao(q);
      painelPrimeiro(q);
      bandeiras.add(q.rotulo);
      await pular();
    }
    assert.deepEqual([...bandeiras].sort(), ['bandeira → país', 'país → bandeira']);

    await ev("document.querySelector('[data-mode=loc]').click()");
    const locais = new Set();
    for (let volta = 0; volta < 90 && locais.size < 5; volta += 1) {
      await pergunta();
      const q = await leitura();
      semRepeticao(q);
      if (q.picking) { mapaPrimeiro(q); locais.add('apontar'); }
      else if (q.rotulo === 'mapa → país') { assert.equal(q.pin, true); mapaPrimeiro(q); locais.add('pin'); }
      else { painelPrimeiro(q); locais.add(q.rotulo); }
      await pular();
    }
    assert.deepEqual([...locais].sort(),
      ['apontar', 'país → fronteira', 'país → silhueta', 'pin', 'silhueta → país'],
      'As cinco formas de localização precisam aparecer em 90 sorteios.');

    // Nauru não tem capital oficial: a placa diz "sede do governo", e a linha
    // de baixo, que antes repetia isso, some junto com as outras repetições.
    await ev(`(() => {
      document.querySelector('[data-view=atlas]').click();
      const search = document.querySelector('input[type=search]');
      search.value = 'Nauru'; search.dispatchEvent(new Event('input'));
    })()`);
    // A busca espera o usuário parar de digitar antes de refazer a lista.
    await until('Nauru na lista', () => ev("Boolean(document.querySelector('[data-country=NR]'))"));
    await ev(`(() => {
      document.querySelector('[data-country=NR]').click();
      [...document.querySelectorAll('button')].find(b => b.textContent === 'Praticar Nauru').click();
    })()`);
    const rotulos = [];
    const fechou = () => ev("[...document.querySelectorAll('button')].some(b => b.textContent === 'Voltar ao treino livre')");
    // Pular a pergunta de apontar encurta a série; por isso o laço para no
    // fechamento, não num número fixo de voltas.
    for (let volta = 0; volta < 10 && !(await fechou()); volta += 1) {
      await pergunta();
      const q = await leitura();
      semRepeticao(q);
      rotulos.push(q.rotulo);
      if (q.picking) { await pular(); continue; }
      await ev("document.querySelector('[data-answer]').click()");
      await until('veredito', () => ev("Boolean(document.getElementById('nextQuestion'))"));
      await ev("document.getElementById('nextQuestion').click()");
    }
    assert.ok(rotulos.includes('país → sede do governo'), rotulos.join(', '));
    assert.ok(rotulos.includes('sede do governo → país'), rotulos.join(', '));
    await until('fechamento da prática', fechou);
    await ev("[...document.querySelectorAll('button')].find(b => b.textContent === 'Voltar ao treino livre').click()");
  } finally {
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  }
};

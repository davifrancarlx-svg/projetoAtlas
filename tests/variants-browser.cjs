'use strict';
// As duas variantes novas de "país → mapa" só existem na tela: o núcleo diz
// qual sortear, mas quem prova que a silhueta aparece, que a fronteira tem uma
// resposta certa e que o mapa deixa de ser clicável é o navegador de verdade.
const assert = require('node:assert/strict');

module.exports = async (client, evaluate, until) => {
  const ev = (code) => evaluate(client, code);
  const estado = async () => JSON.parse(await ev(`JSON.stringify({
    titulo: document.getElementById('questionTitle')?.textContent || '',
    rotulo: document.querySelector('.plate span:last-child')?.textContent || '',
    opcoes: document.querySelectorAll('[data-answer]').length,
    silhuetas: document.querySelectorAll('.opt.shapeopt .shape-svg').length,
    picking: document.getElementById('map').classList.contains('picking'),
    pin: Boolean(document.querySelector('.reticle')),
    podePular: !document.getElementById('skipVisualBtn').hidden
  })`));

  await ev("document.querySelector('[data-view=quiz]').click();document.querySelector('[data-mode=loc]').click()");
  const vistas = {};
  for (let volta = 0; volta < 90 && (!vistas.shape || !vistas.border); volta += 1) {
    await until('pergunta de localização', () => ev("Boolean(document.getElementById('questionTitle'))"));
    const antes = await estado();
    const silhueta = antes.silhuetas > 0;
    const fronteira = /faz fronteira com/.test(antes.titulo);
    if (!silhueta && !fronteira) {
      // Variante de mapa ou "mapa → país": pular não altera o progresso.
      assert.equal(antes.podePular, true, 'Toda pergunta visual precisa poder ser pulada.');
      await ev("document.getElementById('skipVisualBtn').click()");
      continue;
    }

    assert.equal(antes.opcoes, 4, 'As duas variantes respondem por alternativa.');
    assert.equal(antes.picking, false, 'Com alternativas na tela, o mapa deixa de receber a resposta.');
    if (silhueta) {
      assert.match(antes.titulo, /^Qual destas formas é .+\?$/);
      assert.equal(antes.rotulo, 'país → silhueta');
      assert.equal(antes.silhuetas, 4, 'São quatro contornos, um por alternativa.');
      assert.equal(antes.pin, false, 'O pin no mapa entregaria a resposta.');
      // O contorno precisa ter área de verdade, não um traço degenerado.
      const caixa = JSON.parse(await ev(`(() => {
        const r = document.querySelector('.opt.shapeopt .shape-svg').getBoundingClientRect();
        return JSON.stringify({ w: r.width, h: r.height });
      })()`));
      assert.ok(caixa.w > 40 && caixa.h > 30, `Silhueta pequena demais: ${caixa.w}×${caixa.h}.`);
    } else {
      assert.match(antes.titulo, /^Qual destes faz fronteira com .+\?$/);
      assert.equal(antes.rotulo, 'país → fronteira');
      assert.equal(antes.silhuetas, 0);
    }

    await ev(`(() => {
      const title=document.getElementById('questionTitle').textContent;
      const target=DATA.find(c=>title.endsWith(c.n+'?'));
      const border=/faz fronteira/.test(title);
      [...document.querySelectorAll('[data-answer]')].find(b=>border?!target.nb.includes(b.dataset.answer):b.dataset.answer!==target.id).click();
    })()`);
    await until('veredito', () => ev("Boolean(document.querySelector('.verdict'))"));
    const depois = JSON.parse(await ev(`JSON.stringify({
      certas: document.querySelectorAll('.opt.right').length,
      erradas: document.querySelectorAll('.opt.wrong').length,
      veredito: document.querySelector('.verdict').textContent,
      marcados: document.querySelectorAll('.cty.ok').length,
      pin: Boolean(document.querySelector('.reticle'))
    })`));
    assert.equal(depois.certas, 1, 'Exatamente uma alternativa fica marcada como certa.');
    assert.ok(depois.erradas <= 1);
    assert.equal(depois.pin, true, 'Depois de responder, o país da pergunta ganha o pin.');
    assert.ok(depois.marcados >= 1, 'A resposta certa precisa aparecer no mapa.');
    if (depois.erradas) {
      assert.equal(await ev("document.querySelectorAll('.comparison-card').length"), 2);
      if (silhueta) assert.equal(await ev("document.querySelectorAll('.comparison-card .shape-svg').length"), 2);
    }
    if (fronteira) {
      assert.ok(await ev("document.querySelectorAll('.cty.neighbor').length > 0"));
      assert.ok(await ev("Boolean(document.querySelector('.border-legend'))"));
      assert.match(depois.veredito, /faz fronteira com|não faz fronteira com nenhum/,
        'O veredito da fronteira precisa listar os vizinhos.');
    }
    vistas[silhueta ? 'shape' : 'border'] = true;
    await ev("document.getElementById('nextQuestion').click()");
    assert.equal(await ev("document.querySelectorAll('.cty.neighbor').length"), 0, 'O destaque dos vizinhos não pode revelar a pergunta seguinte.');
  }

  assert.ok(vistas.shape, 'A variante de silhueta nunca apareceu em 90 sorteios.');
  assert.ok(vistas.border, 'A variante de fronteira nunca apareceu em 90 sorteios.');

  // A ficha do Atlas carrega a moeda e o filtro por área responde ao clique.
  await ev("document.querySelector('[data-view=atlas]').click()");
  await until('ficha do Atlas', () => ev("Boolean(document.querySelector('.atlas-detail .moedas'))"));
  const ficha = JSON.parse(await ev(`JSON.stringify({
    moeda: document.querySelector('.atlas-detail .moedas').textContent,
    areas: document.querySelectorAll('.atlas-area').length,
    resultados: document.querySelector('.count').textContent
  })`));
  assert.match(ficha.moeda, /^Moedas?: .+ \([A-Z]{3}\)/, `Moeda fora do formato: ${ficha.moeda}`);
  assert.equal(ficha.areas, 7, 'Todos mais os seis baldes amplos.');
  assert.match(ficha.resultados, /^195 resultados$/);

  const filtrado = JSON.parse(await ev(`(() => {
    [...document.querySelectorAll('.atlas-area')].find(b => b.dataset.area === 'Europa').click();
    return JSON.stringify({
      resultados: document.querySelector('.count').textContent,
      areas: document.querySelectorAll('.atlas-area').length,
      subs: [...document.querySelectorAll('.atlas-area.is-sub')].map(b => b.dataset.area),
      ativo: document.querySelector('.atlas-area.is-active')?.dataset.area,
      linhas: document.querySelectorAll('[data-country]').length
    });
  })()`));
  assert.equal(filtrado.ativo, 'Europa');
  // 44, não 45: o Chipre está na Ásia Ocidental pelo M49, a mesma decisão
  // editorial que já valia antes das subregiões existirem.
  assert.match(filtrado.resultados, /^44 resultados em Europa$/);
  assert.equal(filtrado.subs.length, 4, 'As subregiões da Europa abrem sob o balde escolhido.');
  assert.equal(filtrado.linhas, 44);

  const sub = JSON.parse(await ev(`(() => {
    [...document.querySelectorAll('.atlas-area')].find(b => b.dataset.area === 'Europa Ocidental').click();
    return JSON.stringify({
      resultados: document.querySelector('.count').textContent,
      ativo: document.querySelector('.atlas-area.is-active')?.dataset.area,
      subsVisiveis: document.querySelectorAll('.atlas-area.is-sub').length
    });
  })()`));
  assert.equal(sub.ativo, 'Europa Ocidental');
  assert.match(sub.resultados, /^9 resultados em Europa Ocidental$/);
  assert.equal(sub.subsVisiveis, 4, 'O balde continua aberto para a volta ser um clique.');

  // Clicar de novo no filtro ativo devolve o mundo inteiro.
  const limpo = await ev(`(() => {
    document.querySelector('.atlas-area.is-active').click();
    return document.querySelector('.count').textContent;
  })()`);
  assert.equal(limpo, '195 resultados');
  await ev("document.querySelector('[data-view=quiz]').click()");
};

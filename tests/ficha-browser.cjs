'use strict';
// A ficha do Atlas é onde se estuda: ela precisa trazer o que o veredito do
// erro já sabia sobre capitais, os outros nomes do país e levar de um país ao
// vizinho, ao idioma e à moeda com um clique. O filtro que nasce na ficha
// compara o valor exato: "turco" não pode achar o Turcomenistão, nem "EUR" a
// Europa inteira.
const assert = require('node:assert/strict');

module.exports = async (client, evaluate, until) => {
  const ev = (code) => evaluate(client, code);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await ev("document.querySelector('[data-view=atlas]').click()");
  await until('Atlas aberto', () => ev("Boolean(document.querySelector('.atlas-detail h3'))"));

  const abrir = async (id) => {
    await ev(`(() => {
      const search = document.querySelector('input[type=search]');
      search.value = DATA.find(c => c.id === '${id}').n; search.dispatchEvent(new Event('input'));
    })()`);
    await until(`${id} na lista`, () => ev(`Boolean(document.querySelector('[data-country=${id}]'))`));
    await ev(`document.querySelector('[data-country=${id}]').click()`);
  };
  const ficha = async () => JSON.parse(await ev(`JSON.stringify({
    nome: document.querySelector('.atlas-detail h3').textContent,
    linhas: [...document.querySelectorAll('.atlas-detail-copy p')].map(p => p.textContent),
    notas: [...document.querySelectorAll('.atlas-detail-copy .note')].map(p => p.textContent),
    vizinhos: [...document.querySelectorAll('.atlas-detail .fronteiras .ficha-link')].map(b => b.textContent),
  })`));
  const buscar = (texto) => ev(`(() => {
    const search = document.querySelector('input[type=search]');
    search.value = ${JSON.stringify(texto)}; search.dispatchEvent(new Event('input'));
  })()`);

  // As notas da capital, que antes só apareciam depois de errar.
  await abrir('ZA');
  const africa = await ficha();
  assert.ok(africa.notas.includes('Também é capital oficial: Cidade do Cabo, Bloemfontein.'), africa.notas.join(' | '));
  assert.ok(africa.notas.some((nota) => /Bloemfontein a judicial/.test(nota)));
  await abrir('CI');
  assert.ok((await ficha()).notas.includes('Outra sede de governo: Abidjan.'), 'A grafia de busca "Abidja" não pode aparecer na ficha.');

  // Outros nomes e nome anterior, escritos para leitura, sem os erros comuns.
  await abrir('SZ');
  const essuatini = await ficha();
  assert.ok(essuatini.linhas.includes('Outro nome: Eswatini'), essuatini.linhas.join(' | '));
  assert.ok(essuatini.linhas.includes('Nome anterior: Suazilândia (até 2018)'));
  await abrir('CZ');
  assert.ok((await ficha()).linhas.includes('Outros nomes: República Tcheca e Chéquia'));
  await abrir('GB');
  const reino = await ficha();
  assert.ok(!reino.linhas.some((linha) => /Inglaterra|Grã-Bretanha/.test(linha)), 'Erro comum não é outro nome.');
  assert.ok(!reino.linhas.some((linha) => linha.startsWith('Outro')), 'O Reino Unido não tem outro nome editorial.');
  // O nome antigo também acha o país na busca.
  await buscar('alto volta');
  await until('Burkina Faso pelo nome antigo', () => ev("document.querySelectorAll('[data-country]').length === 1 && Boolean(document.querySelector('[data-country=BF]'))"));

  // Do Brasil ao vizinho: a ficha troca e o foco vai para o nome novo.
  await abrir('BR');
  const brasil = await ficha();
  assert.equal(brasil.vizinhos.length, 10);
  assert.match(brasil.linhas.find((linha) => linha.startsWith('Fronteiras')), /^Fronteiras terrestres \(10\): Argentina, .+ e Venezuela$/);
  await ev("[...document.querySelectorAll('.atlas-detail .fronteiras .ficha-link')].find(b => b.textContent === 'Paraguai').click()");
  const paraguai = await ficha();
  assert.equal(paraguai.nome, 'Paraguai');
  assert.equal(await ev('document.activeElement.textContent'), 'Paraguai', 'O foco precisa ir para o nome do país novo.');
  assert.equal(await ev("document.querySelector('.reticle') !== null"), true, 'O mapa marca o vizinho.');

  // Idioma: a lista mostra quem o tem como oficial, e só eles.
  await abrir('TR');
  await ev("[...document.querySelectorAll('.atlas-detail .idiomas .ficha-link')].find(b => b.textContent === 'turco').click()");
  const turco = JSON.parse(await ev(`JSON.stringify({
    contagem: document.querySelector('.count').textContent,
    linhas: [...document.querySelectorAll('[data-country]')].map(b => b.dataset.country).sort(),
    busca: document.querySelector('input[type=search]').value,
    limpar: !document.querySelector('.atlas-facet').hidden,
    foco: document.activeElement.classList.contains('count'),
  })`));
  const falamTurco = JSON.parse(await ev("JSON.stringify(DATA.filter(c => c.idiomas.includes('turco')).map(c => c.id).sort())"));
  assert.deepEqual(turco.linhas, falamTurco);
  assert.ok(!turco.linhas.includes('TM'), 'Turcomenistão não fala turco por decreto.');
  assert.equal(turco.contagem, `${falamTurco.length} ${falamTurco.length === 1 ? 'resultado' : 'resultados'} com turco como idioma listado na ficha`);
  assert.equal(turco.busca, '', 'O filtro da ficha começa do mundo inteiro.');
  assert.equal(turco.limpar, true);
  assert.equal(turco.foco, true, 'O foco vai para a contagem, que leva a lista para a vista.');
  // A busca continua valendo dentro do filtro, como vale dentro de uma área.
  await buscar('França');
  await until('busca dentro do filtro', () => ev("document.querySelector('.count').textContent.startsWith('0 resultados com turco')"));
  await ev("document.querySelector('.atlas-facet').click()");
  assert.equal(await ev("document.querySelector('.count').textContent"), '1 resultado');

  // Moeda: pelo código, não pelo texto — "EUR" acharia a Europa inteira.
  await abrir('FR');
  await ev("document.querySelector('.atlas-detail .moedas .ficha-link').click()");
  const euro = JSON.parse(await ev(`JSON.stringify({
    contagem: document.querySelector('.count').textContent,
    linhas: document.querySelectorAll('[data-country]').length,
  })`));
  const usamEuro = await ev("DATA.filter(c => c.moedas.some(m => m.codigo === 'EUR')).length");
  assert.equal(euro.linhas, usamEuro);
  assert.equal(euro.contagem, `${usamEuro} resultados com euro (EUR) como moeda`);
  // A área combina com o filtro da ficha.
  await ev("[...document.querySelectorAll('.atlas-area')].find(b => b.dataset.area === 'África').click()");
  assert.equal(await ev("document.querySelector('.count').textContent"), '0 resultados em África com euro (EUR) como moeda');
  assert.match(await ev("document.querySelector('.list .empty').textContent"), /Limpe o filtro/);
  await ev("document.querySelector('.atlas-area.is-active').click()");
  await ev("document.querySelector('.atlas-facet').click()");
  assert.equal(await ev("document.querySelector('.count').textContent"), '195 resultados');
  assert.equal(await ev("document.querySelector('.atlas-facet').hidden"), true);

  // O mapa de domínio da aba Progresso, agora num módulo próprio, continua
  // levando à ficha do país.
  await ev("document.querySelector('[data-view=prog]').click()");
  assert.equal(await ev("document.querySelectorAll('.mastery-tile').length"), 0);
  await ev("document.querySelector('.mastery-details summary').click()");
  await until('Progresso aberto', () => ev("Boolean(document.querySelector('.mastery-tile'))"));
  await ev("[...document.querySelectorAll('.mastery-tile')].find(b => b.title === 'Japão').click()");
  await until('ficha do Japão', () => ev("document.querySelector('.atlas-detail h3')?.textContent === 'Japão'"));

  await buscar('');
  await ev("document.querySelector('[data-view=quiz]').click()");
};

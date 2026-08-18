'use strict';

// Os indicadores e os fatos derivados são complementos da ficha do país. Dois
// riscos moram aqui: um número perder a origem e virar folclore, e algum deles
// escapar para o sorteio de perguntas — adivinhar IDH não é conhecimento
// geográfico, e o índice reduz um país a um número que muda a cada edição.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const indicators = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'indicators.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'atlas-195.html'), 'utf8');
const Core = require('../src/core.js');

function builtData() {
  const match = html.match(/<script\b[^>]*data-atlas-slot="data"[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'Bloco de dados não encontrado no artefato.');
  const context = Object.create(null);
  vm.runInNewContext(`${match[1]}\n;globalThis.__D__ = { DATA, TERRITORIES, INDICATOR_META };`, context, { timeout: 5000 });
  return JSON.parse(JSON.stringify(context.__D__));
}
const built = builtData();
const SERIES = ['pop', 'vida', 'dens', 'urb', 'flor'];

test('a origem de cada indicador está registrada e é oficial', () => {
  const { idh, bancoMundial } = indicators.meta;

  // O IDH é definido e calculado pelo PNUD; qualquer outra origem é republicação.
  assert.match(idh.url, /^https:\/\/hdr\.undp\.org\//, 'O IDH precisa vir do PNUD.');
  assert.match(idh.sha256, /^[0-9a-f]{64}$/);
  assert.ok(idh.fonte && idh.termos);
  assert.ok(Number.isInteger(idh.ano) && idh.ano >= 2020, `Ano do IDH implausível: ${idh.ano}`);

  assert.equal(bancoMundial.licenca, 'CC BY 4.0');
  SERIES.forEach((campo) => {
    const serie = bancoMundial.indicadores[campo];
    assert.ok(serie, `Faltou registrar a série ${campo}.`);
    assert.match(serie.url, /^https:\/\/api\.worldbank\.org\//, `${campo} precisa vir do Banco Mundial.`);
    assert.match(serie.sha256, /^[0-9a-f]{64}$/, `${campo} sem hash do que foi baixado.`);
    assert.ok(serie.codigo && serie.rotulo, `${campo} sem código ou rótulo.`);
    assert.ok(serie.cobertura >= 190, `${campo} caiu para ${serie.cobertura}/195.`);
  });
  assert.match(indicators.meta.gerado, /^\d{4}-\d{2}-\d{2}$/);
});

test('todo país tem o dado ou a explicação de por que não tem', () => {
  assert.equal(built.DATA.length, 195);

  const faixas = {
    pop: [500, 2e9], vida: [30, 95], dens: [0.1, 30000], urb: [0, 100], flor: [0, 100], hdi: [0.2, 1],
  };

  for (const country of built.DATA) {
    for (const campo of SERIES.concat('hdi')) {
      const valor = country[campo];
      if (Number.isFinite(valor)) {
        const [minimo, maximo] = faixas[campo];
        assert.ok(valor >= minimo && valor <= maximo, `${country.id}: ${campo} fora de faixa (${valor}).`);
        const ano = country[`${campo}Ano`];
        assert.ok(Number.isInteger(ano) && ano >= 2020, `${country.id}: ${campo} sem ano plausível.`);
      } else {
        // Sem número, a ficha precisa poder dizer por quê.
        const explicado = campo === 'hdi' ? country.hdiNota : country.bmNota;
        assert.ok(explicado, `${country.id}: sem ${campo} e sem explicação.`);
      }
    }
  }

  // As ausências são poucas e conhecidas; se mudarem, a leitura da fonte quebrou.
  const semHdi = built.DATA.filter((c) => !Number.isFinite(c.hdi)).map((c) => c.id).sort();
  assert.deepEqual(semHdi, ['KP', 'MC', 'VA'], 'Mudou quem fica sem IDH: revise antes de aceitar.');
  const semPop = built.DATA.filter((c) => !Number.isFinite(c.pop)).map((c) => c.id).sort();
  assert.deepEqual(semPop, ['VA'], 'Mudou quem fica sem população: revise antes de aceitar.');
});

test('indicadores e fatos nunca viram resposta de pergunta', () => {
  const direcoes = Core.QUESTION_DIRECTIONS.join(' ');
  assert.doesNotMatch(direcoes, /hdi|idh|pop|dens|urb|flor|vida|fato/i, 'Surgiu direção de pergunta baseada em indicador.');

  const alvo = built.DATA.find((country) => country.id === 'BR');
  const aceitas = Core.acceptedAnswers(alvo, 'capital').concat(Core.acceptedAnswers(alvo, 'country'));
  const texto = aceitas.join(' ');
  assert.doesNotMatch(texto, new RegExp(String(alvo.pop)), 'A população virou resposta aceita.');
  assert.doesNotMatch(texto, /0[.,]\d{3}/, 'Um índice virou resposta aceita.');
});

test('os fatos derivados são só extremos, e cobrem quase todo o mundo', () => {
  const facts = (country) => Core.derivedFacts(country, built.DATA, { territories: built.TERRITORIES });

  const comFato = built.DATA.filter((country) => facts(country).length);
  assert.ok(comFato.length >= 185, `Cobertura de fatos caiu para ${comFato.length}/195.`);

  // O topo precisa bater com o dado, senão a frase virou enfeite.
  const maiorArea = [...built.DATA].sort((a, b) => b.ar - a.ar)[0];
  assert.match(facts(maiorArea).join(' | '), /o maior país do mundo em área/);

  const maiorPop = built.DATA.filter((c) => c.pop).sort((a, b) => b.pop - a.pop)[0];
  assert.match(facts(maiorPop).join(' | '), /o país mais populoso do mundo/);

  // Um país do meio da tabela não pode ganhar ranking: "87º maior" não é fato.
  const meio = [...built.DATA].sort((a, b) => b.ar - a.ar)[97];
  assert.doesNotMatch(facts(meio).join(' | '), /do mundo em área/, `${meio.n} recebeu ranking de meio de tabela.`);

  // Concordância: expectativa de vida é feminina.
  const todos = built.DATA.flatMap(facts).join(' | ');
  assert.doesNotMatch(todos, /o maior expectativa/, 'Erro de concordância nos fatos.');
  assert.doesNotMatch(todos, /\b1º /, 'O primeiro colocado não deve levar ordinal.');

  // A função é pura: nada do que ela devolve pode alterar o dataset.
  const antes = JSON.stringify(built.DATA[0]);
  facts(built.DATA[0]);
  assert.equal(JSON.stringify(built.DATA[0]), antes);
});

test('a ficha mostra cada número com o ano e credita as fontes', () => {
  assert.match(html, /\$\{country\[`\$\{item\.campo\}Ano`\]\}/, 'Todo indicador precisa sair com o ano ao lado.');
  // Sem alternativa na regex: um nome de campo que não existe mais quebraria a
  // ficha em tempo de execução e passaria batido se o teste aceitasse o texto solto.
  assert.match(html, /INDICATOR_META\.bancoMundial\.fonte/, 'A ficha precisa creditar o Banco Mundial.');
  assert.match(html, /INDICATOR_META\.idh\.fonte/, 'A ficha precisa creditar o PNUD.');
  assert.doesNotMatch(html, /INDICATOR_META\.populacao/, 'Referência a um campo que não existe mais.');
  assert.ok(built.INDICATOR_META && built.INDICATOR_META.idh.ano, 'O artefato precisa embarcar a procedência.');
  assert.ok(built.INDICATOR_META.bancoMundial.indicadores.vida, 'A procedência das séries precisa viajar junto.');
});

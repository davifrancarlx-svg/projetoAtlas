'use strict';

// População e IDH são dados complementares da ficha do país. Dois riscos moram
// aqui: um número perder a origem e virar folclore, e um deles escapar para o
// sorteio de perguntas — adivinhar IDH não é conhecimento geográfico, e o índice
// reduz um país a um número que muda a cada edição do relatório.

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
  vm.runInNewContext(`${match[1]}\n;globalThis.__D__ = { DATA, INDICATOR_META };`, context, { timeout: 5000 });
  return JSON.parse(JSON.stringify(context.__D__));
}
const built = builtData();

test('a origem de cada indicador está registrada e é oficial', () => {
  const { idh, populacao } = indicators.meta;

  // O IDH é definido e calculado pelo PNUD; qualquer outra origem é republicação.
  assert.match(idh.url, /^https:\/\/hdr\.undp\.org\//, 'O IDH precisa vir do PNUD.');
  assert.match(populacao.url, /^https:\/\/api\.worldbank\.org\//, 'A população precisa vir do Banco Mundial.');

  [idh, populacao].forEach((fonte) => {
    assert.match(fonte.sha256, /^[0-9a-f]{64}$/, 'Falta o hash do que foi baixado.');
    assert.ok(fonte.fonte && fonte.termos, 'Falta identificar a fonte e os termos de uso.');
  });
  assert.match(indicators.meta.gerado, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isInteger(idh.ano) && idh.ano >= 2020, `Ano do IDH implausível: ${idh.ano}`);
});

test('todo país tem o dado ou a explicação de por que não tem', () => {
  const ids = built.DATA.map((country) => country.id);
  assert.equal(ids.length, 195);

  let comHdi = 0;
  let comPop = 0;
  for (const country of built.DATA) {
    const temHdi = Number.isFinite(country.hdi);
    const temPop = Number.isFinite(country.pop);
    if (temHdi) comHdi += 1; else assert.ok(country.hdiNota, `${country.id}: sem IDH e sem explicação.`);
    if (temPop) comPop += 1; else assert.ok(country.popNota, `${country.id}: sem população e sem explicação.`);

    // Um número fora de faixa denuncia coluna trocada na leitura da fonte.
    if (temHdi) {
      assert.ok(country.hdi > 0.2 && country.hdi <= 1, `${country.id}: IDH fora de faixa (${country.hdi}).`);
      assert.equal(country.hdiAno, indicators.meta.idh.ano);
    }
    if (temPop) {
      assert.ok(country.pop >= 500 && country.pop < 2e9, `${country.id}: população implausível (${country.pop}).`);
      assert.ok(Number.isInteger(country.popAno) && country.popAno >= 2020);
    }
  }

  // As ausências são poucas e conhecidas; se crescerem, a leitura da fonte quebrou.
  assert.ok(comHdi >= 190, `Cobertura de IDH caiu para ${comHdi}/195.`);
  assert.ok(comPop >= 193, `Cobertura de população caiu para ${comPop}/195.`);

  const semHdi = built.DATA.filter((c) => !Number.isFinite(c.hdi)).map((c) => c.id).sort();
  assert.deepEqual(semHdi, ['KP', 'MC', 'VA'], 'Mudou quem fica sem IDH: revise antes de aceitar.');
  const semPop = built.DATA.filter((c) => !Number.isFinite(c.pop)).map((c) => c.id).sort();
  assert.deepEqual(semPop, ['VA'], 'Mudou quem fica sem população: revise antes de aceitar.');
});

test('população e IDH nunca viram resposta de pergunta', () => {
  // Nenhuma direção de pergunta pode cobrar esses campos.
  const direcoes = Core.QUESTION_DIRECTIONS.join(' ');
  assert.doesNotMatch(direcoes, /hdi|pop|idh/i, 'Surgiu uma direção de pergunta baseada em indicador.');

  // E eles não podem entrar no conjunto de respostas aceitas de nenhum país.
  const alvo = built.DATA.find((country) => country.id === 'BR');
  const aceitas = Core.acceptedAnswers(alvo, 'capital').concat(Core.acceptedAnswers(alvo, 'country'));
  const texto = aceitas.join(' ');
  assert.doesNotMatch(texto, new RegExp(String(alvo.pop)), 'A população virou resposta aceita.');
  assert.doesNotMatch(texto, /0,7|0\.7/, 'O IDH virou resposta aceita.');
});

test('a ficha do país mostra os números com o ano e credita a fonte', () => {
  assert.match(html, /habitantes · \$\{country\.popAno\}|habitantes/, 'A população precisa aparecer na ficha.');
  // O ano ao lado é obrigatório: sem ele o número parece permanente.
  assert.match(html, /IDH \$\{country\.hdi\.toFixed\(3\)\.replace\('\.', ','\)\} · \$\{country\.hdiAno\}/,
    'O IDH precisa sair com o ano ao lado.');
  assert.match(html, /INDICATOR_META\.populacao\.fonte/, 'A ficha precisa creditar a fonte da população.');
  assert.match(html, /INDICATOR_META\.idh\.fonte/, 'A ficha precisa creditar a fonte do IDH.');
  assert.ok(built.INDICATOR_META && built.INDICATOR_META.idh.ano, 'O artefato precisa embarcar a procedência.');
});

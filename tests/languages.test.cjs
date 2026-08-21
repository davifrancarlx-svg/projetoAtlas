'use strict';

// Os idiomas são complemento da ficha do país, como os indicadores. Dois riscos
// moram aqui: um país ficar sem idioma nenhum (silenciosamente, num dado que é
// editorial e não vem de API), e um nome de idioma escapar para o sorteio de
// perguntas — "português" como resposta aceita colidiria com Portugal, e o
// projeto inteiro depende de o universo de respostas não ter ambiguidade.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const languages = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'languages.json'), 'utf8'));
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'countries.base.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'atlas-195.html'), 'utf8');
const Core = require('../src/core.js');

function builtData() {
  const match = html.match(/<script\b[^>]*data-atlas-slot="data"[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'Bloco de dados não encontrado no artefato.');
  const context = Object.create(null);
  vm.runInNewContext(`${match[1]}\n;globalThis.__D__ = { DATA };`, context, { timeout: 5000 });
  return JSON.parse(JSON.stringify(context.__D__));
}
const built = builtData();

test('todo país tem ao menos um idioma oficial, e nenhum sobra', () => {
  const ids = countries.map((country) => country.id);
  assert.equal(Object.keys(languages).length, 195, 'src/languages.json precisa cobrir exatamente os 195 países.');

  const semIdioma = ids.filter((id) => !languages[id]);
  assert.deepEqual(semIdioma, [], `Países sem idioma registrado: ${semIdioma.join(', ')}`);

  const sobrando = Object.keys(languages).filter((id) => !ids.includes(id));
  assert.deepEqual(sobrando, [], `IDs que não são um dos 195: ${sobrando.join(', ')}`);

  Object.entries(languages).forEach(([id, entry]) => {
    assert.ok(Array.isArray(entry.oficiais) && entry.oficiais.length, `${id} está sem lista de idiomas oficiais.`);
    assert.equal(new Set(entry.oficiais).size, entry.oficiais.length, `${id} repete um idioma na própria lista.`);
    const chaves = Object.keys(entry).filter((key) => !['oficiais', 'nota'].includes(key));
    assert.deepEqual(chaves, [], `${id} tem campo inesperado: ${chaves.join(', ')}`);
  });
});

test('os nomes de idioma seguem a grafia comum do português', () => {
  Object.entries(languages).forEach(([id, entry]) => {
    entry.oficiais.forEach((idioma) => {
      assert.equal(idioma, idioma.trim(), `${id}: "${idioma}" tem espaço sobrando.`);
      // Em português, nome de língua é substantivo comum: "alemão", não "Alemão".
      // Um nome capitalizado costuma ser o nome do país copiado por engano.
      const inicial = idioma[0];
      assert.equal(inicial, inicial.toLowerCase(), `${id}: "${idioma}" deveria começar em minúscula.`);
    });
  });
});

test('a nota do idioma é uma frase, e só existe quando explica algo', () => {
  Object.entries(languages).forEach(([id, entry]) => {
    if (!('nota' in entry)) return;
    const nota = entry.nota;
    assert.ok(typeof nota === 'string' && nota.trim().length > 15, `${id}: nota vazia ou curta demais.`);
    assert.equal(nota[0], nota[0].toUpperCase(), `${id}: a nota deveria começar em maiúscula.`);
    assert.match(nota, /\.$/, `${id}: a nota deveria terminar em ponto.`);
  });
});

test('os idiomas viajam no artefato, ligados ao país certo', () => {
  assert.equal(built.DATA.length, 195);
  built.DATA.forEach((country) => {
    assert.ok(Array.isArray(country.idiomas) && country.idiomas.length, `${country.n} chegou ao artefato sem idioma.`);
    assert.deepEqual(country.idiomas, languages[country.id].oficiais, `${country.n} recebeu o idioma de outro país.`);
    assert.equal(country.idiomasNota, languages[country.id].nota || '', `${country.n} recebeu a nota errada.`);
  });

  // Amostra fixa: erro de deslocamento de índice passaria pelas checagens acima
  // se ele acontecesse igual nos dois lados.
  const idiomaDe = (id) => built.DATA.find((country) => country.id === id).idiomas;
  assert.deepEqual(idiomaDe('BR'), ['português']);
  assert.deepEqual(idiomaDe('CH'), ['alemão', 'francês', 'italiano', 'romanche']);
  assert.deepEqual(idiomaDe('PY'), ['espanhol', 'guarani']);
});

test('idioma nunca vira resposta de pergunta', () => {
  const direcoes = Core.QUESTION_DIRECTIONS.join(' ');
  assert.doesNotMatch(direcoes, /idioma|lang|lingua|língua/i, 'Surgiu direção de pergunta baseada em idioma.');

  // O risco concreto: "português" entrar no universo de respostas e passar a
  // competir com "Portugal" na validação por semelhança.
  const todosIdiomas = new Set(Object.values(languages).flatMap((entry) => entry.oficiais));
  built.DATA.forEach((country) => {
    const aceitas = Core.acceptedAnswers(country, 'capital').concat(Core.acceptedAnswers(country, 'country'));
    aceitas.forEach((resposta) => {
      assert.ok(
        !todosIdiomas.has(String(resposta).toLowerCase()),
        `${country.n} aceita "${resposta}", que é nome de idioma.`
      );
    });
  });
});

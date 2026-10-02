'use strict';

// A moeda segue a política dos idiomas: complementa a ficha do país e **nunca**
// é resposta de pergunta. O que este arquivo protege é justamente isso, mais o
// esquema do arquivo editorial e a grafia em português.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const base = read('src/countries.base.json');
const currencies = read('src/currencies.json');
const html = fs.readFileSync(path.join(ROOT, 'atlas-195.html'), 'utf8');

test('cada um dos 195 países tem moeda, com código ISO 4217 válido', () => {
  assert.equal(Object.keys(currencies).length, 195);
  base.forEach((country) => {
    const entry = currencies[country.id];
    assert.ok(entry, `${country.id} (${country.n}) está sem moeda.`);
    assert.ok(Array.isArray(entry.moedas) && entry.moedas.length, `${country.id}: lista de moedas vazia.`);
    assert.ok(entry.moedas.length <= 2, `${country.id}: mais de duas moedas vira parágrafo, não ficha.`);
    const codigos = entry.moedas.map((moeda) => moeda.codigo);
    assert.equal(new Set(codigos).size, codigos.length, `${country.id}: moeda repetida.`);
    entry.moedas.forEach((moeda) => {
      assert.match(moeda.codigo, /^[A-Z]{3}$/, `${country.id}: código ISO inválido "${moeda.codigo}".`);
      assert.equal(typeof moeda.nome, 'string');
      assert.ok(moeda.nome.trim().length > 1, `${country.id}: nome de moeda vazio.`);
      // Em português, moeda é substantivo comum: "real", não "Real". O ZiG é a
      // exceção registrada, porque é assim que o banco central o grafa.
      if (moeda.nome !== 'ZiG') {
        assert.equal(moeda.nome[0], moeda.nome[0].toLowerCase(), `${country.id}: "${moeda.nome}" capitalizado.`);
      }
    });
    assert.deepEqual(
      Object.keys(entry).filter((key) => !['moedas', 'nota'].includes(key)), [],
      `${country.id}: campo fora do esquema.`,
    );
  });
});

test('a nota só existe quando o estatuto legal não conta a história sozinho', () => {
  const comNota = Object.entries(currencies).filter(([, entry]) => entry.nota);
  assert.ok(comNota.length >= 10 && comNota.length <= 60, `${comNota.length} notas foge do esperado.`);
  comNota.forEach(([id, entry]) => {
    assert.equal(typeof entry.nota, 'string');
    assert.match(entry.nota, /^[A-ZÀ-Ú].*\.$/, `${id}: a nota precisa ser uma frase completa.`);
    assert.ok(entry.nota.length <= 220, `${id}: nota longa demais para a ficha.`);
  });
  // Os casos que motivaram a política: moeda de outro país adotada por lei.
  ['EC', 'SV', 'TL', 'PA', 'ME', 'LI'].forEach((id) => {
    assert.ok(currencies[id].nota, `${id} usa moeda de fora e precisa explicar isso.`);
  });
  assert.equal(currencies.PA.moedas.length, 2, 'O Panamá tem balboa e dólar como curso legal.');
  assert.ok(currencies.BR.nota === undefined, 'Quem não tem nuance não carrega nota.');
});

test('nenhum nome de moeda entra no universo de respostas do quiz', () => {
  // As alternativas do quiz são nomes de país e de capital. Uma moeda com o
  // mesmo nome de um deles apareceria na busca como se fosse a mesma coisa.
  const respostas = new Set();
  base.forEach((country) => {
    respostas.add(Core.normalizeText(country.n));
    respostas.add(Core.normalizeText(country.cap));
  });
  Object.entries(currencies).forEach(([id, entry]) => entry.moedas.forEach((moeda) => {
    assert.equal(respostas.has(Core.normalizeText(moeda.nome)), false,
      `${id}: a moeda "${moeda.nome}" colide com uma resposta aceita.`);
  }));
});

test('o artefato leva a moeda para a ficha e não para as perguntas', () => {
  const build = fs.readFileSync(path.join(ROOT, 'scripts/build.cjs'), 'utf8');
  assert.match(build, /moedas: currency\.moedas/, 'O build precisa anexar a moeda ao país.');
  assert.match(build, /Moeda ausente para/, 'O build precisa recusar um país sem moeda.');
  assert.match(html, /linkLine\('moedas'/, 'A ficha precisa exibir a moeda.');
  // A ficha mostra o código junto do nome; o quiz não conhece nenhum dos dois.
  assert.match(html, /moeda\.nome\} \(\$\{moeda\.codigo\}\)/);
  const DATA = require('node:vm').runInNewContext(
    `${html.match(/const DATA = (\[.*?\]);\n/s)[0]}DATA`, {},
  );
  const brasil = DATA.find((country) => country.id === 'BR');
  // O JSON vem de outro contexto de execução: comparar o texto evita comparar
  // protótipos em vez de conteúdo.
  assert.equal(JSON.stringify(brasil.moedas), JSON.stringify([{ nome: 'real', codigo: 'BRL' }]));
  assert.equal(brasil.moedaNota, '');
  const zona = DATA.filter((country) => country.moedas.some((moeda) => moeda.codigo === 'EUR'));
  assert.equal(zona.length, 26, 'Zona do euro mais os cinco que o usam por acordo ou unilateralmente.');
});

'use strict';

// Os outros nomes e os nomes anteriores que a ficha mostra são editoriais
// (src/content-policy.json) e só existem para leitura. Dois riscos moram aqui:
// a ficha dizer "outro nome: Inglaterra", que o projeto trata como erro comum,
// e a ficha mostrar um nome que a busca do Atlas não acha. Por isso todo nome
// exibido precisa ser um dos que o app já conhecia, e de um tipo seguro.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'content-policy.json'), 'utf8'));
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'countries.base.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'atlas-195.html'), 'utf8');
const Core = require('../src/core.js');

const byId = Object.fromEntries(countries.map((country) => [country.id, country]));
// A normalização da busca tira hífen sem pôr espaço ("Congo-Kinshasa" vira
// "congokinshasa"); aqui o espaço também sai, para comparar só as letras.
const key = (value) => Core.normalizeText(value).replace(/ /g, '');

function builtData() {
  const match = html.match(/<script\b[^>]*data-atlas-slot="data"[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'Bloco de dados não encontrado no artefato.');
  const context = Object.create(null);
  vm.runInNewContext(`${match[1]}\n;globalThis.__D__ = { DATA };`, context, { timeout: 5000 });
  return JSON.parse(JSON.stringify(context.__D__));
}

test('todo nome da ficha é um nome que o app já conhecia, e de tipo seguro', () => {
  let total = 0;
  Object.entries(policy).forEach(([id, entry]) => {
    const country = byId[id];
    assert.ok(country, `${id} não é um dos 195.`);
    const seguros = new Set([
      ...(entry.nameAliases ?? country.alt ?? []),
      ...(entry.countryHistoricNames || []),
      ...(entry.countryColloquialisms || []),
    ].map(key));
    const erros = new Set([...(entry.countryMistakes || []), ...(entry.countryAmbiguousNames || [])].map(key));
    const exibidos = [...(entry.alsoKnownAs || []), ...(entry.formerNames || []).map((item) => item.name)];
    exibidos.forEach((nome) => {
      total += 1;
      assert.ok(seguros.has(key(nome)), `${country.n}: "${nome}" não está entre os nomes que a busca conhece.`);
      assert.ok(!erros.has(key(nome)), `${country.n}: "${nome}" é erro comum, não outro nome.`);
      assert.notEqual(key(nome), key(country.n), `${country.n}: "${nome}" é o próprio nome.`);
      assert.equal(nome, nome.trim());
      assert.notEqual(nome, nome.toLowerCase(), `${country.n}: "${nome}" parece forma de busca, não de leitura.`);
    });
    (entry.formerNames || []).forEach((item) => {
      assert.ok(Number.isInteger(item.until) && item.until > 1900 && item.until <= new Date().getFullYear(),
        `${country.n}: "${item.name}" precisa do ano em que deixou de valer.`);
    });
  });
  assert.ok(total >= 20, `Só ${total} nomes na ficha: a lista encolheu.`);
});

test('os nomes chegam ao artefato só nos países que os têm', () => {
  const { DATA } = builtData();
  const comNome = DATA.filter((country) => country.alsoKnownAs || country.formerNames).map((country) => country.id).sort();
  const esperados = Object.entries(policy)
    .filter(([, entry]) => (entry.alsoKnownAs || []).length || (entry.formerNames || []).length)
    .map(([id]) => id).sort();
  assert.deepEqual(comNome, esperados);
  const suazi = DATA.find((country) => country.id === 'SZ');
  assert.deepEqual(suazi.alsoKnownAs, ['Eswatini']);
  assert.deepEqual(suazi.formerNames, [{ name: 'Suazilândia', until: 2018 }]);
  assert.equal(DATA.find((country) => country.id === 'GB').alsoKnownAs, undefined, 'Inglaterra é erro, não outro nome.');
});

test('as notas da capital valem igual para o veredito e para a ficha', () => {
  const { DATA } = builtData();
  const de = (id) => Core.capitalNotes(DATA.find((country) => country.id === id));
  assert.deepEqual(de('ZA'), [
    'Também é capital oficial: Cidade do Cabo, Bloemfontein.',
    'Pretória é a capital administrativa, Cidade do Cabo a legislativa e Bloemfontein a judicial.',
  ]);
  assert.deepEqual(de('KZ'), ['Nome antigo da capital: Nur-Sultan.']);
  // As grafias que só serviam à digitação saíram: a ficha diz o nome uma vez.
  assert.equal(de('CI')[0], 'Outra sede de governo: Abidjan.');
  assert.equal(de('YE')[0], 'Outra sede de governo: Áden.');
  assert.deepEqual(de('BR'), []);
  assert.deepEqual(Core.capitalNotes(null), []);
});

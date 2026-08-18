'use strict';

// O tema claro funciona porque nenhuma regra de layout escreve cor crua: tudo
// sai de um token, e o tema claro é só uma redefinição desses tokens. Basta uma
// cor fixa reaparecer numa regra para aquele pedaço da interface continuar
// escuro no tema claro — um defeito que não quebra teste nenhum e só aparece
// para quem usa o aparelho no modo claro.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8');

// Remove os blocos onde declarar cor crua é justamente o certo: as paletas.
function withoutPalettes(css) {
  let out = css;
  const light = out.indexOf('@media (prefers-color-scheme: light)');
  if (light !== -1) {
    // consome o bloco da media query inteiro contando chaves
    let depth = 0;
    let end = light;
    for (let i = out.indexOf('{', light); i < out.length; i += 1) {
      if (out[i] === '{') depth += 1;
      else if (out[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
    }
    out = out.slice(0, light) + out.slice(end);
  }
  // O tema fixado pelo botão do app é paleta como as outras: declarar cor crua
  // ali é o certo. O que segue proibido é cor crua numa regra de layout.
  out = out.replace(/:root\[data-theme="(?:light|dark)"\]\s*\{[\s\S]*?\n\}/g, '');
  return out.replace(/:root\s*\{[\s\S]*?\}/g, '');
}

test('nenhuma regra escreve cor fixa fora das paletas', () => {
  const regras = withoutPalettes(CSS);
  const cruas = regras
    .split('\n')
    .map((linha, indice) => ({ linha: linha.trim(), numero: indice + 1 }))
    .filter(({ linha }) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(linha) && !linha.startsWith('/*'));

  assert.deepEqual(
    cruas.map(({ linha }) => linha),
    [],
    'Use um token em :root e redefina-o no tema claro em vez de escrever a cor na regra.'
  );
});

test('o tema claro redefine as superfícies e os acentos', () => {
  const bloco = CSS.match(/@media \(prefers-color-scheme: light\)\s*\{[\s\S]*?\n\}/);
  assert.ok(bloco, 'O tema claro sumiu.');

  // Superfícies e tintas precisam inverter; os acentos precisam escurecer, senão
  // dourado, menta e coral ficam ilegíveis sobre branco.
  ['--ocean', '--panel', '--panel-2', '--ink', '--muted', '--muted-2',
    '--gold', '--mint', '--coral', '--on-accent', '--line', '--land',
    '--ok-ink', '--bad-ink', '--shadow-soft'].forEach((token) => {
    assert.match(bloco[0], new RegExp(`${token}:`), `O tema claro não redefine ${token}.`);
  });

  assert.match(CSS, /color-scheme: light dark/, 'A raiz precisa anunciar os dois esquemas.');
});

// O tema claro existe em dois lugares: dentro da media query, para o modo
// automático, e num bloco fixo, para quem escolheu claro dentro do app. Os dois
// precisam ser idênticos — se divergirem, a interface muda de cor conforme o
// sistema por baixo, e ninguém percebe até alguém reclamar de um detalhe.
function tokensDoBloco(bloco) {
  const tokens = new Map();
  bloco.split('\n').forEach((linha) => {
    const par = linha.match(/^\s*(--[a-z0-9-]+):\s*(.+);\s*$/);
    if (par) tokens.set(par[1], par[2].trim());
  });
  return tokens;
}

test('as duas paletas claras declaram exatamente os mesmos valores', () => {
  const doSistema = CSS.match(/@media \(prefers-color-scheme: light\)\s*\{[\s\S]*?\n\}/);
  const doBotao = CSS.match(/:root\[data-theme="light"\]\s*\{[\s\S]*?\n\}/);
  assert.ok(doSistema, 'O tema claro do sistema sumiu.');
  assert.ok(doBotao, 'O tema claro fixado pelo botão sumiu.');

  const sistema = tokensDoBloco(doSistema[0]);
  const botao = tokensDoBloco(doBotao[0]);
  assert.ok(sistema.size >= 25, 'A paleta clara do sistema encolheu demais.');
  assert.deepEqual(
    [...botao.keys()].sort(),
    [...sistema.keys()].sort(),
    'Os dois blocos do tema claro precisam declarar os mesmos tokens.'
  );
  for (const token of sistema.keys()) {
    assert.equal(
      botao.get(token),
      sistema.get(token),
      'O token ' + token + ' divergiu entre as duas paletas claras.'
    );
  }
});

test('a escolha feita no app vence a preferência do sistema', () => {
  // Sem o :not, quem fixa o escuro num sistema claro continua vendo claro: a
  // media query redefiniria os mesmos tokens depois do bloco fixo.
  assert.match(
    CSS,
    /@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme="dark"\]\)/,
    'A media query do tema claro precisa ceder quando o app fixou o escuro.'
  );
  assert.match(
    CSS,
    /:root\[data-theme="light"\]\s*\{\s*color-scheme: light;/,
    'O tema claro fixado precisa anunciar color-scheme: light para os controles nativos.'
  );
  assert.match(
    CSS,
    /:root\[data-theme="dark"\]\s*\{\s*color-scheme: dark;/,
    'O tema escuro fixado precisa anunciar color-scheme: dark.'
  );
});

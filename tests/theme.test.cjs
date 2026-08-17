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

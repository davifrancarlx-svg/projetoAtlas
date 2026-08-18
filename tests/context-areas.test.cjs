'use strict';

// As terras fora dos 195 eram uma mancha cinza única: Groenlândia, Antártida e
// Saara Ocidental viravam o mesmo borrão anônimo. Agora cada uma é desenhada por
// si e classificada em três grupos. O risco que estes testes cobrem é o
// editorial, não o visual: atribuir um soberano a área disputada seria o Atlas
// afirmando geopolítica que não tem como sustentar, e num mapa isso passa
// despercebido por muito tempo.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'atlas-195.html'), 'utf8');
const classificacao = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'context-areas.json'), 'utf8'));
const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'map-geometry.json'), 'utf8'));

function builtData() {
  const match = html.match(/<script\b[^>]*data-atlas-slot="data"[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'Bloco de dados não encontrado.');
  const context = Object.create(null);
  vm.runInNewContext(`${match[1]}\n;globalThis.__D__ = { DATA, CONTEXT_AREAS, MAP_META };`, context, { timeout: 5000 });
  return JSON.parse(JSON.stringify(context.__D__));
}
const built = builtData();

test('toda feição fora dos 195 está classificada', () => {
  assert.equal(built.CONTEXT_AREAS.length, geometry.meta.contextLand.stats.features);
  assert.equal(built.CONTEXT_AREAS.length, Object.keys(classificacao.areas).length);

  const grupos = {};
  built.CONTEXT_AREAS.forEach((area) => {
    assert.ok(area.code && area.n && area.d, `${area.code}: registro incompleto.`);
    assert.match(area.d, /^M[-\d.]/, `${area.code}: contorno inválido.`);
    grupos[area.grupo] = (grupos[area.grupo] || 0) + 1;
  });
  assert.deepEqual(Object.keys(grupos).sort(), ['dependencia', 'disputado', 'sem-soberania']);
});

test('só dependência recebe soberano; disputada e sem dono explicam o próprio status', () => {
  const ids = new Set(built.DATA.map((country) => country.id));

  for (const area of built.CONTEXT_AREAS) {
    if (area.grupo === 'dependencia') {
      assert.ok(ids.has(area.of), `${area.code} aponta para um soberano fora dos 195: ${area.of}.`);
      assert.ok(!area.nota, `${area.code}: dependência não precisa de nota de status.`);
    } else {
      // O ponto sensível do recurso inteiro mora nesta linha.
      assert.ok(!area.of, `${area.code} é ${area.grupo} e não pode receber soberano.`);
      assert.ok(area.nota && area.nota.length > 20, `${area.code}: falta explicar o próprio status.`);
    }
  }

  // Casos que motivaram a divisão em grupos: se algum deles mudar de lado, é
  // decisão editorial e precisa ser revista à mão, não passar despercebida.
  const porCodigo = Object.fromEntries(built.CONTEXT_AREAS.map((area) => [area.code, area]));
  assert.equal(porCodigo.GRL.grupo, 'dependencia');
  assert.equal(porCodigo.GRL.of, 'DK', 'A Groenlândia é território dinamarquês.');
  assert.equal(porCodigo.ATA.grupo, 'sem-soberania', 'O Tratado da Antártida suspende reivindicações.');
  assert.equal(porCodigo.BRT.grupo, 'sem-soberania', 'Bir Tawil não é reivindicada por ninguém.');
  ['SAH', 'TWN', 'KOS', 'SOL', 'FLK', 'CYN', 'GIB'].forEach((code) => {
    assert.equal(porCodigo[code].grupo, 'disputado', `${code} precisa continuar sem atribuição.`);
  });
});

test('nenhuma área de contexto vira resposta de pergunta', () => {
  const ids = new Set(built.DATA.map((country) => country.id));
  built.CONTEXT_AREAS.forEach((area) => {
    assert.equal(ids.has(area.code), false, `${area.code} não pode estar entre os 195.`);
  });
  // Sem data-id no desenho, o mapa não as reconhece como alvo clicável de quiz.
  assert.doesNotMatch(html, /data-context="[A-Z]{3}"[^>]*data-id=/, 'Área de contexto não pode carregar data-id.');
  assert.match(html, /class: `context-land is-\$\{area\.grupo\}`/, 'A cor precisa sair do grupo.');
});

test('o artefato não carrega a silhueta fundida além das áreas', () => {
  // As duas juntas seriam 285 KB de contorno repetido para o mesmo desenho.
  assert.equal(built.MAP_META.contextLand.d, undefined, 'A silhueta fundida não deve viajar no artefato.');
  assert.equal(built.MAP_META.contextAreas, undefined, 'As áreas viajam em CONTEXT_AREAS, não em MAP_META.');
  // No arquivo de geometria ela continua, porque é lá que o gerador a valida.
  assert.match(geometry.meta.contextLand.d, /^M[-\d.]/);
});

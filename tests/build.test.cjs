'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'atlas-195.html');
const Core = require('../src/core.js');

function buildAtlas() {
  const result = spawnSync(process.execPath, ['scripts/build.cjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(
    result.status,
    0,
    `O build falhou.\nstdout:\n${result.stdout || '(vazio)'}\nstderr:\n${result.stderr || '(vazio)'}`
  );
  assert.equal(result.signal, null, 'O build não deve ser encerrado por sinal.');
  return result;
}

function extractInline(html, tag, slot) {
  const expression = new RegExp(
    `<${tag}\\b[^>]*data-atlas-slot=["']${slot}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
    'i'
  );
  const match = html.match(expression);
  assert.ok(match, `Bloco inline ${tag}[data-atlas-slot="${slot}"] não encontrado.`);
  return match[1];
}

function readBuiltData(html) {
  const source = extractInline(html, 'script', 'data');
  const context = Object.create(null);
  vm.runInNewContext(
    `${source}\n;globalThis.__ATLAS_BUILD_DATA__ = { MAP_META, DATA, TERRITORIES };`,
    context,
    { filename: 'atlas-195.html#data', timeout: 5_000 }
  );
  return JSON.parse(JSON.stringify(context.__ATLAS_BUILD_DATA__));
}

function cspDirectives(html) {
  const match = html.match(
    /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content="([^"]+)"[^>]*>/i
  );
  assert.ok(match, 'Meta Content-Security-Policy não encontrada.');
  const directives = new Map();
  match[1].split(';').map(part => part.trim()).filter(Boolean).forEach((part) => {
    const [name, ...values] = part.split(/\s+/);
    directives.set(name, values);
  });
  return directives;
}

function cspHash(source) {
  return `'sha256-${crypto.createHash('sha256').update(source, 'utf8').digest('base64')}'`;
}

function hashesOf(directives, name) {
  return (directives.get(name) || []).filter(value => /^'sha256-[A-Za-z0-9+/]+=*'$/.test(value));
}

const buildResult = buildAtlas();
const html = fs.readFileSync(OUTPUT, 'utf8');
const built = readBuiltData(html);

test('o build gera um único atlas-195.html autocontido', () => {
  assert.match(buildResult.stdout, /atlas-195\.html gerado: 195 países/i);
  assert.ok(fs.statSync(OUTPUT).size > 500_000, 'O artefato parece incompleto.');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i, 'Scripts externos quebram o arquivo único.');
  assert.doesNotMatch(
    html,
    /<link\b[^>]*\brel=["']stylesheet["']/i,
    'Folhas de estilo externas quebram o arquivo único.'
  );
  assert.equal((html.match(/<style\b/gi) || []).length, 1, 'Deve existir um único estilo inline.');
  assert.equal((html.match(/<script\b/gi) || []).length, 3, 'Dados, núcleo e app devem ser inline.');
});

test('o artefato contém exatamente os 195 países e IDs únicos', () => {
  assert.equal(Array.isArray(built.DATA), true);
  assert.equal(built.DATA.length, 195);
  const ids = built.DATA.map(country => country.id);
  assert.equal(new Set(ids).size, 195);
  ids.forEach((id) => assert.match(id, /^[A-Z]{2}$/, `ID inválido: ${id}`));
  built.DATA.forEach(country => assert.match(country.f, /^data:image\/svg\+xml;base64,/, `${country.id}: bandeira SVG não integrada.`));
  assert.match(html, /flag-icons 7\.5\.0 — MIT license/);
});

test('o build incorporou path, centro e bounds válidos para todo país', () => {
  for (const country of built.DATA) {
    assert.equal(typeof country.d, 'string', `${country.id}: path ausente.`);
    assert.match(country.d, /^M[-\d.]/, `${country.id}: path não começa com um comando M.`);
    assert.match(country.d, /Z$/, `${country.id}: path não termina fechado.`);
    assert.equal(Array.isArray(country.c), true, `${country.id}: centro ausente.`);
    assert.equal(country.c.length, 2, `${country.id}: centro precisa ter duas coordenadas.`);
    assert.equal(country.c.every(Number.isFinite), true, `${country.id}: centro não finito.`);
    assert.equal(Array.isArray(country.b), true, `${country.id}: bounds ausentes.`);
    assert.equal(country.b.length, 4, `${country.id}: bounds precisam ter quatro valores.`);
    assert.equal(country.b.every(Number.isFinite), true, `${country.id}: bounds não finitos.`);
    assert.ok(country.b[0] <= country.b[2], `${country.id}: bounds horizontais invertidos.`);
    assert.ok(country.b[1] <= country.b[3], `${country.id}: bounds verticais invertidos.`);
    assert.ok(country.c[0] >= country.b[0] && country.c[0] <= country.b[2], `${country.id}: centro fora dos bounds em x.`);
    assert.ok(country.c[1] >= country.b[1] && country.c[1] <= country.b[3], `${country.id}: centro fora dos bounds em y.`);
  }
});

test('a geometria sob o ponteiro vence alvos ampliados e o offset é relido por interação', () => {
  const appSource = extractInline(html, 'script', 'app');
  assert.match(
    appSource,
    /const directId =[^;]+;\s*if \(directId\) return directId;\s*const point = providedPoint \|\| screenToWorld/,
    'Um hitPoint vizinho não pode substituir o país geométrico realmente clicado.'
  );
  assert.match(
    appSource,
    /function screenToWorld\([^)]+\) \{\s*const metrics = providedMetrics \|\| mapMetrics\(true\);/,
    'Cliques após rolagem ou mudança de layout precisam reler a posição do mapa.'
  );
});

test('os territórios embarcam ao lado dos países sem virar resposta do quiz', () => {
  assert.equal(Array.isArray(built.TERRITORIES), true, 'TERRITORIES não foi embarcado.');
  const ids = new Set(built.DATA.map(country => country.id));
  for (const territory of built.TERRITORIES) {
    assert.equal(ids.has(territory.id), false, `${territory.id} não pode ser um dos 195 países.`);
    assert.equal(ids.has(territory.of), true, `${territory.id}: soberano ausente do dataset.`);
    assert.equal(territory.box.length, 4);
    assert.equal(territory.p.length, 2);
  }
  assert.match(buildResult.stdout, /\d+ territórios?/i);
  assert.ok(built.TERRITORIES.length >= 1);
});

test('a camada visual delega zoom, projeção e enquadramento ao núcleo testado', () => {
  const appSource = extractInline(html, 'script', 'app');
  // O comportamento é coberto em tests/map-view.test.cjs; aqui só se garante
  // que o app não voltou a manter uma cópia própria dessas regras.
  assert.match(appSource, /Core\.zoomView\(/, 'o zoom precisa vir do núcleo');
  assert.match(appSource, /Core\.clampView\(/, 'o limite da janela precisa vir do núcleo');
  assert.match(appSource, /Core\.fitBox\(/, 'o enquadramento precisa vir do núcleo');
  assert.match(appSource, /Core\.project\(|Core\.unproject\(/, 'a projeção precisa vir do núcleo');
  assert.doesNotMatch(appSource, /ROBINSON_TABLE\s*=/, 'a tabela Robinson não pode ser duplicada no app.');
});

test('a CSP autoriza exatamente o conteúdo inline emitido pelo build', () => {
  const directives = cspDirectives(html);
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);

  assert.deepEqual(directives.get('default-src'), ["'none'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  assert.deepEqual(directives.get('base-uri'), ["'none'"]);
  assert.equal((directives.get('script-src') || []).includes("'unsafe-inline'"), false);
  assert.equal((directives.get('script-src') || []).includes("'unsafe-eval'"), false);
  assert.equal((directives.get('style-src') || []).includes("'unsafe-inline'"), false);

  assert.deepEqual(hashesOf(directives, 'style-src').sort(), styles.map(cspHash).sort());
  assert.deepEqual(hashesOf(directives, 'script-src').sort(), scripts.map(cspHash).sort());
});

test('não restam placeholders nem atributos inline bloqueados pela CSP', () => {
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/, 'Há placeholder não resolvido.');

  const markupWithoutExecutableContent = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  assert.doesNotMatch(
    markupWithoutExecutableContent,
    /<[^>]+\son[a-z]+\s*=/i,
    'Event handler inline encontrado no HTML.'
  );
  assert.doesNotMatch(
    markupWithoutExecutableContent,
    /<[^>]+\sstyle\s*=/i,
    'Atributo style inline encontrado no HTML.'
  );

  const appSource = extractInline(html, 'script', 'app');
  assert.doesNotMatch(
    appSource,
    /<[^>]+\sstyle\s*=/i,
    'O app injeta marcação com style inline, que a CSP bloquearia.'
  );
});

test('as políticas críticas rejeitam Inglaterra, Roma e a colisão Kingston/Kingstown', () => {
  const countries = built.DATA;
  const byId = Object.fromEntries(countries.map(country => [country.id, country]));

  const england = Core.matchCountryAnswer('Inglaterra', byId.GB, 'country', countries);
  assert.equal(england.ok, false, 'Inglaterra não é sinônimo seguro de Reino Unido.');

  const rome = Core.matchCountryAnswer('Roma', byId.VA, 'capital', countries);
  assert.equal(rome.ok, false, 'Roma não deve ser aceita como capital da Cidade do Vaticano.');

  const ambiguous = Core.matchCountryAnswer('Kingston', byId.VC, 'capital', countries);
  assert.equal(ambiguous.ok, false, 'Kingston não pode ser aceito como Kingstown.');
  assert.equal(ambiguous.reason, 'canonical-collision');
  assert.deepEqual(ambiguous.conflicts, ['JM']);
  assert.equal(Core.matchCountryAnswer('Kingstown', byId.VC, 'capital', countries).ok, true);
});

test('capitais oficiais, sedes administrativas e nomes históricos não são confundidos', () => {
  const countries = built.DATA;
  const byId = Object.fromEntries(countries.map(country => [country.id, country]));

  assert.equal(byId.GQ.cap, 'Ciudad de la Paz');
  assert.equal(Core.matchCountryAnswer('Cidade da Paz', byId.GQ, 'capital', countries).ok, true);
  assert.equal(Core.matchCountryAnswer('Malabo', byId.GQ, 'capital', countries).ok, false);
  assert.equal(Core.matchCountryAnswer('La Paz', byId.BO, 'capital', countries).ok, false);
  assert.equal(Core.matchCountryAnswer('Colombo', byId.LK, 'capital', countries).ok, false);
  assert.equal(Core.matchCountryAnswer('Ramallah', byId.PS, 'capital', countries).ok, false);
  assert.equal(byId.NR.capitalType, 'government-seat');
  assert.equal(byId.CH.capitalType, 'de-facto');
  assert.equal(byId.CY.r, 'Ásia');
  assert.equal(countries.some(country => country.r === 'América do Norte e Central'), false);
  assert.equal(countries.some(country => country.r === 'América do Norte, Central e Caribe'), true);
});

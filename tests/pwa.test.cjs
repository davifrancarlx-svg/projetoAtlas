'use strict';

// O Atlas é um arquivo só, mas quando servido por HTTP ele também precisa ser
// instalável e abrir sem rede. Estes testes cobrem os arquivos que o build emite
// ao lado do artefato — quebrar qualquer um deles não aparece na tela, só some
// silenciosamente a instalação ou o funcionamento offline.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readBuffer = (file) => fs.readFileSync(path.join(ROOT, file));

const build = spawnSync(process.execPath, ['scripts/build.cjs'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
assert.equal(build.status, 0, `O build falhou.\n${build.stderr}`);

const html = read('atlas-195.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const serviceWorker = read('sw.js');
const releaseManifest = JSON.parse(read('release-manifest.json'));
const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

function expectedVersion() {
  const hash = crypto.createHash('sha256');
  [
    ['atlas-195.html', readBuffer('atlas-195.html')],
    ['manifest.webmanifest', readBuffer('manifest.webmanifest')],
    ...ICONS.map((icon) => [icon, readBuffer(icon)]),
    ['src/sw.js', readBuffer('src/sw.js')],
  ].forEach(([name, contents]) => hash.update(name).update('\0').update(contents).update('\0'));
  return hash.digest('hex').slice(0, 12);
}

// Dimensões vêm do IHDR, os primeiros bytes de todo PNG.
function pngSize(file) {
  const buffer = fs.readFileSync(path.join(ROOT, file));
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${file} não é um PNG válido.`
  );
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('o manifesto descreve um app instalável', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './atlas-195.html', 'O app instalado precisa abrir direto no artefato.');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.name && manifest.short_name, 'Nome e nome curto são obrigatórios.');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);

  // Chrome exige 192 e 512 para oferecer a instalação; maskable evita que o
  // ícone apareça recortado no Android.
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'), 'Falta o ícone de 192.');
  assert.ok(sizes.includes('512x512'), 'Falta o ícone de 512.');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'Falta um ícone maskable.');

  manifest.icons.forEach((icon) => {
    const file = icon.src.replace(/^\.\//, '');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(file), { width, height }, `${file} não tem o tamanho declarado.`);
  });
});

test('o service worker sai completo e versionado por todo conteúdo publicável', () => {
  assert.doesNotMatch(serviceWorker, /\{\{[A-Z_]+\}\}/, 'Placeholder não resolvido no service worker.');

  const expected = expectedVersion();
  assert.match(
    serviceWorker,
    new RegExp(`const VERSION = '${expected}'`),
    'A versão do cache precisa acompanhar HTML, manifesto, ícones e a lógica do worker.'
  );

  // Sem handler de fetch o navegador nem oferece instalar o app.
  assert.match(serviceWorker, /addEventListener\('fetch'/, 'O service worker precisa tratar fetch.');
  assert.match(serviceWorker, /addEventListener\('install'/);
  assert.match(serviceWorker, /addEventListener\('activate'/);
  assert.match(serviceWorker, /await cache\.put\(request, response\.clone\(\)\)/,
    'A gravação em cache precisa terminar antes da resposta assíncrona encerrar.');

  const assets = JSON.parse(serviceWorker.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
  assert.ok(assets.includes('./atlas-195.html'), 'O artefato precisa ser pré-cacheado.');
  assets.forEach((asset) => {
    const file = asset.replace(/^\.\//, '');
    assert.ok(fs.existsSync(path.join(ROOT, file)), `Asset pré-cacheado inexistente: ${file}. O install falharia inteiro.`);
  });
});

test('o manifesto de release registra hash e tamanho de cada arquivo publicado', () => {
  assert.equal(releaseManifest.schemaVersion, 1);
  assert.equal(releaseManifest.version, expectedVersion());
  const expectedFiles = ['atlas-195.html', 'manifest.webmanifest', ...ICONS, 'sw.js'].sort();
  assert.deepEqual(Object.keys(releaseManifest.files).sort(), expectedFiles);
  expectedFiles.forEach((file) => {
    const contents = readBuffer(file);
    assert.deepEqual(releaseManifest.files[file], {
      bytes: contents.length,
      sha256: crypto.createHash('sha256').update(contents).digest('hex'),
    }, `${file} diverge do manifesto de release.`);
  });
});

test('o HTML aponta para o manifesto, o ícone e os metadados de compartilhamento', () => {
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/apple-touch-icon\.png">/);
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/, 'O favicon embutido some se o arquivo for aberto do disco.');
  assert.match(html, /<meta name="description" content="[^"]{60,}">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+\/icon-512\.png">/, 'og:image precisa ser absoluto.');
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/, 'Placeholder não resolvido no HTML.');
});

test('a CSP libera o mínimo para instalar e nada além disso', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /manifest-src 'self'/, 'Sem isso o navegador ignora o manifesto.');
  assert.match(csp, /worker-src 'self'/, 'Sem isso o service worker não registra.');
  // A promessa mudou junto com a conta opcional, e o teste mudou com ela: em vez
  // de "não fala com ninguém", agora é "fala com exatamente um endereço". Quem
  // treina sem entrar continua sem tráfego algum, porque nada dispara pedido sem
  // sessão. Uma segunda origem aqui — analytics, CDN, curinga — reprova.
  const backend = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'cloud.json'), 'utf8')
  );
  const permitido = new URL(backend.url).origin;
  const connect = csp.match(/connect-src ([^;]+)/);
  assert.ok(connect, 'A diretiva connect-src sumiu.');
  assert.deepEqual(
    connect[1].trim().split(/\s+/),
    [permitido],
    'connect-src precisa listar só o backend de contas.'
  );
  assert.doesNotMatch(csp, /'unsafe-inline'|'unsafe-eval'/);
  assert.doesNotMatch(csp, /script-src[^;]*\bhttps?:/, 'Nenhum script externo pode ser autorizado.');
});

test('a troca de versão avisa a aba aberta, e só quando havia versão anterior', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw.js'), 'utf8');

  // A aba aberta no momento da publicação está rodando o artefato antigo, servido
  // do cache antes da troca. Sem aviso, recarregar não mostra diferença e a
  // publicação parece ter falhado.
  assert.match(fonte, /postMessage\(\{ atlas: 'versao-nova'/, 'O service worker precisa avisar as abas abertas.');
  assert.match(
    fonte,
    /if \(!anteriores\.length\) return;/,
    'Numa primeira instalação não existe versão nova: o aviso viraria ruído.'
  );

  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(app, /evento\.data\.atlas === 'versao-nova'/, 'O app precisa escutar o aviso.');
  assert.match(app, /function showUpdateNotice/, 'O app precisa mostrar o aviso com um botão de recarregar.');
});

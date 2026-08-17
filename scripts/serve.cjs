const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.ATLAS_PORT || 8743);
// O tipo importa: o navegador recusa registrar um service worker que não chegue
// como JavaScript, e ignora o manifesto sem o tipo próprio.
const types = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
// O artefato passa de 5 MB sem compressão. Localmente isso não aparece, mas é
// o mesmo arquivo que vai para qualquer hospedagem: brotli derruba para ~1,1 MB
// e gzip para ~1,7 MB, sem dependência nenhuma.
const COMPRESSIBLE = new Set(['.html', '.json', '.js', '.css', '.svg', '.webmanifest']);
// Qualidade 5 comprime 5 MB em milissegundos e chega a ~1,2 MB; a qualidade
// padrão do brotli (11) economiza pouco mais e leva dezenas de segundos por
// requisição, o que trava a primeira abertura do artefato.
const ENCODERS = [
  {
    name: 'br',
    compress: (body) => zlib.brotliCompressSync(body, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
      },
    }),
  },
  { name: 'gzip', compress: (body) => zlib.gzipSync(body, { level: 6 }) },
];
// O mesmo arquivo é pedido a cada recarga; comprimir de novo só queima CPU.
const compressed = new Map();
const refining = new Set();

function compressCached(file, stamp, encoder, body) {
  const key = `${file}|${stamp}|${encoder.name}`;
  const hit = compressed.get(key);
  if (hit) return hit;
  const payload = encoder.compress(body);
  compressed.set(key, payload);
  if (compressed.size > 32) compressed.delete(compressed.keys().next().value);
  refine(key, encoder, body);
  return payload;
}

// A primeira resposta sai na qualidade rápida; o brotli máximo tira mais 0,4 MB
// mas custa segundos, então roda depois, fora do caminho da requisição, e passa
// a valer da recarga seguinte em diante.
function refine(key, encoder, body) {
  if (encoder.name !== 'br' || refining.has(key)) return;
  refining.add(key);
  zlib.brotliCompress(body, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
    },
  }, (error, best) => {
    refining.delete(key);
    if (error || !compressed.has(key)) return;
    if (best.length < compressed.get(key).length) compressed.set(key, best);
  });
}

function negotiateEncoding(header) {
  const accepted = String(header || '')
    .split(',')
    .map((part) => {
      const [name, ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => parameter.trim())
        .filter((parameter) => parameter.startsWith('q='))
        .map((parameter) => Number(parameter.slice(2)))[0];
      return { name: name.toLowerCase(), quality: Number.isFinite(quality) ? quality : 1 };
    })
    .filter((entry) => entry.name && entry.quality > 0);
  return ENCODERS.find((encoder) => accepted.some((entry) => entry.name === encoder.name)) || null;
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'atlas-195.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Acesso negado');
    return;
  }
  fs.readFile(file, (error, body) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Arquivo indisponível');
      return;
    }
    const extension = path.extname(file);
    const headers = {
      'Content-Type': types[extension] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Encoding',
    };
    const encoder = COMPRESSIBLE.has(extension) ? negotiateEncoding(request.headers['accept-encoding']) : null;
    let payload = body;
    if (encoder) {
      try {
        const stamp = fs.statSync(file).mtimeMs;
        payload = compressCached(file, stamp, encoder, body);
        headers['Content-Encoding'] = encoder.name;
      } catch (_) {
        payload = body;
      }
    }
    headers['Content-Length'] = String(payload.length);
    if (request.method === 'HEAD') {
      response.writeHead(200, headers).end();
      return;
    }
    response.writeHead(200, headers);
    response.end(payload);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Atlas 195 disponível em http://127.0.0.1:${port}/atlas-195.html`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

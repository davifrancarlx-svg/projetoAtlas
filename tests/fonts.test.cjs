'use strict';

// As famílias do Atlas vão embutidas no artefato. Se elas saírem, o CSS continua
// pedindo "Instrument Serif" e "IBM Plex", o navegador cai no Georgia e no
// system-ui, e a identidade visual desaparece sem nenhum erro aparecer.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fonts', 'fonts.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'atlas-195.html'), 'utf8');

test('a proveniência das fontes está registrada e confere', () => {
  assert.equal(manifest.license, 'SIL Open Font License 1.1');
  assert.ok(manifest.faces.length >= 5, 'Faltam faces no manifesto.');

  manifest.faces.forEach((face) => {
    const file = path.join(ROOT, 'data', 'fonts', face.file);
    const bytes = fs.readFileSync(file);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, face.sha256, `${face.file} divergiu do hash registrado.`);
    assert.match(face.url, /^https:\/\/fonts\.gstatic\.com\//, 'A origem precisa ficar registrada.');
    // woff2 começa com a assinatura "wOF2".
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', `${face.file} não é woff2.`);
  });
});

test('as fontes viajam dentro do artefato, sem origem externa', () => {
  const faces = html.match(/@font-face\s*\{/g) || [];
  assert.equal(faces.length, manifest.faces.length, 'O artefato precisa declarar todas as faces.');

  const embutidas = html.match(/src: url\(data:font\/woff2;base64,/g) || [];
  assert.equal(embutidas.length, manifest.faces.length, 'Toda face precisa vir em base64.');

  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'Nenhuma fonte pode ser buscada da rede.');

  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /font-src data:/, 'A CSP precisa autorizar as fontes embutidas.');
  assert.doesNotMatch(csp, /font-src[^;]*https?:/, 'Nenhuma origem externa de fonte pode ser autorizada.');
});

test('as licenças OFL viajam junto com as fontes', () => {
  // A OFL obriga a distribuir a licença junto do software de fonte.
  assert.match(html, /IBM Plex — SIL Open Font License 1\.1/);
  assert.match(html, /Instrument Serif — SIL Open Font License 1\.1/);
  assert.match(html, /SIL OPEN FONT LICENSE Version 1\.1/i);
});

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
// O orçamento existe para barrar crescimento acidental, não para congelar o
// produto: subir um teto é decisão consciente e deve vir junto do recurso que a
// justifica. `src/app.js` foi de 140 para 150 KiB com a revisão focada e o
// contraste didático do erro (2026-08-21).
const LIMITS = {
  // 8 → 12 KiB com quatro estilos de timbre, o som de fim de série e o painel
  // de preferências que o próprio módulo monta (2026-09-16). O painel podia ter
  // ido para `app.js`, que estava em 97% do teto dele: som mora com o som.
  'src/audio.js': 12 * 1024,
  'src/study.js': 8 * 1024,
  // A conta saiu de app.js em 2026-09-16 para o app principal voltar a ter
  // folga: o orçamento dela é próprio, não uma transferência de bytes.
  'src/account.js': 24 * 1024,
  // A aba Atlas saiu de app.js na mesma linha de raciocínio, junto do filtro
  // por área e da moeda na ficha (2026-09-16).
  'src/atlas.js': 20 * 1024,
  'atlas-195.html': 5.25 * 1024 * 1024,
  'src/app.js': 150 * 1024,
  // 80 → 88 KiB com as três variantes de "país → mapa" (mapa, silhueta e
  // fronteira): o núcleo é lógica pura e não tem bloco que valha separar sem
  // espalhar as regras do jogo por mais arquivos.
  'src/core.js': 88 * 1024,
  'src/styles.css': 55 * 1024,
};

let failed = false;
for (const [file, limit] of Object.entries(LIMITS)) {
  const bytes = fs.statSync(path.join(ROOT, file)).size;
  const percent = bytes / limit * 100;
  console.log(`${file}: ${(bytes / 1024).toFixed(1)} KiB de ${(limit / 1024).toFixed(1)} KiB (${percent.toFixed(1)}%)`);
  if (bytes > limit) {
    failed = true;
    console.error(`${file} excedeu o orçamento em ${((bytes - limit) / 1024).toFixed(1)} KiB.`);
  }
}

if (failed) process.exitCode = 1;

'use strict';

// Gera os ícones do app (PWA, aba do navegador e tela inicial do iOS).
//
// O projeto não tem dependências e não vai ganhar uma só por causa de ícone:
// as formas são rasterizadas aqui mesmo, com supersampling para suavizar as
// bordas, e o PNG é escrito com o zlib nativo. Rode `npm run icons` depois de
// mexer na paleta; a saída é determinística e fica versionada em data/icons/.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'data', 'icons');

// Mesma paleta do app: fundo do oceano e o dourado da marca.
const OCEAN = [7, 24, 33, 255];
const PANEL = [13, 34, 46, 255];
const GOLD = [244, 193, 82, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;  // profundidade
  header[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- desenho -------------------------------------------------------------
// Cada forma responde "este ponto está dentro?"; o supersampling converte isso
// em cobertura fracionária, que é o que suaviza a borda.

const inRoundedRect = (x, y, size, radius) => {
  const dx = Math.max(radius - x, 0, x - (size - radius));
  const dy = Math.max(radius - y, 0, y - (size - radius));
  return Math.hypot(dx, dy) <= radius;
};

const onCircle = (x, y, cx, cy, r, width) => Math.abs(Math.hypot(x - cx, y - cy) - r) <= width / 2;

const inCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;

// Meridiano: elipse de mesmo raio vertical e raio horizontal variável.
const onMeridian = (x, y, cx, cy, rx, ry, width) => {
  if (rx < 0.5) return Math.abs(x - cx) <= width / 2 && Math.abs(y - cy) <= ry;
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const distance = Math.hypot(nx, ny) - 1;
  return Math.abs(distance) * Math.min(rx, ry) <= width / 2;
};

const onParallel = (x, y, cx, cy, r, offset, width) =>
  Math.abs(y - (cy + offset)) <= width / 2 && inCircle(x, y, cx, cy, r);

function blend(target, index, color, coverage) {
  if (coverage <= 0) return;
  const alpha = coverage * (color[3] / 255);
  for (let c = 0; c < 3; c++) {
    target[index + c] = Math.round(target[index + c] * (1 - alpha) + color[c] * alpha);
  }
  target[index + 3] = Math.round(Math.min(255, target[index + 3] + alpha * 255));
}

function renderIcon(size, { bleed }) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4;
  const step = 1 / samples;
  const center = size / 2;

  // Ícone comum ganha respiro nas bordas; maskable é sangrado e mantém o globo
  // dentro da zona segura, porque o sistema recorta o que passar disso.
  const padding = bleed ? 0 : size * 0.06;
  const radius = bleed ? 0 : size * 0.22;
  const globe = (bleed ? size * 0.30 : size * 0.34);
  const stroke = Math.max(2, size * 0.035);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      let background = 0;
      let disc = 0;
      let lines = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;

          if (bleed) background += 1;
          else if (px >= padding && py >= padding && px <= size - padding && py <= size - padding
            && inRoundedRect(px - padding, py - padding, size - padding * 2, radius)) background += 1;

          if (inCircle(px, py, center, center, globe)) disc += 1;

          // Os meridianos são recortados ao disco: perto dos polos a distância
          // aproximada da elipse engrossa o traço e ele vazaria para fora do globo.
          const dentroDoGlobo = inCircle(px, py, center, center, globe + stroke / 2);
          const isLine = onCircle(px, py, center, center, globe, stroke)
            || (dentroDoGlobo && onMeridian(px, py, center, center, globe * 0.48, globe, stroke * 0.8))
            || (dentroDoGlobo && onMeridian(px, py, center, center, 0, globe, stroke * 0.8))
            || onParallel(px, py, center, center, globe, 0, stroke * 0.8)
            || onParallel(px, py, center, center, globe, -globe * 0.5, stroke * 0.7)
            || onParallel(px, py, center, center, globe, globe * 0.5, stroke * 0.7);
          if (isLine) lines += 1;
        }
      }

      const total = samples * samples;
      blend(pixels, index, bleed ? OCEAN : PANEL, background / total);
      blend(pixels, index, OCEAN, (disc / total) * 0.55);
      blend(pixels, index, GOLD, lines / total);
    }
  }
  return encodePng(size, size, pixels);
}

const targets = [
  { file: 'icon-192.png', size: 192, bleed: false },
  { file: 'icon-512.png', size: 512, bleed: false },
  { file: 'icon-maskable-512.png', size: 512, bleed: true },
  { file: 'apple-touch-icon.png', size: 180, bleed: true },
];

fs.mkdirSync(outputDir, { recursive: true });
for (const target of targets) {
  const png = renderIcon(target.size, { bleed: target.bleed });
  fs.writeFileSync(path.join(outputDir, target.file), png);
  console.log(`${target.file}: ${target.size}x${target.size}, ${(png.length / 1024).toFixed(1)} KiB`);
}

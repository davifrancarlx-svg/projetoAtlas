'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'indicators.json'), 'utf8'));
const currentYear = new Date().getUTCFullYear();
const strict = process.argv.includes('--strict');
const entries = [
  { label: 'IDH/PNUD', year: data.meta.idh.ano, maxAge: 5 },
  ...Object.values(data.meta.bancoMundial.indicadores).map((item) => ({
    label: `${item.rotulo}/Banco Mundial`, year: item.anoPredominante, maxAge: 4,
  })),
];

const stale = entries.filter((item) => !Number.isInteger(item.year) || currentYear - item.year > item.maxAge);
entries.forEach((item) => console.log(`${item.label}: ${item.year} (${currentYear - item.year} ano(s) de defasagem)`));
if (stale.length) {
  const message = `Fontes possivelmente desatualizadas: ${stale.map((item) => item.label).join(', ')}. Rode npm run indicators.`;
  if (strict) {
    console.error(message);
    process.exitCode = 1;
  } else console.warn(message);
}

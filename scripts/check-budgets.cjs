'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LIMITS = {
  'atlas-195.html': 5.25 * 1024 * 1024,
  'src/app.js': 140 * 1024,
  'src/core.js': 80 * 1024,
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

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};
const baseUrl = (argument('--base-url') || process.env.ATLAS_BASE_URL || 'https://atlas-195.lovable.app').replace(/\/+$/, '');
const manifestPath = argument('--manifest') || path.join(ROOT, 'release-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

async function main() {
  let failed = false;
  for (const [file, expected] of Object.entries(manifest.files)) {
    const url = `${baseUrl}/${encodeURI(file)}`;
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    } catch (error) {
      console.error(`${file}: rede indisponível (${error.message})`);
      failed = true;
      continue;
    }
    if (!response.ok) {
      console.error(`${file}: HTTP ${response.status}`);
      failed = true;
      continue;
    }
    const contents = Buffer.from(await response.arrayBuffer());
    const actual = crypto.createHash('sha256').update(contents).digest('hex');
    const ok = contents.length === expected.bytes && actual === expected.sha256;
    console.log(`${ok ? 'OK' : 'DIVERGE'} ${file}: ${contents.length} bytes · ${actual}`);
    if (!ok) failed = true;
  }
  if (failed) process.exitCode = 1;
  else console.log(`Produção confere com o release ${manifest.version}.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));

function sha256(source) {
  return `'sha256-${crypto.createHash('sha256').update(source).digest('base64')}'`;
}

function loadCountries() {
  const countries = readJson('src/countries.base.json');
  const contentPolicy = readJson('src/content-policy.json');
  const flagFile = readJson('data/flags.json');
  const flags = flagFile && flagFile.flags;
  if (!flags || Object.keys(flags).length !== 195) {
    throw new Error('data/flags.json precisa conter exatamente 195 bandeiras.');
  }
  const geometryFile = path.join(root, 'data', 'map-geometry.json');
  if (!fs.existsSync(geometryFile)) {
    throw new Error('data/map-geometry.json ausente. Execute o gerador cartográfico antes do build.');
  }

  const geometry = JSON.parse(fs.readFileSync(geometryFile, 'utf8'));
  const entries = Array.isArray(geometry) ? geometry : geometry.countries || geometry.features || [];
  const byId = new Map(entries.map((item) => [item.id, item]));
  const merged = countries.map((country) => {
    const map = byId.get(country.id);
    if (!map || !map.d || !Array.isArray(map.c) || !Array.isArray(map.b)) {
      throw new Error(`Geometria inválida ou ausente para ${country.id} (${country.n}).`);
    }
    if (typeof flags[country.id] !== 'string' || !flags[country.id].startsWith('data:image/svg+xml;base64,')) {
      throw new Error(`Bandeira SVG inválida ou ausente para ${country.id} (${country.n}).`);
    }
    const policy = contentPolicy[country.id] || {};
    const nameAliases = policy.nameAliases ?? country.alt ?? [];
    const capitalAliases = policy.capitalAliases ?? country.calt ?? [];
    const alternateCapitals = policy.alternateCapitals ?? [];
    const formerCapitalNames = policy.formerCapitalNames ?? [];
    const otherSeats = policy.otherSeats ?? [];
    const countryHistoricNames = policy.countryHistoricNames ?? [];
    const countryAmbiguousNames = policy.countryAmbiguousNames ?? [];
    const countryColloquialisms = policy.countryColloquialisms ?? [];
    const countryMistakes = policy.countryMistakes ?? [];
    const capitalMistakes = policy.capitalMistakes ?? [];
    const aliases = [
      ...nameAliases.map((value) => ({ value, field: 'country', type: 'equivalent' })),
      ...capitalAliases.map((value) => ({ value, field: 'capital', type: 'transliteration' })),
      ...alternateCapitals.map((value) => ({ value, field: 'capital', type: 'official' })),
      ...formerCapitalNames.map((value) => ({ value, field: 'capital', type: 'historic' })),
      ...otherSeats.map((value) => ({ value, field: 'capital', type: 'administrative-seat' })),
      ...countryHistoricNames.map((value) => ({ value, field: 'country', type: 'historic' })),
      ...countryAmbiguousNames.map((value) => ({ value, field: 'country', type: 'common-mistake' })),
      ...countryColloquialisms.map((value) => ({ value, field: 'country', type: 'common-mistake' })),
      ...countryMistakes.map((value) => ({ value, field: 'country', type: 'common-mistake' })),
      ...capitalMistakes.map((value) => ({ value, field: 'capital', type: 'common-mistake' })),
    ];
    const region = policy.region || (country.r === 'América do Norte e Central'
      ? 'América do Norte, Central e Caribe'
      : country.r);
    const normalizedContent = {
      ...country,
      cap: policy.capital || country.cap,
      r: region,
      aliases,
      alternateCapitals,
      formerCapitalNames,
      otherSeats,
      countryHistoricNames,
      countryAmbiguousNames,
      countryColloquialisms,
      countryMistakes,
      capitalMistakes,
      capitalType: policy.capitalType || 'official',
      capitalNote: policy.capitalNote || '',
    };
    delete normalizedContent.alt;
    delete normalizedContent.calt;
    return {
      ...normalizedContent,
      d: map.d,
      c: map.c,
      b: map.b,
      a: Number.isFinite(map.a) ? map.a : country.a,
      geomParts: map.parts || 1,
      hitPoints: Array.isArray(map.hitPoints) ? map.hitPoints : [],
      f: flags[country.id],
    };
  });

  if (merged.length !== 195 || new Set(merged.map((c) => c.id)).size !== 195) {
    throw new Error('O dataset final precisa conter exatamente 195 IDs únicos.');
  }
  return { countries: merged, mapMeta: geometry.meta || {} };
}

function replace(template, marker, value) {
  if (!template.includes(marker)) throw new Error(`Placeholder ausente: ${marker}`);
  return template.replace(marker, () => value);
}

const template = read('src/index.template.html');
const css = read('src/styles.css').trim();
const core = read('src/core.js').trim();
const app = read('src/app.js').trim();
const { countries, mapMeta } = loadCountries();
const data = `const MAP_META = ${JSON.stringify(mapMeta)};\nconst DATA = ${JSON.stringify(countries)};`;
const flagLicense = read('data/flag-icons/LICENSE').trim().replace(/--/g, '—');
const licenses = `flag-icons 7.5.0 — MIT license\n\n${flagLicense}`;
let output = template;
output = replace(output, '{{CSS}}', css);
output = replace(output, '{{DATA}}', data);
output = replace(output, '{{CORE}}', core);
output = replace(output, '{{APP}}', app);
output = replace(output, '{{LICENSES}}', licenses);
const inlineStyles = [...output.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
const inlineScripts = [...output.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
const csp = [
  "default-src 'none'",
  `style-src ${inlineStyles.map(sha256).join(' ')}`,
  `script-src ${inlineScripts.map(sha256).join(' ')}`,
  "img-src data:",
  "font-src 'none'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');
output = replace(output, '{{CSP}}', csp);
if (/\{\{[A-Z_]+\}\}/.test(output)) throw new Error('Há placeholders não resolvidos no template.');

fs.writeFileSync(path.join(root, 'atlas-195.html'), `${output.trim()}\n`, 'utf8');
const stats = fs.statSync(path.join(root, 'atlas-195.html'));
console.log(`atlas-195.html gerado: ${countries.length} países, ${(stats.size / 1024).toFixed(1)} KiB.`);

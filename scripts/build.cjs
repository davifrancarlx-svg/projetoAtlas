const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// O parser HTML normaliza quebras de linha (CRLF e CR viram LF) antes de o
// navegador calcular o hash CSP de cada bloco inline. Ler tudo já normalizado é
// o que mantém o hash gravado aqui idêntico ao que o navegador calcula, mesmo
// num checkout que trouxe CRLF — caso contrário a CSP bloqueia o próprio app.
const normalizeNewlines = (text) => text.replace(/\r\n?/g, '\n');
const read = (file) => normalizeNewlines(fs.readFileSync(path.join(root, file), 'utf8'));
const readJson = (file) => JSON.parse(read(file));

function sha256(source) {
  return `'sha256-${crypto.createHash('sha256').update(source).digest('base64')}'`;
}

function loadCountries() {
  const countries = readJson('src/countries.base.json');
  const contentPolicy = readJson('src/content-policy.json');
  const indicators = readJson('data/indicators.json');
  const contextAreas = readJson('src/context-areas.json');
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
    if (typeof country.sr !== 'string' || !country.sr) {
      throw new Error(`Subregião (sr) ausente para ${country.id} (${country.n}).`);
    }
    // População e IDH são dados complementares da ficha: entram no país mas
    // nunca viram resposta de pergunta. Quem não tem o dado carrega a nota que
    // explica por quê — é isso que o gerador de indicadores exige para deixar
    // um país sem número.
    const indicator = indicators.paises[country.id];
    if (!indicator) {
      throw new Error(`Indicadores ausentes para ${country.id} (${country.n}). Rode "npm run indicators".`);
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
    // Uma correção editorial de região (ex.: Chipre na Ásia por M49) vale para a
    // subregião também — não faria sentido a subregião discordar do continente.
    const subregion = policy.region || country.sr;
    const normalizedContent = {
      ...country,
      cap: policy.capital || country.cap,
      r: region,
      sr: subregion,
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
      pb: Array.isArray(map.pb) && map.pb.length === 4 ? map.pb : map.b,
      a: Number.isFinite(map.a) ? map.a : country.a,
      geomParts: map.parts || 1,
      hitPoints: Array.isArray(map.hitPoints) ? map.hitPoints : [],
      f: flags[country.id],
      ...indicator,
    };
  });

  if (merged.length !== 195 || new Set(merged.map((c) => c.id)).size !== 195) {
    throw new Error('O dataset final precisa conter exatamente 195 IDs únicos.');
  }
  return {
    countries: merged,
    mapMeta: geometry.meta || {},
    territories: loadTerritories(merged),
    indicatorMeta: indicators.meta,
    contextAreas: loadContextAreas(geometry.meta, contextAreas, merged),
  };
}

// As feições fora dos 195: dependências com soberano claro, áreas disputadas e
// áreas sem soberania. Antes eram uma mancha cinza anônima; identificá-las é o
// que permite pintar a Groenlândia como território dinamarquês e dizer o que é
// cada uma. Nenhuma vira resposta de pergunta — continuam fora do escopo.
function loadContextAreas(mapMeta, classificacao, countries) {
  const areas = Array.isArray(mapMeta.contextAreas) ? mapMeta.contextAreas : [];
  if (!areas.length) throw new Error('Geometria sem contextAreas. Rode o gerador cartográfico.');
  const conhecidos = new Set(countries.map((country) => country.id));
  const GRUPOS = new Set(['dependencia', 'disputado', 'sem-soberania']);

  return areas.map((area) => {
    const registro = classificacao.areas[area.code];
    if (!registro) {
      throw new Error(`${area.code} (${area.n}) não está classificada em src/context-areas.json.`);
    }
    if (!GRUPOS.has(registro.grupo)) throw new Error(`${area.code}: grupo inválido "${registro.grupo}".`);
    if (registro.grupo === 'dependencia') {
      if (!conhecidos.has(registro.of)) throw new Error(`${area.code} aponta para um soberano fora dos 195: ${registro.of}.`);
      if (registro.nota) throw new Error(`${area.code}: dependência não precisa de nota de status.`);
    } else {
      // Tomar partido numa área disputada seria afirmar geopolítica que o
      // projeto não tem como sustentar; a nota explica em vez de atribuir.
      if (registro.of) throw new Error(`${area.code}: área ${registro.grupo} não pode receber soberano.`);
      if (!registro.nota) throw new Error(`${area.code}: área ${registro.grupo} precisa explicar o próprio status.`);
    }
    return {
      code: area.code,
      n: registro.n || area.n,
      grupo: registro.grupo,
      d: area.d,
      b: area.b,
      ...(registro.of ? { of: registro.of } : {}),
      ...(registro.nota ? { nota: registro.nota } : {}),
    };
  });
}

// Territórios não soberanos que o Natural Earth entrega dentro do polígono de
// outro país. Eles nunca viram resposta do quiz: servem para o mapa e o Atlas
// dizerem o que está sob o cursor em vez de chamar tudo pelo nome do soberano.
function loadTerritories(countries) {
  const territories = readJson('src/territories.json');
  if (!Array.isArray(territories)) throw new Error('src/territories.json precisa ser uma lista.');
  const known = new Set(countries.map((country) => country.id));
  const ids = new Set();
  territories.forEach((territory) => {
    const label = territory.id || territory.n || '(sem id)';
    if (!/^[A-Z]{2,3}$/.test(territory.id || '')) throw new Error(`Território com ID inválido: ${label}.`);
    if (ids.has(territory.id)) throw new Error(`Território duplicado: ${label}.`);
    ids.add(territory.id);
    if (known.has(territory.id)) throw new Error(`${label} é um dos 195 países e não pode ser território.`);
    if (!known.has(territory.of)) throw new Error(`${label} aponta para um soberano inexistente: ${territory.of}.`);
    if (!territory.n || !territory.cap || !territory.r) throw new Error(`${label} precisa de nome, capital e região.`);
    if (!territory.sr) throw new Error(`${label} precisa de uma subregião (sr).`);
    const box = territory.box;
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) {
      throw new Error(`${label} precisa de um box [oeste, sul, leste, norte] em graus.`);
    }
    if (box[0] >= box[2] || box[1] >= box[3] || box[0] < -180 || box[2] > 180 || box[1] < -90 || box[3] > 90) {
      throw new Error(`${label} tem um box geográfico inválido.`);
    }
    const point = territory.p;
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
      throw new Error(`${label} precisa de um ponto de rótulo [longitude, latitude].`);
    }
    if (point[0] < box[0] || point[0] > box[2] || point[1] < box[1] || point[1] > box[3]) {
      throw new Error(`${label} tem o ponto de rótulo fora do próprio box.`);
    }
  });
  return territories;
}

// split/join troca todas as ocorrências: {{BASE_URL}} aparece mais de uma vez e
// String.replace com texto literal só substituiria a primeira, deixando um
// placeholder cru no HTML publicado.
function replace(template, marker, value) {
  if (!template.includes(marker)) throw new Error(`Placeholder ausente: ${marker}`);
  return template.split(marker).join(value);
}

// As fontes são embutidas em base64 porque a CSP não autoriza origem externa e
// o artefato precisa abrir sem rede. Sem isso, as famílias declaradas no CSS só
// apareceriam para quem já as tivesse instaladas — na prática, quase ninguém.
function embedFonts() {
  const manifest = readJson('data/fonts/fonts.json');
  const faces = manifest.faces.map((face) => {
    const file = path.join(root, 'data', 'fonts', face.file);
    const bytes = fs.readFileSync(file);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (digest !== face.sha256) {
      throw new Error(`${face.file} não confere com o hash registrado em fonts.json.`);
    }
    return [
      '@font-face {',
      `  font-family: "${face.family}";`,
      `  font-style: ${face.style};`,
      `  font-weight: ${face.weight};`,
      '  font-display: swap;',
      `  unicode-range: U+0000-00FF;`,
      `  src: url(data:font/woff2;base64,${bytes.toString('base64')}) format("woff2");`,
      '}',
    ].join('\n');
  });
  return `${faces.join('\n\n')}\n\n`;
}

const template = read('src/index.template.html');
const css = embedFonts() + read('src/styles.css').trim();
const core = read('src/core.js').trim();
const app = read('src/app.js').trim();
const themeBoot = read('src/theme-boot.js').trim();
// A configuração de conta entra no artefato e também define a única origem que
// a CSP vai autorizar. Se o arquivo sumir ou vier incompleto, o build segue: o
// app apenas não mostra a área de conta e a CSP volta a proibir qualquer rede.
const cloud = (() => {
  const config = readJson('src/cloud.json');
  if (!config || typeof config.url !== 'string' || !config.anonKey || !config.tabela) return null;
  const origin = new URL(config.url).origin;
  if (!origin.startsWith('https://')) throw new Error('src/cloud.json precisa de uma URL https.');
  return { url: origin, anonKey: config.anonKey, tabela: config.tabela };
})();
const cloudOrigin = cloud ? cloud.url : "'none'";
const { countries, mapMeta, territories, indicatorMeta, contextAreas } = loadCountries();
// A silhueta fundida continua no arquivo de geometria, onde o gerador a valida,
// mas não viaja no artefato: quem desenha agora são as áreas identificadas, e
// levar as duas duplicaria 285 KB de contorno para o mesmo desenho.
const mapMetaEnxuto = { ...mapMeta };
if (mapMetaEnxuto.contextLand) {
  mapMetaEnxuto.contextLand = { ...mapMetaEnxuto.contextLand };
  delete mapMetaEnxuto.contextLand.d;
}
delete mapMetaEnxuto.contextAreas;

const data = `const MAP_META = ${JSON.stringify(mapMetaEnxuto)};\n`
  + `const DATA = ${JSON.stringify(countries)};\n`
  + `const TERRITORIES = ${JSON.stringify(territories)};\n`
  + `const CONTEXT_AREAS = ${JSON.stringify(contextAreas)};\n`
  + `const INDICATOR_META = ${JSON.stringify(indicatorMeta)};\n`
  + `const CLOUD = ${JSON.stringify(cloud)};`;
const flagLicense = read('data/flag-icons/LICENSE').trim().replace(/--/g, '—');
// A OFL exige que a licença acompanhe a fonte redistribuída; as famílias vão
// embutidas no artefato, então o texto vai junto dentro dele.
const licenses = [
  `flag-icons 7.5.0 — MIT license\n\n${flagLicense}`,
  `IBM Plex — SIL Open Font License 1.1\n\n${read('data/fonts/LICENSE-ibm-plex.txt').trim()}`,
  `Instrument Serif — SIL Open Font License 1.1\n\n${read('data/fonts/LICENSE-instrument-serif.txt').trim()}`,
].join('\n\n\n');
let output = template;
output = replace(output, '{{CSS}}', css);
output = replace(output, '{{DATA}}', data);
output = replace(output, '{{THEME}}', themeBoot);
output = replace(output, '{{CORE}}', core);
output = replace(output, '{{APP}}', app);
output = replace(output, '{{LICENSES}}', licenses);

// Favicon: mesmo desenho dos ícones, em SVG, embutido como data: URI para não
// depender de arquivo ao lado quando o Atlas é aberto direto do disco.
const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
  + '<rect width="64" height="64" rx="14" fill="#0d222e"/>'
  + '<g fill="none" stroke="#f4c152" stroke-width="3.5">'
  + '<circle cx="32" cy="32" r="19"/>'
  + '<ellipse cx="32" cy="32" rx="9" ry="19"/>'
  + '<path d="M13 32h38M18 22.5h28M18 41.5h28"/>'
  + '</g></svg>';
output = replace(output, '{{FAVICON}}', encodeURIComponent(favicon));

// og:image precisa de URL absoluta para os previews de link funcionarem.
const baseUrl = (process.env.ATLAS_BASE_URL || 'https://atlas-195.lovable.app').replace(/\/+$/, '');
output = replace(output, '{{BASE_URL}}', baseUrl);
// Última barreira: qualquer CR que escape até aqui deslocaria todos os hashes
// abaixo em relação ao que o navegador calcula sobre o documento já parseado.
output = normalizeNewlines(output);
const inlineStyles = [...output.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
const inlineScripts = [...output.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
const csp = [
  "default-src 'none'",
  `style-src ${inlineStyles.map(sha256).join(' ')}`,
  `script-src ${inlineScripts.map(sha256).join(' ')}`,
  // 'self' cobre os ícones servidos ao lado do artefato; data: continua sendo a
  // origem das bandeiras e do favicon embutidos.
  "img-src 'self' data:",
  // As famílias vão embutidas no próprio CSS; nenhuma origem externa é autorizada.
  "font-src data:",
  // Sem conta o app não fala com servidor nenhum. O que abre aqui é exatamente
  // uma origem — a do backend de contas — e nada mais: nem analytics, nem CDN,
  // nem a internet em geral. Quem treina sem entrar continua sem tráfego algum.
  `connect-src ${cloudOrigin}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');
output = replace(output, '{{CSP}}', csp);
if (/\{\{[A-Z_]+\}\}/.test(output)) throw new Error('Há placeholders não resolvidos no template.');

const artifact = `${output.trim()}\n`;
if (artifact.includes('\r')) throw new Error('O artefato saiu com CRLF: os hashes da CSP não sobreviveriam ao parser HTML.');
// Escrita atômica: o runner de testes roda cada arquivo em um processo próprio e
// mais de um deles reconstrói o artefato. Sem o rename, um teste poderia servir
// o HTML pela metade enquanto outro ainda escreve.
const destination = path.join(root, 'atlas-195.html');
const staging = `${destination}.tmp-${process.pid}`;
fs.writeFileSync(staging, artifact, 'utf8');
fs.renameSync(staging, destination);
const stats = fs.statSync(destination);

// --- arquivos que acompanham o artefato na hospedagem ---------------------
// O Atlas continua sendo um arquivo só e abre sozinho por file://. Estes
// complementos existem só quando ele é servido por HTTP: são o que permite
// instalar o app na tela inicial e usá-lo sem rede.
function writeIfChanged(relative, contents) {
  const file = path.join(root, relative);
  const data = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');
  if (fs.existsSync(file) && fs.readFileSync(file).equals(data)) return false;
  fs.writeFileSync(file, data);
  return true;
}

const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const iconsDir = path.join(root, 'data', 'icons');
for (const icon of ICONS) {
  const source = path.join(iconsDir, icon);
  if (!fs.existsSync(source)) throw new Error(`Ícone ausente: data/icons/${icon}. Rode "npm run icons".`);
  writeIfChanged(icon, fs.readFileSync(source));
}

const manifest = {
  name: 'Atlas 195 — bandeiras, capitais e localização',
  short_name: 'Atlas 195',
  description: 'Treino de geografia dos 195 países: bandeiras, capitais, localização e regiões. Funciona sem internet.',
  lang: 'pt-BR',
  dir: 'ltr',
  // Relativos ao próprio manifesto: o app não sabe em que domínio será servido.
  start_url: './atlas-195.html',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#071821',
  theme_color: '#0d222e',
  categories: ['education', 'games'],
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeIfChanged('manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);

// A versão do cache é o hash do artefato: publicar algo novo troca o nome do
// cache, e o service worker descarta o anterior sozinho.
const version = crypto.createHash('sha256').update(artifact).digest('hex').slice(0, 12);
const assets = ['./atlas-195.html', './manifest.webmanifest', ...ICONS.map((icon) => `./${icon}`)];
const serviceWorker = normalizeNewlines(read('src/sw.js'))
  .replace('{{VERSION}}', version)
  .replace('{{ASSETS}}', JSON.stringify(assets, null, 2));
if (/\{\{[A-Z_]+\}\}/.test(serviceWorker)) throw new Error('Placeholder não resolvido no service worker.');
writeIfChanged('sw.js', serviceWorker);
console.log(
  `atlas-195.html gerado: ${countries.length} países, ${territories.length} `
  + `${territories.length === 1 ? 'território' : 'territórios'}, ${(stats.size / 1024).toFixed(1)} KiB.`,
);

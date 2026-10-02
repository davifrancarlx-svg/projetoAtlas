'use strict';

const TABLE = 'sustainableDevelopment15_1_1';
const VARIABLE = 'forestAreaProportionLandArea2015';
const YEAR = 2025;

function urlFao(codes) {
  const url = new URL('https://fra-data.fao.org/api/explorer/data');
  url.searchParams.set('assessmentName', 'fra');
  [...new Set(codes)].sort().forEach((code) => url.searchParams.append('countryISOs[]', code));
  ['extentOfForest', TABLE].forEach((table) => url.searchParams.append('tableNames[]', table));
  url.searchParams.append('columns[]', String(YEAR));
  return url.href;
}

// A porcentagem é a publicada pela FAO. Os componentes servem para detectar
// ausência, mudança de unidade ou formato, sem transformar null/vazio em zero.
function lerFao(json, codes) {
  const countries = JSON.parse(json.toString('utf8')).fra?.[String(YEAR)];
  if (!countries) throw new Error('FAO: ciclo 2025 ausente.');
  const number = (node, label) => {
    const raw = node?.raw;
    if (raw == null || String(raw).trim() === '' || !Number.isFinite(Number(raw))) {
      throw new Error(`FAO: ${label} ausente ou inválido.`);
    }
    return Number(raw);
  };
  return Object.fromEntries(codes.map((code) => {
    const country = countries[code];
    const extent = country?.extentOfForest?.[YEAR];
    const value = number(country?.[TABLE]?.[YEAR]?.[VARIABLE], `${code}: porcentagem`);
    const forest = number(extent?.forestArea, `${code}: área florestal`);
    const land = number(extent?.totalLandArea, `${code}: área terrestre`);
    if (land <= 0 || forest < 0 || forest > land || value < 0 || value > 100 ||
        Math.abs(value - 100 * forest / land) > 0.1) {
      throw new Error(`FAO: ${code} tem porcentagem incompatível com as áreas publicadas.`);
    }
    return [code, { valor: value, ano: YEAR }];
  }));
}

module.exports = { urlFao, lerFao, TABLE, VARIABLE, YEAR };

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const countries = require('../src/countries.base.json');
const languages = require('../src/languages.json');
const policy = require('../src/content-policy.json');
const { validateEditorialMetadata } = require('./editorial-metadata.cjs');
const meta = validateEditorialMetadata(require('../src/editorial-meta.json'), countries);
const audit = require('../data/currency-code-audit.json');
const reference = require('../data/editorial-reference-audit.json');
const currencies = require('../src/currencies.json');
const type = source => source.kind === 'archived-reference' ? 'arquivo histórico'
  : source.kind === 'legal-text' ? 'texto legal, versão indicada' : 'fonte institucional ou específica';
const rows = countries.map(country => {
  const entries = meta.countries[country.id]?.sources || [];
  return { country: country.n, id: country.id,
    languages: entries.filter(s => s.field === 'Idiomas'),
    capitals: entries.filter(s => s.field === 'Capital'),
    codesVerified: currencies[country.id].moedas.every(m => audit.verified.includes(m.codigo)),
  };
});
const count = field => rows.filter(row => row[field].length).length;
const onlyArchived = field => rows.filter(row => row[field].length && row[field].every(s => s.kind === 'archived-reference')).length;
const title = `Referências individuais: idiomas ${count('languages')}/195; capitais ${count('capitals')}/195. Códigos ISO conferidos: ${rows.filter(row => row.codesVerified).length}/195 países.`;
const limits = `Somente referência histórica: idiomas de ${onlyArchived('languages')} países e capitais de ${onlyArchived('capitals')}. Uma referência não comprova todas as notas da ficha nem mudanças posteriores à versão consultada. A consulta não é a data de vigência da lei. Nomes traduzidos de moedas e notas de circulação não são certificados pela conferência de códigos ISO.`;
const link = source => `[${source.source}](${source.url}) — ${type(source)}; consulta ${source.checked}. Escopo: ${source.scope}.`;
const header = '# Documentação editorial dos 195 países\n\n' + title + '\n\n' + limits
  + '\n\nO Factbook foi encerrado em 2026. Suas cópias são identificadas como arquivos históricos, com revisão fixa e hash de cada perfil em data/editorial-reference-audit.json. Textos do Constitute são traduções das versões indicadas, não certificação de vigência atual. Fontes específicas de alterações posteriores prevalecem.\n\n'
  + `Arquivo consultado: revisão ${reference.archive.revision}; data de consulta ${reference.checked}. [Encerramento informado pela CIA](${reference.archive.retirementUrl}).\n\n`
  + 'As listas de idiomas incluem casos de uso de facto ou de trabalho e listas representativas. O estatuto e as exceções estão nas notas; compartilhar um idioma listado não significa compartilhá-lo como idioma oficial nacional. As grafias em português são escolhas editoriais; as fontes podem usar nomes e transliterações diferentes.\n';
const document = header + rows.map(row => {
  const c = countries.find(c => c.id === row.id), language = languages[row.id];
  return `\n## ${row.country} (${row.id})\n\nCapital no treino: **${c.cap}**.\n`
    + (policy[row.id]?.capitalNote ? '\nNota da capital: ' + policy[row.id].capitalNote + '\n' : '')
    + '\n' + row.capitals.map(s => '- ' + link(s)).join('\n')
    + '\n\nIdiomas listados: ' + language.oficiais.join(', ') + '.\n'
    + (language.nota ? '\nNota dos idiomas: ' + language.nota + '\n' : '')
    + '\n' + row.languages.map(s => '- ' + link(s)).join('\n')
    + '\n\nMoedas: ' + currencies[row.id].moedas.map(m => `${m.nome} (${m.codigo})`).join(', ') + '. '
    + `[Códigos ISO 4217](${audit.url}), consulta ${audit.checked}; escopo limitado aos códigos.\n`;
}).join('');
const folder = path.join(root, 'reports');
fs.mkdirSync(folder, { recursive: true });
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(folder, 'editorial-coverage.json'), JSON.stringify(rows, null, 2) + '\n');
fs.writeFileSync(path.join(folder, 'editorial-coverage.md'), header
  + '\n| País | Idiomas | Capital |\n| --- | --- | --- |\n'
  + rows.map(row => `| ${row.country} | ${row.languages.map(link).join('<br>')} | ${row.capitals.map(link).join('<br>')} |`).join('\n') + '\n');
fs.writeFileSync(path.join(root, 'docs', 'editorial-195.md'), document);
console.log(title);
console.log(limits);
if (process.argv.includes('--strict') && rows.some(row => !row.languages.length || !row.capitals.length || !row.codesVerified)) {
  console.error('Cobertura editorial incompleta.');
  process.exitCode = 1;
}

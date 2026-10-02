'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { montar } = require('./update-indicators.cjs');
const ROOT = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

function differences(before, after) {
  const changes = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    for (const field of new Set([...Object.keys(before[id] || {}), ...Object.keys(after[id] || {})])) {
      const oldValue = before[id]?.[field] ?? null, newValue = after[id]?.[field] ?? null;
      if (oldValue !== newValue) changes.push({ country: id, field, before: oldValue, after: newValue });
    }
  }
  return changes;
}

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'Atlas195-source-audit' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}
function markdown(report) {
  return ['# Auditoria das fontes do Atlas 195', '', `Consulta: ${report.checkedAt}`, '',
    'A auditoria não altera os dados educacionais. Mudanças precisam de revisão antes da importação.', '',
    ...report.results.flatMap(r => [`## ${r.source}: ${r.status}`, '', r.detail, '',
      ...(r.changes?.length ? ['| País | Campo | Antes | Depois |', '| --- | --- | --- | --- |',
        ...r.changes.map(c => `| ${c.country} | ${c.field} | ${c.before ?? 'ausente'} | ${c.after ?? 'ausente'} |`), ''] : []),
      ...(r.url ? [`Fonte: ${r.url}`, ''] : [])]),
    'Idiomas, capitais e fronteiras continuam exigindo revisão editorial. Falha de consulta não significa fonte atualizada.', '',
  ].join('\n');
}

async function audit({ fetchText = get, indicators = montar } = {}) {
  const current = read('data/indicators.json');
  const baseline = read('data/source-audit-baseline.json');
  const jobs = [
    ['Indicadores PNUD, Banco Mundial e FAO', async () => {
      const latest = await indicators();
      const changes = differences(current.paises, latest.paises);
      return { status: changes.length ? 'mudança detectada' : 'sem mudanças', changes,
        detail: `${changes.length} campos diferentes nos 195 países. Valores, anos e ausências foram comparados; hashes de consulta não contam como mudança.` };
    }],
    ['Bandeiras', async () => {
      const url = 'https://registry.npmjs.org/flag-icons/latest';
      const latest = JSON.parse(await fetchText(url)).version;
      if (!/^\d+\.\d+\.\d+$/.test(latest || '')) throw new Error('Versão npm ausente ou inválida.');
      const pinned = read('data/flags.json').meta.version;
      return { status: latest === pinned ? 'sem mudanças' : 'mudança detectada', detail: `Local: ${pinned}; registro npm: ${latest}.`, url };
    }],
    ['Cartografia', async () => {
      const url = 'https://api.github.com/repos/nvkelso/natural-earth-vector/tags?per_page=100';
      const tags = JSON.parse(await fetchText(url));
      const versions = tags.map(t => t.name).filter(v => /^v\d+\.\d+\.\d+$/.test(v));
      versions.sort((a, b) => {
        const x = a.slice(1).split('.').map(Number), y = b.slice(1).split('.').map(Number);
        return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
      });
      if (!versions.length) throw new Error('Nenhuma versão estável encontrada.');
      const pinned = read('data/map-geometry.json').meta.source.repositoryRelease;
      return { status: versions[0] === pinned ? 'sem mudanças' : 'mudança detectada', detail: `Local: ${pinned}; última tag estável: ${versions[0]}.`, url };
    }],
    ['Moedas ISO 4217', async () => {
      const url = baseline.six.url, xml = await fetchText(url);
      const published = xml.match(/<ISO_4217\s+Pblshd="([\d-]+)"/)?.[1];
      if (!published || !xml.includes('<CcyTbl>')) throw new Error('Lista SIX em formato inesperado.');
      const hash = crypto.createHash('sha256').update(xml).digest('hex');
      return { status: hash === baseline.six.sha256 ? 'sem mudanças' : 'mudança detectada',
        detail: `Publicação local: ${baseline.six.published}; remota: ${published}. Mudança de arquivo pede revisão: pode incluir fundos ou ajustes editoriais.`, url, sha256: hash };
    }],
    ['Novas edições do IDH', async () => {
      const url = 'https://hdr.undp.org/data-center/documentation-and-downloads';
      const page = await fetchText(url);
      const years = [...page.matchAll(/\/(20\d{2})_HDR\/[^"'<>\s]+\.csv/gi)].map(m => Number(m[1]));
      if (!years.length) throw new Error('Links CSV de edições do HDR não encontrados; revisão manual necessária.');
      const pinned = Number(current.meta.idh.url.match(/\/(20\d{2})_HDR\//)?.[1]);
      return { status: Math.max(...years) > pinned ? 'mudança detectada' : 'sem mudanças',
        detail: `Edição importada: ${pinned}; edição mais recente com CSV identificada no catálogo: ${Math.max(...years)}.`, url };
    }],
  ];
  const settled = await Promise.allSettled(jobs.map(async ([source, run]) => ({ source, ...await run() })));
  return { checkedAt: new Date().toISOString(), results: settled.map((r, i) => r.status === 'fulfilled'
    ? r.value : { source: jobs[i][0], status: 'consulta falhou', detail: String(r.reason.message || r.reason) }) };
}

async function main() {
  const report = await audit();
  const output = path.join(ROOT, 'reports'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'source-audit.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'source-audit.md'), markdown(report));
  report.results.forEach(r => console.log(`${r.source}: ${r.status} — ${r.detail}`));
  if (report.results.some(r => r.status === 'consulta falhou')) process.exitCode = 2;
  else if (report.results.some(r => r.status === 'mudança detectada')) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 2; });
module.exports = { audit, differences, markdown };

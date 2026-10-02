'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { audit, differences, markdown } = require('../scripts/audit-sources.cjs');
const current = require('../data/indicators.json');

test('auditoria compara valor, ano e ausência, sem confundir zero com falta', () => {
  const changes = differences({ BR: { flor: 0, florAno: 2024 }, VA: { nota: 'ausente' } },
    { BR: { flor: 0, florAno: 2025 }, VA: { flor: 0 } });
  assert.equal(changes.length, 3);
  assert.ok(changes.some(c => c.country === 'VA' && c.before === null && c.after === 0));
  assert.equal(differences(current.paises, structuredClone(current.paises)).length, 0);
});

test('auditoria preserva resultados independentes quando fontes falham e relata mudanças', async () => {
  const updated = structuredClone(current); updated.paises.BR.pop += 1;
  const report = await audit({ indicators: async () => updated, fetchText: async url => {
    if (url.includes('registry.npmjs')) return '{"version":"99.0.0"}';
    if (url.includes('api.github')) return '[{"name":"v5.1.2"},{"name":"v99.0.0-pre"}]';
    if (url.includes('hdr.undp')) return '<a href="/sites/default/files/2027_HDR/data.csv">Dados</a>';
    throw new Error('Fonte indisponível');
  } });
  assert.deepEqual(report.results.map(r => r.status), ['mudança detectada', 'mudança detectada', 'sem mudanças', 'consulta falhou', 'mudança detectada']);
  const text = markdown(report);
  assert.match(text, /BR \| pop/);
  assert.match(text, /Fonte indisponível/);
  assert.equal(report.results[0].changes.length, 1);
  assert.notEqual(updated.paises.BR.pop, current.paises.BR.pop);
});

'use strict';

// Valida o registro da revisão, sem confundir metadados válidos com comprovação
// factual. A leitura da fonte e a conferência do trecho continuam editoriais.
function validateEditorialMetadata(meta, countries) {
  const ids = new Set(countries.map(country => country.id));
  if (!meta || !meta.countries || typeof meta.countries !== 'object' || Array.isArray(meta.countries)) throw new Error('Registro editorial sem países.');
  function validateSource(row, context) {
    if (row?.kind !== undefined && !['legal-text', 'institutional', 'archived-reference'].includes(row.kind)) throw new Error(`${context}: tipo de fonte inválido.`);
    for (const field of ['scope', 'source', 'url', 'checked']) {
      if (typeof row?.[field] !== 'string' || !row[field].trim()) throw new Error(`${context}: ${field} ausente.`);
    }
    let url;
    try { url = new URL(row.url); } catch (_) { throw new Error(`${context}: URL inválida.`); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${context}: fonte precisa de HTTPS sem credenciais.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.checked) || !Number.isFinite(Date.parse(row.checked))
        || new Date(row.checked).toISOString().slice(0, 10) !== row.checked) throw new Error(`${context}: data inválida.`);
  }
  for (const [id, entry] of Object.entries(meta.countries)) {
    if (!ids.has(id)) throw new Error(`País editorial desconhecido: ${id}.`);
    if (!entry || typeof entry !== 'object') throw new Error(`${id}: registro inválido.`);
    if (entry.sources !== undefined && !Array.isArray(entry.sources)) throw new Error(`${id}: sources precisa ser lista.`);
    const seen = new Set();
    for (const row of entry.sources || []) {
      if (!['Capital', 'Idiomas'].includes(row?.field)) throw new Error(`${id}: campo editorial desconhecido.`);
      validateSource(row, `${id}/${row.field}`);
      const key = JSON.stringify([row.field, row.scope, row.url]);
      if (seen.has(key)) throw new Error(`${id}: fonte duplicada.`);
      seen.add(key);
    }
    if (entry.flag) {
      validateSource({ ...entry.flag, scope: entry.flag.description }, `${id}/Bandeira`);
    }
  }
  return meta;
}

module.exports = { validateEditorialMetadata };

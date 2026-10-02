(function (root) {
  'use strict';
  function capitalParts(name, other) {
    const a = Array.from(name || ''), b = Array.from(other || '');
    const normalize = char => char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let start = 0, end = 0;
    while (start < Math.min(a.length, b.length) && normalize(a[start]) === normalize(b[start])) start++;
    while (end < Math.min(a.length, b.length) - start && normalize(a[a.length - 1 - end]) === normalize(b[b.length - 1 - end])) end++;
    return { prefix: a.slice(0, start).join(''), difference: a.slice(start, a.length - end).join(''), suffix: end ? a.slice(-end).join('') : '' };
  }
  function copy(Core, country, chosen, direction, editorial = {}) {
    if (!chosen || chosen.id === country.id) return null;
    if (['cap', 'capOf'].includes(direction)) {
      return `Associe os dois pares: ${country.cap} → ${country.n}; ${chosen.cap} → ${chosen.n}. O trecho sublinhado mostra o que muda na escrita das capitais.`;
    }
    if (['flag', 'flagOf'].includes(direction)) {
      const a = editorial.countries?.[country.id]?.flag?.description;
      const b = editorial.countries?.[chosen.id]?.flag?.description;
      if (a && b) return `${country.n}: ${a} ${chosen.n}: ${b}`;
      return `${country.n} e ${chosen.n}: compare a ordem das faixas, a posição dos símbolos e o desenho das estrelas nas duas imagens.`;
    }
    const relation = Core.confusionReason(country, chosen, direction) === 'border'
      ? 'Os dois compartilham uma fronteira terrestre. ' : '';
    return `${relation}${country.n}: ${country.sr || country.r}. ${chosen.n}: ${chosen.sr || chosen.r}. Confira a posição de cada um no mapa e o contorno nas imagens.`;
  }
  function capitalLabel(el, name, other) {
    const span = el('span', { className: 'factmeta' });
    span.append(document.createTextNode('Capital: '));
    const parts = capitalParts(name, other);
    span.append(document.createTextNode(parts.prefix));
    if (parts.difference) span.append(el('mark', { className: 'capital-difference', text: parts.difference }));
    span.append(document.createTextNode(parts.suffix));
    return span;
  }
  const api = { copy, capitalParts, capitalLabel };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasFeedback = api;
})(globalThis);

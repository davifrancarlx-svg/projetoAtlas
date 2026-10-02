(function (root) {
  'use strict';
  function compareCountries(left, right, order = 'name') {
    if (order === 'area' || order === 'population') {
      const field = order === 'area' ? 'ar' : 'pop';
      const a = Number.isFinite(left[field]) ? left[field] : -Infinity;
      const b = Number.isFinite(right[field]) ? right[field] : -Infinity;
      if (a !== b) return a > b ? -1 : 1;
    }
    return left.n.localeCompare(right.n, 'pt-BR');
  }
  function countryFromHash(hash, byId) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    if (params.has('access_token') || params.has('refresh_token') || params.has('error')) return null;
    const id = params.get('pais');
    return id && Object.hasOwn(byId, id) ? id : null;
  }
  function sourceEntries(meta) {
    const definitions = [
      ['pop', 'População', 'Número de habitantes; estimativas e projeções podem ser revisadas.'],
      ['dens', 'Densidade', 'Habitantes por km² de área terrestre.'],
      ['vida', 'Expectativa de vida', 'Anos que um recém-nascido viveria se as taxas de mortalidade do ano fossem mantidas.'],
      ['urb', 'População urbana', 'Parcela da população em áreas urbanas, segundo as definições nacionais, que variam entre países.'],
      ['flor', 'Área florestal', 'Porcentagem da área terrestre classificada como floresta pela FAO; não inclui toda cobertura arbórea.'],
      ['hdi', 'IDH', 'Índice de 0 a 1 que combina saúde, educação e renda; não é uma porcentagem.'],
    ];
    return definitions.map(([field, label, definition]) => {
      const source = field === 'hdi' ? meta.idh : field === 'flor' ? meta.fao : meta.bancoMundial;
      const url = field === 'hdi' ? source.url : field === 'flor'
        ? 'https://fra-data.fao.org/' : `https://data.worldbank.org/indicator/${source.indicadores[field].codigo}`;
      return { field, label, definition, source: source.fonte, url,
        collected: source.coletado || meta.gerado, license: source.licenca || '' };
    });
  }
  function editorialSourceNote(entry) {
    return entry.kind === 'archived-reference' ? 'Arquivo histórico; não confirma mudanças posteriores.'
      : entry.kind === 'legal-text' ? 'Texto legal na versão indicada; consulte o escopo.' : 'Fonte do trecho indicado.';
  }
  function editorialEntries(country, meta = {}) {
    const result = [...(meta.countries?.[country.id]?.sources || [])];
    const codes = meta.currencyCodes;
    if (codes && country.moedas?.every(m => codes.verified.includes(m.codigo))) result.push({
      field: 'Moedas', scope: 'Códigos ISO 4217: ' + country.moedas.map(m => m.codigo).join(', '),
      source: codes.source, url: codes.url, checked: codes.checked,
    });
    const flag = meta.countries?.[country.id]?.flag;
    if (flag) result.push({ field: 'Bandeira', scope: 'Características usadas na explicação', ...flag });
    return result;
  }
  function create({ Core, countries, byId, ui, indicatorMeta, territories = [], editorialMeta = {} }) {
    const { create: el, formatArea, formatList, indicadores, fatos, flagImage, announce } = ui;
    let otherId = '';
    let openComparison = false;
    function appendSources(container, country) {
      const details = el('details', { className: 'indicator-sources' });
      details.append(el('summary', { text: 'Fontes e definições dos indicadores' }));
      sourceEntries(indicatorMeta).forEach(entry => {
        const row = el('p', {}, [el('strong', { text: entry.label + ': ' }),
          document.createTextNode(entry.definition + ' '),
          el('a', { text: entry.source, attrs: { href: entry.url, target: '_blank', rel: 'noopener noreferrer',
            'aria-label': `Fonte de ${entry.label}: ${entry.source} (nova aba)` } }),
          document.createTextNode(`. Referência: ${country[entry.field + 'Ano'] || 'indisponível'}; consulta: ${entry.collected}.`),
        ]);
        details.append(row);
      });
      details.append(el('p', { className: 'note', text: 'A consulta é a data em que os dados foram obtidos, não o ano a que se referem. Os links abrem o site da fonte em outra aba.' }));
      container.append(details);
      const editorial = el('details', { className: 'indicator-sources editorial-sources' });
      editorial.append(el('summary', { text: 'Fontes do conteúdo editorial' }));
      editorialEntries(country, editorialMeta).forEach(entry => editorial.append(el('p', {}, [
        el('strong', { text: entry.scope + ': ' }),
        el('a', { text: entry.source, attrs: { href: entry.url, target: '_blank', rel: 'noopener noreferrer' } }),
        document.createTextNode(` · consulta: ${entry.checked}. ${editorialSourceNote(entry)}`),
      ])));
      editorial.append(el('p', { className: 'note', text: 'A data de consulta não é a data da lei nem confirmação de vigência atual. Arquivos históricos estão identificados. Códigos de moeda não verificam nomes traduzidos nem notas de uso.' }));
      container.append(editorial);
    }
    function rows(country) {
      const values = [
        ['Capital', country.cap], ['Notas da capital', Core.capitalNotes(country).join(' ')],
        ['Região', country.r], ['Subregião', country.sr], ['Área', formatArea(country.ar)],
        ['Idiomas', formatList(country.idiomas || []) || 'Não informado'],
        ['Nota dos idiomas', country.idiomasNota],
        ['Moedas', (country.moedas || []).map(m => `${m.nome} (${m.codigo})`).join(', ') || 'Não informado'],
        ['Nota das moedas', country.moedaNota],
        ['Fronteiras terrestres', (country.nb || []).map(id => byId[id]?.n).filter(Boolean).join(', ') || 'Sem fronteiras terrestres'],
      ];
      const data = indicadores(country);
      for (const label of ['População', 'Densidade', 'Expectativa de vida', 'População urbana', 'Área florestal', 'IDH']) {
        const entry = data.find(item => item.rotulo === label);
        values.push([label, entry ? `${entry.valor} (${entry.ano})` : 'Dado indisponível']);
      }
      return values;
    }
    function sources() {
      return Object.values(indicatorMeta).filter(value => value && value.fonte)
        .map(value => `${value.fonte}${value.licenca ? ' · ' + value.licenca : ''}`).join('; ');
    }
    function text(country) {
      return [`Atlas 195 — ${country.n}`,
        ...(country.alsoKnownAs?.length ? ['Outros nomes: ' + country.alsoKnownAs.join(', ')] : []),
        ...(country.formerNames || []).map(item => `Nome anterior: ${item.name} (até ${item.until})`),
        ...rows(country).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
        ...Object.entries(country.nbNotas || {}).map(([id, note]) => `Fronteira com ${byId[id]?.n || id}: ${note}`),
        ...[country.bmNota, country.faoNota, country.hdiNota].filter(Boolean),
        ...fatos(country),
        ...territories.filter(t => t.of === country.id).flatMap(t => [
          `Território: ${t.n} — ${t.status}`, `Capital regional: ${t.cap}`,
          `${t.sr} · ${formatArea(t.ar)}`, ...(t.notes || []),
        ]),
        `Fontes dos indicadores: ${sources()}`,
        ...sourceEntries(indicatorMeta).map(s => `${s.label}: ${s.definition} Fonte: ${s.url} — consulta: ${s.collected}.`),
        ...editorialEntries(country, editorialMeta).map(s => `${s.scope}: ${s.url} — consulta: ${s.checked}. ${editorialSourceNote(s)}`),
        'Cartografia: Natural Earth. Bandeiras: flag-icons (MIT).',
      ].join('\n') + '\n';
    }
    function download(country) {
      const url = URL.createObjectURL(new Blob([text(country)], { type: 'text/plain;charset=utf-8' }));
      const anchor = el('a', { attrs: { href: url, download: `atlas-195-${country.id}.txt` } });
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      announce('Ficha exportada como texto. Para incluir a bandeira e a silhueta, use Imprimir / PDF.');
    }
    function append(container, country) {
      const actions = el('div', { className: 'button-row ficha-actions' });
      const print = el('button', { className: 'btn ghost', type: 'button', text: 'Imprimir / PDF' });
      print.addEventListener('click', () => window.print());
      const exportButton = el('button', { className: 'btn ghost', type: 'button', text: 'Exportar ficha (.txt)' });
      exportButton.addEventListener('click', () => download(country));
      const share = el('button', { className: 'btn ghost', type: 'button', text: 'Copiar link da ficha' });
      share.addEventListener('click', async () => {
        const url = new URL(location.href);
        url.search = ''; url.hash = `pais=${country.id}`;
        let copied = false;
        try { await navigator.clipboard.writeText(url.href); copied = true; } catch (_) { /* seleção manual abaixo */ }
        if (copied) announce('Link da ficha copiado.');
        else {
          let input = actions.querySelector('input');
          if (!input) { input = el('input', { className: 'search', attrs: { readonly: '', 'aria-label': 'Link da ficha para copiar' } }); actions.append(input); }
          input.value = url.href; input.focus(); input.select();
          announce('Selecione e copie o link da ficha.');
        }
      });
      actions.append(print, exportButton, share); container.append(actions);
      const details = el('details', { className: 'atlas-comparison' });
      details.open = openComparison;
      details.append(el('summary', { text: 'Comparar com outro país' }));
      const label = el('label', { text: 'Comparar com', attrs: { for: 'compareCountry' } });
      const select = el('select', { id: 'compareCountry' });
      select.append(el('option', { text: 'Escolha um país', attrs: { value: '' } }));
      countries.slice().sort(compareCountries).filter(c => c.id !== country.id).forEach(c => {
        select.append(el('option', { text: c.n, attrs: { value: c.id } }));
      });
      select.value = otherId === country.id ? '' : otherId;
      const result = el('div', { className: 'comparison-result', attrs: { 'aria-live': 'polite' } });
      function render() {
        result.replaceChildren();
        const other = byId[select.value];
        if (!other) return;
        const flags = el('div', { className: 'comparison-flags' });
        [country, other].forEach(c => flags.append(el('figure', {}, [flagImage(c, { eager: true }), el('figcaption', { text: c.n })])));
        const scroll = el('div', { className: 'comparison-scroll', attrs: { tabindex: '0', role: 'region', 'aria-label': 'Tabela de comparação; role para os lados se necessário' } });
        const table = el('table');
        table.append(el('caption', { text: `${country.n} e ${other.n}` }));
        const head = el('thead', {}, [el('tr', {}, [el('th', { text: 'Informação', attrs: { scope: 'col' } }),
          el('th', { text: country.n, attrs: { scope: 'col' } }), el('th', { text: other.n, attrs: { scope: 'col' } })])]);
        const body = el('tbody');
        const left = rows(country), right = rows(other);
        left.forEach(([key, value], index) => {
          if (!value && !right[index][1]) return;
          body.append(el('tr', {}, [el('th', { text: key, attrs: { scope: 'row' } }),
            el('td', { text: value || '—' }), el('td', { text: right[index][1] || '—' })]));
        });
        table.append(head, body); scroll.append(table);
        result.append(flags, scroll, el('p', { className: 'note', text: 'Confira o ano junto a cada indicador: os valores podem corresponder a anos diferentes. ' + sources() }));
      }
      select.addEventListener('change', () => { otherId = select.value; render(); });
      details.append(label, select, result); container.append(details); render();
    }
    return { append, text, appendSources, compareWith: id => { otherId = id; openComparison = true; } };
  }
  const api = { create, compareCountries, countryFromHash, sourceEntries, editorialEntries, editorialSourceNote };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasCountryTools = api;
})(globalThis);

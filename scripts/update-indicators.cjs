'use strict';

// Gera data/indicators.json — indicadores oficiais dos 195 países.
//
// São dados complementares da ficha do país: nunca viram pergunta. São números
// que mudam todo ano e que só valem se a origem for rastreável, então
// aqui vale a mesma disciplina da cartografia e das bandeiras: baixar de uma
// fonte oficial, registrar URL, data e SHA-256, e falhar alto quando a origem
// mudar debaixo dos pés.
//
//   node scripts/update-indicators.cjs            baixa e regrava o arquivo
//   node scripts/update-indicators.cjs --check    confere sem gravar nada
//
// Fontes:
//   IDH        PNUD, Relatório de Desenvolvimento Humano. É a única fonte
//              legítima: o índice é definido e calculado por eles, todo o resto
//              apenas republica.
//   Floresta   FAO, FAOSTAT (Uso da terra). É quem produz o dado, a partir da
//              Avaliação Global dos Recursos Florestais (FRA). O Banco Mundial
//              republica a mesma série, mas em 28/09/2026 ainda servia a revisão
//              anterior à FRA 2025: 78 países diferiam em mais de um ponto.
//   Demais     Banco Mundial, que republica as projeções da ONU numa API
//              estável e já traz as revisões mais novas delas (a de urbanização
//              bate, país a país, com a WUP 2025). Cada série traz o próprio ano.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const OUTPUT = path.join(root, 'data', 'indicators.json');

const HDI = {
  fonte: 'PNUD — Relatório de Desenvolvimento Humano 2025',
  url: 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv',
  termos: 'https://hdr.undp.org/terms-use',
};
// Indicadores do Banco Mundial. Todos foram escolhidos por dois critérios:
// dizerem algo geográfico sobre o país e cobrirem quase os 195 — PIB per capita
// e fecundidade foram medidos e ficaram de fora, o primeiro por cobrir só 181.
// Cada um carrega o próprio ano porque as séries não andam juntas.
const BANCO_MUNDIAL = {
  fonte: 'Banco Mundial',
  termos: 'https://datacatalog.worldbank.org/public-licenses#cc-by',
  licenca: 'CC BY 4.0',
  indicadores: [
    { campo: 'pop', codigo: 'SP.POP.TOTL', rotulo: 'população total', decimais: 0 },
    { campo: 'vida', codigo: 'SP.DYN.LE00.IN', rotulo: 'expectativa de vida ao nascer', decimais: 1 },
    { campo: 'dens', codigo: 'EN.POP.DNST', rotulo: 'densidade demográfica', decimais: 1 },
    { campo: 'urb', codigo: 'SP.URB.TOTL.IN.ZS', rotulo: 'população urbana', decimais: 1 },
  ],
};
// A área florestal vem da própria FAO: o arquivo completo do domínio Uso da
// terra, que é o canal de distribuição estável do FAOSTAT (a API pede login).
// Filtra-se pelos códigos, não pelos nomes, que mudam de grafia entre edições.
const FAO = {
  fonte: 'FAO — FAOSTAT, Uso da terra',
  url: 'https://bulks-faostat.fao.org/production/Inputs_LandUse_E_All_Data_(Normalized).zip',
  arquivo: 'Inputs_LandUse_E_All_Data_(Normalized).csv',
  termos: 'https://www.fao.org/contact-us/terms/db-terms-of-use/en',
  licenca: 'CC BY 4.0',
  indicadores: [
    { campo: 'flor', item: '6646', elemento: '7209', rotulo: 'área florestal', unidade: '%', decimais: 1 },
  ],
};
const urlIndicador = (codigo) =>
  `https://api.worldbank.org/v2/country/all/indicator/${codigo}?format=json&per_page=400&mrv=1`;

// Ausências conhecidas e explicáveis. Estão aqui de propósito: um país sem dado
// precisa dizer por quê na tela, em vez de aparecer zerado ou sumir da ficha.
const AUSENCIAS = {
  hdi: {
    KP: 'A Coreia do Norte não fornece os dados que o PNUD usa para calcular o índice.',
    MC: 'Mônaco não integra o levantamento do PNUD.',
    VA: 'O Vaticano não integra o levantamento do PNUD.',
  },
  // O Vaticano fica fora de todas as séries do Banco Mundial: com cerca de 800
  // residentes, está abaixo do limite de cobertura.
  bancoMundial: {
    VA: 'O Vaticano tem cerca de 800 residentes e fica abaixo do limite de cobertura do Banco Mundial.',
  },
  // O FAOSTAT não traz linha de área florestal para os três. A ficha diz isso
  // em vez de supor zero.
  fao: {
    MC: 'A FAO não publica área florestal para Mônaco.',
    NR: 'A FAO não publica área florestal para Nauru.',
    VA: 'A FAO não publica área florestal para o Vaticano.',
  },
};

const sha256 = (dado) => crypto.createHash('sha256').update(dado).digest('hex');

async function baixar(url, rotulo, cabecalhos) {
  const resposta = await fetch(url, { redirect: 'follow' });
  if (!resposta.ok) throw new Error(`${rotulo}: a fonte respondeu ${resposta.status}.`);
  if (cabecalhos) cabecalhos.modificado = resposta.headers.get('last-modified') || '';
  return Buffer.from(await resposta.arrayBuffer());
}

// Leitor mínimo de ZIP, só com o que o Node traz: acha a entrada pelo diretório
// central e descomprime com inflateRaw. Basta para o arquivo do FAOSTAT, que
// não usa ZIP64 nem criptografia; qualquer coisa diferente falha alto.
function lerZip(zip, nome) {
  let fim = zip.length - 22;
  while (fim >= 0 && zip.readUInt32LE(fim) !== 0x06054b50) fim -= 1;
  if (fim < 0) throw new Error('ZIP sem diretório central.');
  let posicao = zip.readUInt32LE(fim + 16);
  const total = zip.readUInt16LE(fim + 10);
  for (let i = 0; i < total; i += 1) {
    if (zip.readUInt32LE(posicao) !== 0x02014b50) throw new Error('ZIP com diretório central corrompido.');
    const metodo = zip.readUInt16LE(posicao + 10);
    const tamanho = zip.readUInt32LE(posicao + 20);
    const tamanhoNome = zip.readUInt16LE(posicao + 28);
    const extra = zip.readUInt16LE(posicao + 30);
    const comentario = zip.readUInt16LE(posicao + 32);
    const local = zip.readUInt32LE(posicao + 42);
    const entrada = zip.toString('utf8', posicao + 46, posicao + 46 + tamanhoNome);
    if (entrada === nome) {
      const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const dados = zip.subarray(inicio, inicio + tamanho);
      if (metodo === 0) return dados;
      if (metodo === 8) return zlib.inflateRawSync(dados);
      throw new Error(`ZIP: método de compressão ${metodo} não suportado.`);
    }
    posicao += 46 + tamanhoNome + extra + comentario;
  }
  throw new Error(`ZIP: ${nome} não está no arquivo.`);
}

// Uma linha de CSV com aspas: "China, mainland" tem vírgula dentro do campo.
function camposCsv(linha) {
  const campos = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i += 1; } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { campos.push(atual); atual = ''; } else atual += c;
  }
  campos.push(atual);
  return campos;
}

// O FAOSTAT identifica o país pelo código numérico do M49 (com um apóstrofo na
// frente, "'076"). Para cada série, fica o valor do ano mais recente com dado.
function lerFao(csv, indicador) {
  const linhas = csv.toString('utf8').split(/\r?\n/);
  const cabecalho = camposCsv(linhas[0]);
  const coluna = (nome) => {
    const indice = cabecalho.indexOf(nome);
    if (indice === -1) throw new Error(`FAO: o CSV não tem a coluna "${nome}". O formato mudou.`);
    return indice;
  };
  const [m49, item, elemento, ano, valor, unidade] = ['Area Code (M49)', 'Item Code', 'Element Code', 'Year', 'Value', 'Unit'].map(coluna);
  const valores = {};
  for (const linha of linhas.slice(1)) {
    if (!linha) continue;
    const campos = camposCsv(linha);
    if (campos[item] !== indicador.item || campos[elemento] !== indicador.elemento || campos[valor] === '') continue;
    if (campos[unidade] !== indicador.unidade) throw new Error(`FAO: ${indicador.rotulo} veio em "${campos[unidade]}".`);
    const codigo = campos[m49].replace(/^'/, '');
    const numero = Number(campos[valor]);
    const anoLido = Number(campos[ano]);
    if (!Number.isFinite(numero) || !Number.isInteger(anoLido)) continue;
    if (!valores[codigo] || anoLido > valores[codigo].ano) valores[codigo] = { valor: numero, ano: anoLido };
  }
  if (Object.keys(valores).length < 150) throw new Error(`FAO: só ${Object.keys(valores).length} países com ${indicador.rotulo}. O formato mudou.`);
  return valores;
}

// ISO2 -> ISO3: as duas fontes usam o código de três letras e o Atlas usa o de
// duas. O Natural Earth já versionado no projeto tem os dois, então a tradução
// sai de um arquivo que já está aqui em vez de uma tabela escrita à mão.
function mapaIso() {
  const arquivo = path.join(root, 'data', 'natural-earth', 'ne_10m_admin_0_countries.geojson');
  if (!fs.existsSync(arquivo)) {
    throw new Error('data/natural-earth/ne_10m_admin_0_countries.geojson ausente: é dele que sai a tradução ISO2 → ISO3.');
  }
  const geo = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const mapa = {};
  const numerico = {};
  for (const feicao of geo.features) {
    const p = feicao.properties;
    const dois = String(p.ISO_A2_EH || p.ISO_A2 || '').trim();
    const tres = String(p.ISO_A3_EH || p.ISO_A3 || '').trim();
    const numero = Number(p.ISO_N3_EH || p.ISO_N3);
    if (dois && dois !== '-99' && tres && tres !== '-99') mapa[dois] = tres;
    // O M49 numérico do país é o mesmo número do ISO 3166-1; o FAOSTAT usa esse.
    if (dois && dois !== '-99' && Number.isInteger(numero) && numero > 0) numerico[dois] = String(numero).padStart(3, '0');
  }
  return { mapa, numerico };
}

// O CSV do PNUD traz a série histórica inteira; interessa a coluna de IDH do ano
// mais recente que realmente tenha valores.
function lerHdi(csv) {
  const linhas = csv.toString('utf8').split(/\r?\n/);
  const cabecalho = linhas[0].split(',');
  const iso3 = cabecalho.indexOf('iso3');
  if (iso3 === -1) throw new Error('IDH: o CSV do PNUD não tem a coluna iso3. O formato mudou.');

  const colunas = cabecalho
    .map((nome, indice) => ({ nome, indice }))
    .filter((coluna) => /^hdi_\d{4}$/.test(coluna.nome));
  if (!colunas.length) throw new Error('IDH: nenhuma coluna hdi_ANO no CSV. O formato mudou.');

  for (let i = colunas.length - 1; i >= 0; i -= 1) {
    const coluna = colunas[i];
    const valores = {};
    for (const linha of linhas.slice(1)) {
      if (!linha.trim()) continue;
      const campos = linha.split(',');
      const codigo = (campos[iso3] || '').trim();
      const bruto = (campos[coluna.indice] || '').trim();
      if (!codigo || !bruto) continue;
      const numero = Number(bruto);
      if (Number.isFinite(numero) && numero > 0 && numero <= 1) valores[codigo] = numero;
    }
    if (Object.keys(valores).length > 100) {
      return { ano: Number(coluna.nome.slice(4)), valores };
    }
  }
  throw new Error('IDH: nenhuma coluna de ano com dados suficientes.');
}

function lerSerie(json) {
  const corpo = JSON.parse(json.toString('utf8'));
  const registros = Array.isArray(corpo) && Array.isArray(corpo[1]) ? corpo[1] : null;
  if (!registros) throw new Error('Banco Mundial: resposta em formato inesperado.');
  const valores = {};
  for (const registro of registros) {
    if (registro.value == null) continue;
    const codigo = (registro.countryiso3code || '').trim();
    const numero = Number(registro.value);
    const ano = Number(registro.date);
    if (!codigo || !Number.isFinite(numero) || !Number.isInteger(ano)) continue;
    valores[codigo] = { valor: numero, ano };
  }
  return valores;
}

async function montar() {
  const paises = JSON.parse(fs.readFileSync(path.join(root, 'src', 'countries.base.json'), 'utf8'));
  const { mapa: iso, numerico } = mapaIso();

  const csvHdi = await baixar(HDI.url, 'IDH');
  const hdi = lerHdi(csvHdi);

  const series = {};
  for (const indicador of BANCO_MUNDIAL.indicadores) {
    const bruto = await baixar(urlIndicador(indicador.codigo), indicador.rotulo);
    series[indicador.campo] = { ...indicador, valores: lerSerie(bruto), sha256: sha256(bruto) };
  }

  const cabecalhosFao = {};
  const zipFao = await baixar(FAO.url, 'FAO', cabecalhosFao);
  const csvFao = lerZip(zipFao, FAO.arquivo);
  const seriesFao = FAO.indicadores.map((indicador) => ({ ...indicador, valores: lerFao(csvFao, indicador) }));

  const paisesSaida = {};
  let comHdi = 0;
  const cobertura = {};
  for (const pais of paises) {
    const codigo3 = iso[pais.id];
    if (!codigo3) throw new Error(`${pais.id} (${pais.n}) não tem ISO3 no Natural Earth.`);
    const registro = {};

    if (hdi.valores[codigo3] !== undefined) {
      registro.hdi = Number(hdi.valores[codigo3].toFixed(3));
      registro.hdiAno = hdi.ano;
      comHdi += 1;
    } else if (AUSENCIAS.hdi[pais.id]) {
      registro.hdiNota = AUSENCIAS.hdi[pais.id];
    } else {
      throw new Error(`${pais.id} (${pais.n}) ficou sem IDH e sem explicação registrada em AUSENCIAS.`);
    }

    for (const serie of Object.values(series)) {
      const achado = serie.valores[codigo3];
      if (achado !== undefined) {
        registro[serie.campo] = Number(achado.valor.toFixed(serie.decimais));
        registro[`${serie.campo}Ano`] = achado.ano;
        cobertura[serie.campo] = (cobertura[serie.campo] || 0) + 1;
      } else if (!AUSENCIAS.bancoMundial[pais.id]) {
        throw new Error(`${pais.id} (${pais.n}) ficou sem ${serie.rotulo} e sem explicação registrada em AUSENCIAS.`);
      }
    }
    // Uma nota só, para não repetir a mesma frase em quatro indicadores.
    if (AUSENCIAS.bancoMundial[pais.id]) registro.bmNota = AUSENCIAS.bancoMundial[pais.id];

    const m49 = numerico[pais.id];
    for (const serie of seriesFao) {
      const achado = m49 && serie.valores[m49];
      if (achado) {
        registro[serie.campo] = Number(achado.valor.toFixed(serie.decimais));
        registro[`${serie.campo}Ano`] = achado.ano;
        cobertura[serie.campo] = (cobertura[serie.campo] || 0) + 1;
      } else if (AUSENCIAS.fao[pais.id]) {
        registro.faoNota = AUSENCIAS.fao[pais.id];
      } else {
        throw new Error(`${pais.id} (${pais.n}) ficou sem ${serie.rotulo} da FAO e sem explicação registrada em AUSENCIAS.`);
      }
    }

    paisesSaida[pais.id] = registro;
  }

  const indicadores = {};
  for (const serie of Object.values(series)) {
    const anos = {};
    Object.values(serie.valores).forEach((v) => { anos[v.ano] = (anos[v.ano] || 0) + 1; });
    indicadores[serie.campo] = {
      codigo: serie.codigo,
      rotulo: serie.rotulo,
      url: urlIndicador(serie.codigo),
      sha256: serie.sha256,
      cobertura: cobertura[serie.campo] || 0,
      anoPredominante: Number(Object.entries(anos).sort((a, b) => b[1] - a[1])[0][0]),
    };
  }

  // O ano predominante conta só os 195, não os agregados e ex-países do arquivo.
  const indicadoresFao = {};
  for (const serie of seriesFao) {
    const anos = {};
    Object.values(paisesSaida).forEach((registro) => {
      const ano = registro[`${serie.campo}Ano`];
      if (ano) anos[ano] = (anos[ano] || 0) + 1;
    });
    indicadoresFao[serie.campo] = {
      item: serie.item,
      elemento: serie.elemento,
      rotulo: serie.rotulo,
      cobertura: cobertura[serie.campo] || 0,
      anoPredominante: Number(Object.entries(anos).sort((a, b) => b[1] - a[1])[0][0]),
    };
  }

  return {
    meta: {
      gerado: new Date().toISOString().slice(0, 10),
      idh: { ...HDI, ano: hdi.ano, sha256: sha256(csvHdi), cobertura: comHdi },
      bancoMundial: {
        fonte: BANCO_MUNDIAL.fonte,
        termos: BANCO_MUNDIAL.termos,
        licenca: BANCO_MUNDIAL.licenca,
        indicadores,
      },
      fao: {
        fonte: FAO.fonte,
        url: FAO.url,
        termos: FAO.termos,
        licenca: FAO.licenca,
        // A data em que a FAO atualizou o arquivo, não a da coleta: é ela que
        // diz de qual edição do FAOSTAT o número saiu.
        atualizado: cabecalhosFao.modificado ? new Date(cabecalhosFao.modificado).toISOString().slice(0, 10) : '',
        sha256: sha256(zipFao),
        indicadores: indicadoresFao,
      },
      total: paises.length,
    },
    paises: paisesSaida,
  };
}

// A data de geração e o hash da resposta do Banco Mundial mudam a cada consulta,
// mesmo sem os números mudarem: a comparação do --check ignora os dois e olha o
// que interessa, que são os valores por país e o ano do IDH.
function comparavel(dados) {
  return JSON.stringify({
    paises: dados.paises,
    idhAno: dados.meta.idh.ano,
    cobertura: dados.meta.bancoMundial ? Object.fromEntries(
      Object.entries(dados.meta.bancoMundial.indicadores).map(([k, v]) => [k, v.cobertura])
    ) : null,
    idhCobertura: dados.meta.idh.cobertura,
    fao: dados.meta.fao ? Object.fromEntries(
      Object.entries(dados.meta.fao.indicadores).map(([k, v]) => [k, v.cobertura])
    ) : null,
  });
}

async function principal() {
  const conferir = process.argv.includes('--check');
  const dados = await montar();

  console.log(`IDH ${dados.meta.idh.ano}: ${dados.meta.idh.cobertura}/${dados.meta.total} países`);
  for (const [campo, info] of Object.entries(dados.meta.bancoMundial.indicadores)) {
    console.log(`${info.rotulo} (${info.anoPredominante}): ${info.cobertura}/${dados.meta.total} — ${campo}`);
  }
  for (const [campo, info] of Object.entries(dados.meta.fao.indicadores)) {
    console.log(`${info.rotulo}, FAO de ${dados.meta.fao.atualizado} (${info.anoPredominante}): ${info.cobertura}/${dados.meta.total} — ${campo}`);
  }

  if (conferir) {
    if (!fs.existsSync(OUTPUT)) throw new Error('data/indicators.json ausente. Rode sem --check.');
    const atual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    if (comparavel(atual) !== comparavel(dados)) {
      throw new Error('data/indicators.json está desatualizado em relação às fontes. Rode sem --check e revise a mudança.');
    }
    console.log('data/indicators.json confere com as fontes.');
    return;
  }

  fs.writeFileSync(OUTPUT, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
  console.log(`data/indicators.json gravado (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KiB).`);
}

principal().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});

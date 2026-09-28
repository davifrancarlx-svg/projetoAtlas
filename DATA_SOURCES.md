# Fontes e política editorial

## Geometria do mapa

- Fonte: Natural Earth, Admin 0 — Countries, escala 1:10m.
- Complemento: Natural Earth Minor Islands 1:10m quando aplicável.
- Datum de origem: WGS84.
- Projeção de exibição: Robinson.
- Licença: domínio público.
- Convenção: fronteiras de facto do dataset global padrão. Linhas disputadas devem ser apresentadas como convenção cartográfica, não como afirmação política definitiva.

A saída contém 195 países interativos (6.222 componentes, dos quais 2.596 vêm da camada de ilhas menores) e uma camada contextual neutra com as outras 63 feições Admin-0. Juntas, elas preservam 7.045 polígonos e 7.064 anéis. A camada contextual não recebe IDs, foco ou elegibilidade para perguntas.

Cada país também carrega `pb`, os limites do aglomerado principal: o componente que contém o ponto de rótulo do Natural Earth, mais todo componente a menos de seis unidades projetadas do aglomerado, repetidamente. É o retângulo usado para enquadrar o país sem que um território a um oceano de distância force a visão do mundo inteiro — 29 dos 195 países têm componentes fora desse aglomerado. O gerador valida que `pb` cabe dentro de `b` e contém o ponto de rótulo.

O script de atualização registra a versão e a URL exatas no próprio arquivo de geometria. O produto exibe essa procedência na interface.

## Países e capitais

O conteúdo anterior foi preservado como base e passa por validações automáticas de IDs e de nomes repetidos: dois países com o mesmo nome ou a mesma capital virariam duas alternativas iguais. Sedes administrativas e nomes coloquiais nunca são a alternativa certa; aparecem apenas em notas explicativas. Os nomes alternativos (Holanda, Suazilândia, "Inglaterra") continuam no artefato porque a busca do Atlas os entende; desde 28/09/2026 as respostas são só por escolha, então nenhum deles é mais comparado com texto digitado.

Decisões editoriais sensíveis são explícitas em `src/content-policy.json`. Entre elas estão a capital da Guiné Equatorial conforme o Decreto-Lei 1/2026, a classificação M49 do Chipre na Ásia Ocidental e a distinção entre capitais, sedes de governo e nomes históricos.

Os nomes que a ficha mostra ("Outro nome", "Nome anterior") ficam em `alsoKnownAs` e `formerNames` do mesmo arquivo, escritos para leitura — os de busca vêm normalizados ("suazilandia") e incluem erros comuns. Todo nome exibido precisa ser um que a busca já conhecia, e nunca de `countryMistakes` ou `countryAmbiguousNames`: "Inglaterra" e "Santa Sé" não aparecem como outro nome. O nome anterior leva o ano em que deixou de valer (Alto Volta até 1984, Birmânia até 1989, Suazilândia até 2018, Macedônia até 2019). `tests/names.test.cjs` confere as duas coisas. As grafias que só existiam para a digitação ("Abidja", "Aden", "Birmania") saíram em 28/09/2026: com as notas da capital na ficha, elas apareceriam repetidas.

### Região (`r`) e subregião (`sr`)

Todo país carrega dois rótulos geográficos. `r` é o balde amplo usado pelo modo "país → região" — inclui, por exemplo, "América do Norte, Central e Caribe" como uma única opção de resposta, para não cobrar ortografia de topônimo em vez de geografia. `sr` é a subregião do país e é o que aparece na ficha do Atlas, no resultado da pergunta, na busca e como área de estudo própria no filtro de região.

Desde 2026-09-16 **todo continente é subdividido**, seguindo o geoscheme M49 da ONU, o mesmo critério já usado para o Chipre e para as Américas:

| Balde amplo (`r`) | Subregiões (`sr`) |
| --- | --- |
| Ásia | Ásia Central, Ásia Oriental, Sudeste Asiático, Ásia Meridional, Ásia Ocidental |
| África | África Setentrional, África Ocidental, África Central, África Oriental, África Austral |
| Europa | Europa Setentrional, Europa Ocidental, Europa Oriental, Europa Meridional |
| América do Norte, Central e Caribe | América do Norte, América Central, Caribe |
| América do Sul | América do Sul (o M49 não a subdivide) |
| Oceania | Austrália e Nova Zelândia, Melanésia, Micronésia, Polinésia |

Os nomes seguem o M49 traduzido, não o uso coloquial: "Ásia Ocidental" em vez de "Oriente Médio", "África Austral" para *Southern Africa*. O balde amplo continua sendo a única resposta cobrada pelo modo região; a subregião serve ao filtro, à ficha, aos distratores (quem confunde localização recebe alternativas da mesma subregião) e à explicação do erro ("fica na mesma subregião, Sudeste Asiático").

Uma correção editorial de `r` em `content-policy.json` (como a do Chipre) só se estende a `sr` quando a base não tem uma subregião mais fina; se tem, ela fica. O build recusa qualquer país ou território sem `sr` preenchido e recusa uma subregião que apareça em dois continentes — é isso que impede as duas etiquetas se contradizerem.

## Territórios dentro de um soberano

Vários territórios chegam do Natural Earth dentro do polígono do país a que pertencem: a Guiana Francesa é parte do polígono Admin-0 da França porque é um departamento ultramarino francês, o Alasca é um estado dos Estados Unidos e as Canárias são uma comunidade autônoma espanhola. Chamar essas áreas apenas de "França", "Estados Unidos" ou "Espanha" no mapa esconde uma capital regional, uma região e uma história próprias.

`src/territories.json` registra 16 casos com nome, capital regional, região, área, natureza jurídica, um box geográfico em graus, um ponto de rótulo e notas explicativas:

| Soberano | Territórios |
| --- | --- |
| França | Guiana Francesa, Guadalupe, Martinica, Reunião, Mayotte |
| Estados Unidos | Alasca, Havaí |
| Portugal | Açores, Madeira |
| Países Baixos | Bonaire, Saba, Santo Eustáquio |
| Espanha | Ilhas Canárias |
| Equador | Galápagos |
| Chile | Ilha de Páscoa |
| Noruega | Svalbard |

Eles **não** entram no sorteio de perguntas, não recebem bandeira própria e não alteram a resposta esperada: a resposta da França continua sendo Paris, e clicar na Guiana Francesa continua valendo como França. O registro serve para o mapa dizer o que está sob o cursor (`Guiana Francesa (França)`), para o Atlas exibir a ficha do território com um botão que o enquadra, e para a busca encontrar quem procura por "Guiana Francesa", "Caiena" ou "Longyearbyen".

O box é área de captação do cursor, não contorno: ele é consultado apenas **depois** que a geometria sob o ponteiro já resolveu o soberano, então um vizinho dentro do retângulo é inofensivo — clicar na Grande Diomedes continua respondendo Rússia, mesmo estando dentro do box do Alasca. O que os testes proíbem é um box engolir o ponto de rótulo ou o aglomerado principal do próprio soberano.

## Fronteiras terrestres

`src/borders.json` registra, à mão, os pares de países dos 195 que compartilham fronteira terrestre: 313 pares, cada um uma vez, em ordem alfabética de ID. O build anexa a cada país a lista `nb` dos vizinhos (ordenada por nome) e, quando a fronteira acontece por um pedaço longe da metrópole, uma nota em `nbNotas` — "pela Guiana Francesa" (Brasil–França, Suriname–França), "por Ceuta e Melilha" (Espanha–Marrocos), "por Kaliningrado" (Lituânia–Rússia, Polônia–Rússia), "por Naquichevão" (Azerbaijão–Turquia).

Critérios editoriais:

- Só entram fronteiras entre territórios desenhados **dentro dos polígonos dos 195**. A Guiana Francesa é parte do polígono da França no Natural Earth, então a fronteira Brasil–França existe no mapa e na lista. Kosovo, Saara Ocidental, Gibraltar, Taiwan, Chipre do Norte e as bases britânicas em Chipre são terras fora dos 195 e não geram fronteira — a Sérvia aparece com sete vizinhos, não oito.
- Fronteira é terrestre. Vizinhança só por mar (Espanha–Marrocos pelo estreito, Índia–Sri Lanka) não conta; a de Ceuta e Melilha conta porque é em terra.
- Botsuana–Zâmbia entra: a fronteira em Kazungula é de poucas centenas de metros, mas existe.

Desde 16 de setembro de 2026 as fronteiras também sustentam uma **variante de pergunta**: "qual destes faz fronteira com X?". Ela não é uma direção nova — é uma das três formas da direção `locate` (país → mapa), ao lado de apontar no mapa e de reconhecer a silhueta. A resposta certa é um vizinho sorteado entre os registrados aqui, e os três distratores saem de um universo do qual **todos os vizinhos foram removidos**, para não existir uma segunda resposta correta. O progresso continua sendo gravado no país da pergunta, na direção `locate`: muda a evidência, não a habilidade nem o esquema.

É **complemento da ficha, dos fatos derivados e do contraste didático do erro; a lista em si nunca é resposta de pergunta**. Na ficha aparece como "Fronteiras terrestres (10): Argentina, Bolívia, …" ou "Sem fronteiras terrestres", e a contagem alimenta os destaques descritos em [Fatos derivados](#fatos-derivados). Quando alguém marca no mapa um país que faz fronteira com o certo, o veredito diz "faz fronteira com", que é mais concreto do que "fica perto". Os testes conferem simetria, IDs, contagens conhecidas (China e Rússia com 14, Brasil com 10, ilhas com zero) e plausibilidade geográfica: os contornos dos dois países precisam se aproximar no mapa, o que pega erro de digitação de ID.

## Bandeiras

- Fonte: [flag-icons](https://github.com/lipis/flag-icons), versão 7.5.0, SVG 4:3.
- Licença da coleção: MIT, copyright (c) 2013 Panayiotis Lipiridis.
- Cobertura: 195/195 IDs ISO 3166-1 alfa-2 presentes no Atlas.
- Distribuição: `data/flags.json` guarda cada SVG em base64, que é o que o gerador valida por hash. O build o reescreve como texto numa URI `data:image/svg+xml,` incorporada ao HTML, sem requisições externas: tira só o espaço entre as tags, troca as aspas duplas por simples e escapa `%`, `#`, `<` e `>`. Base64 cresce um terço e comprime mal; as 195 foram comparadas pixel a pixel com as de base64, sem diferença (28/09/2026).

O pacote de origem, os hashes, a licença integral, o procedimento reproduzível e
a ressalva sobre regras locais aplicáveis a símbolos nacionais estão registrados
em [`data/flag-icons/README.md`](data/flag-icons/README.md). O gerador
`scripts/update-flags.cjs` fixa e valida todos esses dados antes de produzir
`data/flags.json`.

## Plano de treino e resumo de evolução

`src/study.js` deriva o treino diário, a próxima revisão e o resumo dos dados de progresso já existentes. Não usa fonte externa nem altera dados educacionais. As datas são apresentadas no horário local do aparelho. Os marcadores de habilidade nova/dificuldade anterior existem somente na memória da sessão e não são acrescentados ao envelope enviado ao Supabase ou exportado.

## Sons

Os efeitos de acerto, erro e fim de série são composições sintetizadas pelo próprio código em `src/audio.js`, com osciladores e controle de volume da Web Audio API. Não usam gravações, músicas, amostras de terceiros nem serviço externo. O botão de som salva somente preferências locais (`atlas195:som:v1` para o volume, `atlas195:som:estilo:v1` para o estilo e o escopo); elas não integram a conta, o progresso nem o backup. Nenhum dado adicional é enviado. Os WAV em `docs/audio-samples/` foram renderizados a partir do mesmo sintetizador para revisão e não são recursos carregados pelo app.

## Tipografia

As três famílias do Atlas são embutidas no artefato em base64, no subset latino
(`U+0000-00FF`), que é o suficiente para o português. Sem isso o CSS pediria
famílias que quase ninguém tem instaladas e o navegador cairia em Georgia e
system-ui — o desenho existiria só no código.

| Família | Uso | Faces |
| --- | --- | --- |
| Instrument Serif | títulos e nomes de país | regular e itálico |
| IBM Plex Sans | texto corrente | variável, 100–700 |
| IBM Plex Mono | rótulos, placar e coordenadas | 400 e 500 |

Ambas estão sob a **SIL Open Font License 1.1**, que exige distribuir a licença
junto da fonte: os dois textos viajam dentro do próprio `atlas-195.html`.
`data/fonts/fonts.json` registra a URL de origem e o SHA-256 de cada arquivo, e
o build recusa qualquer face que não confira com o hash registrado.

São 118 KB de fonte para 5 MB de artefato, e nenhuma requisição de rede: a CSP
autoriza `font-src data:` e nenhuma origem externa.

### Precisão das coordenadas

As coordenadas projetadas usam **duas casas decimais**. O `viewBox` tem 1018
unidades de largura e o zoom máximo é 60×, o que dá cerca de 0,014 unidade por
pixel: o arredondamento desloca um vértice em no máximo 0,005 unidade, ou
**0,35 pixel na ampliação máxima** — abaixo de um pixel em qualquer situação de
uso. Em troca, a geometria comprimida cai de 1.094 KB para 830 KB em gzip, que é
o que o navegador realmente baixa.

Os limites (`b` e `pb`) são medidos na geometria de origem **unida aos anéis
efetivamente emitidos**. A distinção importa para os micro-países: quando o anel
degenera na quantização, o gerador o substitui por um símbolo sintético criado
depois da medição, e sem essa união o Vaticano ficaria com um retângulo de
largura zero — desenhado na tela, mas invisível para o enquadramento.

## Conta e sincronização

O backend de contas é o Supabase provisionado pelo Lovable. O aplicativo fala com ele por HTTP direto (`fetch`), sem SDK — a regra de zero dependências vale também aqui, e o artefato continua sendo um arquivo só.

- Configuração: `src/cloud.json` (endereço e chave `anon`). O build embute esses valores e usa a origem para montar o `connect-src` da CSP. Sem o arquivo, o app não mostra a área de conta e a CSP volta a `'none'`.
- A chave `anon` é publicável por definição: quem protege os dados é a política de linha do banco. A tabela `progresso_atlas` tem RLS ligado e quatro políticas (leitura, criação, atualização, exclusão), todas restritas a `auth.uid() = usuario` e ao papel autenticado. Sem sessão, a chave `anon` não tem privilégio nenhum na tabela: o pedido é recusado, nunca respondido com dados. O papel autenticado só lê, cria, atualiza e apaga; `TRUNCATE`, que passaria por cima da política de linha, não existe para ele. A definição reproduzível da tabela, limites e políticas vive em `supabase/migrations/`.
- Entrada por link mágico no e-mail, sem senha. Os tokens voltam no fragmento da URL, são guardados e imediatamente apagados da barra de endereços, para não ficarem no histórico nem vazarem num "copiar link".
- O cartão distingue tokens recebidos de identidade confirmada: as ações de perfil só aparecem após obter identificador e e-mail válidos. Uma consulta pendente ou com falha não é apresentada como conexão concluída; pode ser retomada sem impedir o treino. Isso não muda os dados enviados nem a fonte de autenticação.
- O progresso trafega no mesmo envelope validado do backup por arquivo; o apelido opcional trafega separadamente pelo perfil da conta. Envelope corrompido no servidor é recusado pela validação e não contamina o aparelho.
- Nunca existe sobrescrita: `Core.planSync` funde os dois lados com `Core.mergeProgress` e diz quem precisa ser atualizado. Um apagar de progresso feito num aparelho vence os desatualizados pela geração do envelope.

## Terras fora dos 195

As feições Admin-0 que não são um dos 195 países vinham fundidas numa silhueta
cinza única e anônima: Groenlândia, Antártida e Saara Ocidental eram o mesmo
borrão. Agora o gerador emite **cada uma identificada**, e `src/context-areas.json`
classifica as 63 em três grupos:

| Grupo | Quantas | Tratamento |
| --- | --- | --- |
| `dependencia` | 45 | Recebe o soberano e a cor de terra dos países. O mapa diz "Groenlândia (Dinamarca)". |
| `disputado` | 13 | **Nunca recebe soberano.** Cor própria e uma nota explicando o status. |
| `sem-soberania` | 5 | Idem: cor própria e nota. |

A divisão existe por um motivo específico: atribuir Saara Ocidental, Taiwan,
Kosovo, Somalilândia, Malvinas, Chipre do Norte ou Gibraltar a um país seria o
Atlas afirmando geopolítica que não tem como sustentar — e o projeto segue a
convenção de facto do Natural Earth justamente para não tomar esse partido.
Antártida, Bir Tawil, o campo de gelo patagônico, a Linha Verde e a Ilha
Brasileira não pertencem a ninguém: não é omissão, é o fato.

O build **recusa** uma dependência sem soberano válido entre os 195, uma área
disputada que receba soberano, e qualquer feição sem classificação. Nenhuma
delas é resposta de pergunta: não carregam `data-id`, e clicar numa delas durante
uma pergunta de localização não registra resposta.

A silhueta fundida continua em `data/map-geometry.json`, onde o gerador a valida,
mas não viaja no artefato — levar as duas duplicaria 285 KB de contorno para
desenhar a mesma coisa.

O traçado dos países e das áreas de contexto viaja compactado, sem perda:
centésimos inteiros, cada ponto como diferença do anterior (`Core.decodePath`).
O app descompacta ao abrir e o build recusa o artefato se algum contorno não
voltar, byte a byte, ao path de `data/map-geometry.json`.

## Idiomas

Ficam em `src/languages.json`, um registro por país, e são **complemento da ficha:
nunca viram pergunta**, pelo mesmo motivo dos indicadores. As alternativas do
quiz são nomes de país e de capital, e um teste confere que nenhuma delas é nome
de idioma.

O dado é **editorial**, como as capitais e os nomes de país, e não gerado de uma
API: nenhuma fonte global entrega os nomes em português nem resolve as ressalvas
abaixo, e uma tradução automática de rótulos em inglês daria uma procedência só
aparente. A base são os textos constitucionais e a legislação linguística de cada
país.

O campo `oficiais` lista o que é **oficial por lei**, na ordem em que a própria lei
estabelece hierarquia — na Irlanda o irlandês vem antes por ser a primeira língua
oficial pela Constituição. Onde a lei **não** elege uma principal, o Atlas também
não elege: Suíça, Bélgica, Canadá e Bósnia aparecem com os idiomas lado a lado,
sem ranking. É a mesma postura já adotada para as três capitais da África do Sul e
para a capital de facto da Suíça.

O campo `nota` existe **só quando o estatuto legal e o uso cotidiano divergem**, e
é uma frase:

| Caso | Por que a nota existe |
| --- | --- |
| Nigéria | O inglês é o único oficial, mas hauçá, iorubá e igbo dominam o cotidiano. |
| Suíça | Quatro línguas nacionais e nenhuma principal — a ausência de hierarquia é o fato. |
| Paraguai | Guarani cooficial e falado pela maioria, muito além das comunidades indígenas. |
| Argentina, Austrália, Uruguai | O idioma é de facto: a lei não declara idioma oficial. |
| Bolívia, México, Zimbábue, Índia | O número real de idiomas reconhecidos não cabe na lista sem virar parágrafo. |

Países que mudaram de regime linguístico recentemente e merecem reconferência
periódica, conferidos em 28/09/2026 no texto de origem:

- **Mali**: o artigo 31 da Constituição de 2023, lido no Journal Officiel,
  torna oficiais as línguas nacionais (13, pela lei) e deixa o francês como
  língua de trabalho. A ficha lista as mais faladas.
- **Burkina Faso**: a revisão constitucional aprovada em dezembro de 2023 e em
  vigor desde novembro de 2024 faz o mesmo e põe francês **e inglês** como
  línguas de trabalho.
- **Níger**: pela Carta da Refundação, promulgada em 26/03/2025, o hauçá é a
  língua nacional, francês e inglês são línguas de trabalho e não há língua
  oficial declarada.
- **Estados Unidos**: a ordem executiva 14224, de 1º/03/2025 (90 FR 11363),
  designou o inglês como língua oficial; nenhuma lei federal o declara.
- **Cazaquistão**: a Constituição de 2026, em vigor desde 1º de julho, mantém
  o cazaque como língua do Estado e o russo "ao lado dele" nos órgãos públicos.

O build **recusa** um país sem idioma registrado, e os testes recusam nome
capitalizado (em português, língua é substantivo comum), idioma repetido na mesma
lista, campo fora do esquema e nota que não seja frase completa.

## Moedas

Ficam em `src/currencies.json`, um registro por país, e seguem **a mesma política dos idiomas: complementam a ficha e nunca viram pergunta**. Adivinhar moeda não é conhecimento geográfico, e o dado muda com redenominações, adesões ao euro e trocas de regime cambial. Um teste confere que nenhum nome de moeda coincide com as alternativas do quiz, que são nomes de país e de capital.

Cada entrada traz `moedas` — uma ou duas, cada uma com `nome` em português e `codigo` ISO 4217 — e uma `nota` opcional. O código acompanha o nome porque é ele que não muda de grafia entre línguas, e porque distingue os muitos "dólar", "franco" e "peso" entre si. O nome vai em minúscula: em português, moeda é substantivo comum. A única exceção registrada é o **ZiG** do Zimbábue, grafado assim pelo próprio banco central.

O dado é **editorial**, como as capitais e os idiomas, e não gerado de uma API: nenhuma fonte global entrega os nomes em português nem resolve os casos abaixo. O critério é o curso legal, não o uso.

A `nota` existe **só quando o curso legal não conta a história sozinho**:

| Caso | Por que a nota existe |
| --- | --- |
| Equador, El Salvador, Timor-Leste | Adotaram o dólar americano no lugar da moeda própria; alguns ainda cunham centavos locais. |
| Panamá | O balboa é paritário ao dólar e só existe em moedas metálicas; as cédulas são dólares. |
| Andorra, Mônaco, San Marino, Vaticano | Usam o euro por acordo com a União Europeia, sem integrar a zona do euro. |
| Montenegro | Usa o euro unilateralmente, o que é diferente dos acordos acima. |
| Butão, Brunei, Essuatíni, Lesoto, Namíbia | Paridade fixa com a moeda do vizinho, que também circula. Onde ela é curso legal registrado na ISO 4217 (rupia indiana no Butão, rand no Lesoto e na Namíbia), entra também na lista. |
| Líbano, Camboja, Venezuela, Zimbábue, RD Congo | O curso legal existe, mas o dólar americano domina o cotidiano. |
| Bulgária | Adotou o euro em 1º de janeiro de 2026, no lugar do lev. |
| Mauritânia, Serra Leoa | Redenominações recentes que ainda confundem quem consulta valores antigos. |

São 142 moedas distintas para 195 países: o euro cobre 26 (os 21 da zona, mais quatro por acordo e Montenegro), o dólar americano 8, e os dois francos CFA e o dólar do Caribe Oriental cobrem blocos inteiros.

**Merece reconferência periódica**, como os idiomas: adesões ao euro, redenominações e trocas de regime cambial são exatamente o tipo de mudança que envelhece este arquivo em silêncio. Como a moeda nunca é resposta, um dado defasado erra uma linha da ficha, não a correção de uma pergunta.

## Indicadores e fatos derivados

São **complementos da ficha do país e nunca viram pergunta**. Adivinhar IDH não é
conhecimento geográfico, e o índice reduz um país a um número que muda a cada
edição do relatório. Um teste confere que nenhum deles aparece nas alternativas
do quiz.

Cada número aparece **com o próprio ano**, porque as séries não andam juntas:

| Dado | Fonte | Referência | Cobertura |
| --- | --- | --- | --- |
| IDH | PNUD, Relatório de Desenvolvimento Humano 2025 | 2023 | 192/195 |
| População | Banco Mundial, `SP.POP.TOTL` | 2025 | 194/195 |
| Expectativa de vida | Banco Mundial, `SP.DYN.LE00.IN` | 2024 | 194/195 |
| Densidade demográfica | Banco Mundial, `EN.POP.DNST` | 2023 | 194/195 |
| População urbana | Banco Mundial, `SP.URB.TOTL.IN.ZS` | 2025 | 194/195 |
| Área florestal | FAO, FAOSTAT Uso da terra (item 6646, elemento 7209) | 2024 | 192/195 |

O IDH vem do PNUD porque **é ele quem define e calcula o índice** — qualquer
outro site apenas republica. A área florestal vem da **FAO**, que produz o dado a
partir da Avaliação Global dos Recursos Florestais (FRA), pelo arquivo completo do
domínio Uso da terra do FAOSTAT (CC BY 4.0). Os demais vêm do Banco Mundial (CC BY
4.0), que republica as projeções da ONU numa API estável. PIB per capita e taxa de
fecundidade foram medidos e ficaram de fora: o primeiro cobre só 181 dos 195, o
segundo diz pouco sobre geografia.

As ausências são poucas, conhecidas e explicadas na própria ficha: Coreia do
Norte, Mônaco e Vaticano ficam sem IDH; o Vaticano fica fora de todas as séries
do Banco Mundial, por ter cerca de 800 residentes; e o FAOSTAT não traz área
florestal para Mônaco, Nauru e Vaticano — a ficha diz isso em vez de supor zero.
Nenhum aparece zerado ou some da ficha. O gerador **recusa** deixar um país sem
número sem explicação registrada.

### Conferência de 28 de setembro de 2026

Cada fonte foi comparada com a edição mais recente de quem produz o dado, não só
com quem o republica:

| Dado | O que foi conferido | Resultado |
| --- | --- | --- |
| IDH | Página de downloads do PNUD | O Relatório 2025 (dados de 2023) ainda é o último; o de 2026 não saiu. |
| População, expectativa de vida | Portal de dados da Divisão de População da ONU | A WPP 2024 ainda é a revisão mais recente; o Banco Mundial já a usa. |
| População urbana | Arquivo F15 da WUP 2025 (definições nacionais) | Os 216 países em comum batem com o Banco Mundial, país a país. |
| Área florestal | Arquivo do FAOSTAT atualizado em 16/09/2026 | O Banco Mundial ainda servia a revisão anterior à FRA 2025: 78 países diferiam em mais de um ponto (a República Centro-Africana passou de 36% para 73%). A série passou a vir da FAO, com 2024. |
| Densidade | Banco Mundial | 2023 é o último ano publicado; o Atlas não calcula densidade própria. |
| Mapa | Tags do repositório do Natural Earth | A v5.1.2 é a última versão lançada; o `master` está em 5.2.0-pre, que não é versão. |
| Bandeiras | Registro npm do flag-icons | A 7.5.0 é a última; ela já traz a bandeira da Síria adotada em 2025. |
| Moedas | Lista ISO 4217 da SIX publicada em 17/09/2026 | Todas conferem. Butão, Lesoto e Namíbia passaram a listar também a moeda do vizinho, que a ISO registra e que a própria nota já dizia ser curso legal. Os códigos de fundo e unidade de conta (BOV, CLF, COU, MXV, USN, CHE, CHW, UYI, UYW) ficam de fora de propósito. |
| Regiões | Tabela M49 da Divisão de Estatística da ONU | Os 195 batem com a subregião do M49. |
| Capitais | Decreto-Lei 1/2026 da Guiné Equatorial; Corte Constitucional da Indonésia (maio de 2026) | A capital da Guiné Equatorial já estava certa. Jacarta continua capital até o decreto presidencial que transfere o posto para Nusantara, e a ficha agora diz isso. |
| Idiomas | Federal Register (EUA), Journal Officiel do Mali, Senado francês (Níger), site da Presidência do Cazaquistão, agência oficial de Burkina Faso | Cinco notas corrigidas; ver [Idiomas](#idiomas). |

`data/indicators.json` guarda os valores, a URL de origem, a data da coleta e o
SHA-256 de cada resposta baixada:

```sh
npm run indicators                            # rebaixa e regrava
node scripts/update-indicators.cjs --check    # confere sem gravar
```

O `--check` ignora a data da coleta e os hashes (que mudam a cada consulta) e
compara o que importa: os valores por país e o ano do IDH.

### Fatos derivados

As frases de destaque da ficha **não são escritas à mão nem por curadoria**: são
consequência aritmética dos dados acima, calculadas em `Core.derivedFacts`. Se um
número mudar na próxima atualização das fontes, a frase muda junto — não há como
envelhecer errado.

Só valem os extremos: rankings mundiais de topo, superlativos dentro da região e
da subregião, contagem de ilhas na cartografia e territórios. "87º maior país do
mundo" é verdade e não é fato nenhum, então o meio da tabela fica de fora de
propósito — e um teste garante isso.

Como extremo é, por definição, para poucos, quem não é extremo em nada recebe uma
âncora de tamanho ("área parecida — Peru"), aceita apenas quando a diferença é
de no máximo 10%. Com isso, 190 dos 195 países têm ao menos um destaque; os cinco
restantes simplesmente não exibem nada.

Desde 16 de setembro de 2026 as fronteiras também entram, pelos mesmos dois
extremos da contagem de `nb`: nenhum vizinho ("um dos 39 países sem fronteira
terrestre"), um único vizinho ("um dos 17 países com um único vizinho") e o
máximo do mundo. A quantidade de países no mesmo caso vai junto porque é o que a
ficha ainda não dizia — ela já lista os vizinhos, mas não diz se aquilo é comum
ou raro. **O topo empata**: Rússia e China fazem fronteira com 14 países cada, e
chamar as duas de "o país com mais vizinhos do mundo" seria falso, então o empate
troca a frase ("entre os países com mais vizinhos do mundo, 14") em vez de
escolher uma vencedora pela ordem da lista. Um teste cobre os três casos e o
empate.

No acerto de uma pergunta aparece **um** destaque, escolhido pelo número da
pergunta, para que repetir o país não repita a frase.

## Apelido opcional da conta

O cartão de conta permite cadastrar, editar e remover um apelido de até 40 caracteres depois de entrar. O login por e-mail não exige apelido. Contas antigas sem apelido continuam válidas. Para remover, apague o campo e salve.

Com conta, são enviados ao Supabase o e-mail usado para entrar, o progresso e, se cadastrado, o apelido. O apelido fica nos dados do perfil do Supabase Auth (`user_metadata.atlas_nickname`), atualizado por `PUT /auth/v1/user`, com HTTP direto e sem SDK. Não integra o backup de progresso nem é apagado ao zerar o aprendizado. O apelido não exige alteração de tabela ou política de acesso.

O perfil é consultado ao reabrir uma sessão e ao usar “Sincronizar agora”. Entre edições em aparelhos diferentes, prevalece a última gravação aceita pelo servidor. Salvar requer conexão; uma falha mantém o texto em edição para nova tentativa enquanto a página continuar aberta, sem impedir o treino ou a sincronização do progresso.

# Revisão da rodada do Codex — 02/10/2026

O Codex trabalhou em 01 e 02/10 direto na pasta do projeto, sem commit, sobre
a branch `claude/epic-galileo-og69d5` (a rodada da tarde de 28/09, que nunca
tinha entrado no `main`), enquanto o git da pasta ainda apontava para o commit
de 17/09. A revisão guardou o trabalho dele como veio, num commit próprio da
branch `claude/rodada-02-10`, e corrigiu no commit seguinte:

- **A atualização automática apagava o resumo da sessão.** Com versão nova
  pendente, o app recarregava cerca de 10 s depois de "Encerrar", e o resumo e
  a revisão focada dos erros, que só existem na memória da aba, sumiam
  (reproduzido no navegador). Agora a troca acontece em "Nova sessão"
  (`reloadForUpdate` em `src/app.js`), depois de confirmar a gravação; o
  cenário de `tests/features-browser.cjs` confere que o resumo fica e que a
  troca preserva o progresso.
- **A explicação de erro de bandeira inventava elementos.** Sem descrição
  conferida (só Austrália e Nova Zelândia têm), a frase mandava comparar
  "faixas, símbolos e estrelas" de qualquer par, inclusive Irlanda ×
  Madagascar. Agora só pede para comparar as duas imagens. Também não diz
  "parecidas": as alternativas saem dos oito vizinhos de `fs`, uma estimativa
  automática que junta, por exemplo, Kiribati e Turcomenistão.
- Os cenários de navegador do Codex regravavam os PNGs de `docs/` a cada
  `npm test`; agora só com `ATLAS_SAVE_EVIDENCE=1`.
- Teste novo em `tests/build.test.cjs`: nenhum arquivo de `src/`, `scripts/`,
  `tests/`, `supabase/`, `qa/` ou da raiz pode ter CR ou NUL. Ele pegaria o CR
  que veio no fim de `scripts/check-editorial-coverage.cjs`.

**Publicado em 02/10/2026 no release `02fa7ce9db11`**, a pedido do usuário,
junto com a rodada da tarde de 28/09, que até então não tinha ido ao ar. Antes,
com autorização dele, a migração `202610010001_impede_regressao_esquema.sql`
foi aplicada no Supabase do Lovable (`wckbqklezfxfoaaiybab`): um bloco que
termina sempre desfeito confirmou que v2 → v1 é recusado e v2 → v4 passa, e o
único progresso gravado (73.514 caracteres, esquema 2) ficou com o mesmo md5
e a mesma data. Só `atlas-195.html` e `sw.js` mudaram; o agente do Lovable os
copiou byte a byte e `npm run verify:production` confere. No site, com o
service worker limpo, o app abre no esquema 4 sem erro no console. O PR 2
(`claude/rodada-02-10` → `main`) passou no CI, inclusive no primeiro job de
compatibilidade Firefox/WebKit, e ficou para o usuário fazer o merge.

Duas decisões continuam com o usuário: a pasta `qa/` traz dependências npm de
desenvolvimento (contraria a regra 1 abaixo, embora nada entre no artefato), e
o código passou a chamar os idiomas de "idioma listado na ficha" e a aceitar
lista representativa ou de uso de facto, quando a política escolhida era
mostrar os oficiais por lei.

---

# Documentação editorial dos 195 países — 02/10/2026

Documentação consolidada em [docs/editorial-195.md](docs/editorial-195.md), com
capital, notas, idiomas listados, moedas e referências individuais. O registro
contém 399 fontes de idiomas/capitais e cobre os 195 países em ambos os campos.
A data de consulta não certifica vigência: 68 países em idiomas e 92 em capitais
têm apenas referência histórica. A cópia independente do Factbook usa revisão
fixa; textos constitucionais traduzidos identificam a versão. O snapshot de
procedência está em data/editorial-reference-audit.json. Nomes traduzidos de
moedas e todas as notas sem fonte específica ainda exigem revisão.

Corrigidos os idiomas listados de Lesoto (cinco, conforme a emenda de 2025),
Quirguistão (russo) e Macedônia do Norte (albanês com estatuto qualificado),
além das notas de Índia, Burkina Faso, México, Maurício e da capital de Honduras.
Fichas, filtros e exportações distinguem idioma listado de idioma oficial nacional;
fontes históricas exibem aviso também no arquivo exportado.

Validação: **203 testes aprovados, zero falhas e zero ignorados**, com Chrome real;
build, orçamentos, atualidade dos indicadores e auditoria editorial estrita passaram.
Artefato: 3183,9 KiB de 3328 KiB. Passaram 24 cenários Firefox/WebKit sem violações
automáticas detectadas, com verificações humanas inconclusivas do axe preservadas.
Chrome 360/1280 px aprovou fontes e download da ficha com o aviso histórico.
Ensaios locais não substituem aparelhos físicos ou avaliação com jogadores.
Contas/Supabase, instalação e novos recursos offline continuam adiados.

---

# Continuação: fontes editoriais e módulos do mapa — 02/10/2026

A suíte completa passou: **201 testes, zero falhas e zero ignorados**, com Chrome
real. Build, orçamentos e verificação de atualidade dos indicadores passaram.
O artefato tem 3065,1 KiB, abaixo do teto de 3328 KiB.

Fontes para trechos de idiomas: 11/195 países; capitais: 10/195. As 16 novas
referências cobrem Brasil, Portugal, França, Espanha, Canadá, Suíça, Países Baixos,
Malásia, Benim, Sri Lanka, Burundi, Guiné Equatorial e Indonésia. O escopo é
individual: a fonte de Putrajaya não certifica toda a ficha da Malásia, por exemplo.
A nota suíça agora distingue línguas nacionais e o uso oficial federal do romanche.
Códigos ISO continuam conferidos nos 195 países. Não há revisão completa de todas
as notas, idiomas e nomes traduzidos de moedas.

O build e audit:editorial agora rejeitam IDs desconhecidos, fontes sem escopo,
URLs inválidas ou com credenciais, datas impossíveis e duplicatas. Essa validação
confere o registro, não comprova a veracidade do conteúdo por si só.

Extraídos src/navigation.js (abas, recolhimento do mapa e dos filtros) e
src/map-viewport.js (escala, zoom, enquadramento, coordenadas e pan agrupado por
frame). app.js caiu de 128,1 para 121,6 KiB. Detecção de países, gestos e regras
do treino ainda têm código no app principal; não se trata de modularização total.
Testes novos verificam toque após rolagem, margens do SVG, pan e limites do zoom.

A avaliação com participantes reais continua pendente. Contas/Supabase,
instalação e disponibilidade offline permanecem adiados pelo usuário.

Verificações complementares desta continuação: 24 cenários Firefox/WebKit
(360/1280 px, claro/escuro, três abas), sem violações automáticas detectadas;
persistem verificações manuais do axe. QA de orientação em Chrome 360/1280 px
e ensaio de desempenho com histórico volumoso e gestos de toque passaram.
São ensaios locais de laboratório, sem validação em aparelho físico ou
observação de participantes reais. Relatórios em reports/compatibility,
reports/guidance e reports/performance.json (arquivos locais ignorados pelo Git).

---

# Clareza do progresso e explicação dos erros — 02/10/2026

Resultado: **197 testes aprovados, zero falhas e zero ignorados** em npm run check
com Chrome real; build, orçamentos e atualidade mínima dos indicadores aprovados.
24 cenários Firefox/WebKit passaram sem violações automáticas detectadas.

Progresso ganhou uma recomendação principal: pendências nos filtros atuais,
depois revisão dos erros da sessão, novidades e treino de hoje. Demais treinos,
histórico, prova, barras de domínio, revisões e dificuldades ficam recolhíveis.
As ações antigas continuam disponíveis. Preferências de conta e backup continuam
acessíveis para preservar foco e edição.

Explicação dos erros: pareamento explícito capital→país, trechos distintos das
capitais sublinhados sem modificar nomes e descrições documentadas para Austrália
versus Nova Zelândia. Outros pares de bandeiras usam orientação visual sem
inventar características; localização mostra subregiões reais e fronteira quando
registrada. Lógica extraída para src/feedback.js, com testes puros; a recomendação
fica em AtlasStudy. Não houve reestruturação completa de mapa/navegação nesta etapa.

Códigos ISO 4217: consulta oficial em 02/10/2026, publicação SIX 17/09/2026,
142 códigos locais presentes, cobrindo os 195 países. Snapshot, hash e códigos em
data/currency-code-audit.json. Não verifica nomes traduzidos ou notas de uso.
Fontes editoriais registradas por trecho em src/editorial-meta.json: idiomas de
4 países, capitais da África do Sul e características de duas bandeiras. Cobertura
individual ainda parcial: npm run audit:editorial gera lista de pendências em
reports/editorial-coverage.md/.json. Fontes, escopo e data aparecem na ficha e na
exportação de texto. Nenhuma data foi atribuída a itens não conferidos.

Novo npm --prefix qa run test:guidance passou em 360 e 1280 px, com cliques reais:
recomendação inicia série de novidades, erro de capital apresenta destaque e ficha
neozelandesa revela as fontes. Capturas inspecionadas visualmente em
reports/guidance/. Um ajuste posterior de classe fez as fontes ocupar a largura
inteira no mobile; build, orçamento e este cenário foram repetidos e passaram.

Roteiro de jogadores atualizado para observar compreensão da recomendação, dos
erros e do escopo das fontes. Nenhum participante real foi observado. Leitores de
tela e aparelhos físicos continuam pendentes. Etapa remota de conta permanece
adiada pelo usuário. Nenhum commit, push, deploy ou escrita no backend.

---

# Evolução, desempenho e acessibilidade — 02/10/2026

Implementadas as três prioridades autorizadas: evolução entre sessões, redução do trabalho ao abrir Progresso e revisão de teclado/foco. Esquema atual 4, com migração de v2/v3; acertos por habilidade só existem nas sessões novas. Comparação exige duas sessões com cinco respostas da mesma família e informa diferença em pontos percentuais sem afirmar ganho de domínio.

Learning.record/merge preservam imutabilidade e ordenação determinística das métricas; backups e fusão exercitados. Listas e grade de domínio montadas por toggle, uma vez por painel. Testes de ficha e confusões agora abrem os detalhes como o jogador.

Suíte completa passou com 193 testes em Chrome, sem falhas/ignorados. Banco local: 19 verificações, incluindo v4→v3 recusado pelo trigger existente. Benchmark 360×640/CPU4: 587 elementos no painel recolhido, 1.757 com a grade de domínio aberta (195 botões, 1.170 elementos adiados). Resultado em reports/performance.json. Timings são de laboratório e não INP/celular físico. CI preparado para rodar o benchmark.

O usuário adiou a etapa de validação remota da conta. Não retomar essa etapa sem nova orientação. Migração segue pendente antes da publicação; nada foi enviado ou publicado. Aparelhos físicos e leitores de tela reais seguem sem validação.

---

# Validação de contas e acessibilidade — 02/10/2026

Correções de sessão impedem renovação concorrente, reconexão após saída e aplicação
de progresso de uma sessão anterior. Erros 429/5xx preservam o login. Saída local
é imediata, mesmo se o servidor ainda não respondeu.

O ambiente encontrado é o backend já configurado em src/cloud.json. Não há
configuração de teste ou acesso administrativo confirmado; a consulta pública de
autenticação respondeu 200 e uma consulta anônima de progresso sem linhas (limit=0)
respondeu 401. Contas de teste não puderam ser confirmadas. Nenhuma escrita remota.

QA adicional em qa/: PostgreSQL WASM descartável executa migrações duas vezes e
18 verificações de isolamento, permissões, limites e versões; Firefox/WebKit,
axe-core e cenários móveis/desktop. Dependências apenas de desenvolvimento,
fixadas com lockfile separado, sem inclusão no artefato. Job preparado no CI.

Corrigidos grupos ARIA do mapa, status e busca; contraste do título do mapa e do
país selecionado no tema claro. Reprodução em qa/README.md; avaliação humana e
contas reais em docs/validacao-com-jogadores.md. Continuam pendentes a migração
remota, login por e-mail, aparelhos físicos e observação de participantes.

---

# Atualização prioritária — 01/10/2026

Checkup mobile concluído: navegação inferior em até 820 px, alvos de toque de 44 px, campos de 16 px, busca antes da ficha e resultados recolhíveis no celular, retorno à busca e botão para o mapa, enunciado junto do mapa e rolagem para feedback/próxima pergunta. Cenário tests/mobile-checkup-browser.cjs integrado ao smoke test; pode ser executado com ATLAS_BROWSER_SCENARIO=mobile-checkup. O npm run check passou com 187 testes, sem falhas nem ignorados. Evidências e limites em TEST_REPORT.md e docs/mobile-review/.

Três melhorias adicionais concluídas: `npm run audit:sources` gera relatórios Markdown/JSON com diferenças e falhas independentes; o CI mensal/manual guarda os relatórios. Fichas têm links e definições por indicador, também exportados. Confusões recorrentes permitem comparar o par e praticar seis perguntas com retomada. Validação atual: 187 testes aprovados, nenhum ignorado, com Chrome real; auditoria remota sem mudanças. A configuração do CI ainda precisa ser enviada ao repositório para executar remotamente.

Nova varredura de dados concluída em 01/10/2026: área florestal agora vem da API publicada da FRA 2025, com 195/195 países. scripts/fra-data.cjs valida a porcentagem publicada contra as áreas e recusa ausências; o ciclo 2025 fica fixado e revisões dentro dele são consultadas pelo importador. Inglês oficial na Nova Zelândia e curdo nacional na Síria atualizados. Auditoria em DATA_SOURCES.md; 182 testes aprovados com Chrome real e nova comparação remota dos indicadores sem divergências.

As melhorias de exploração e estudo foram implementadas localmente nesta rodada. Instalação e novas funcionalidades offline foram adiadas pelo usuário. O estado atual está em IMPROVEMENTS.md e na seção de melhorias de outubro do README; as listas e contagens históricas abaixo descrevem rodadas anteriores.

Novos módulos: src/learning.js (validação, fusão, retenção e apresentação dos históricos), src/country-tools.js (comparação, links e exportação), src/features.css (estilos e impressão). Todos estão integrados ao build e aos orçamentos. Progresso usa esquema 3 e migra dados anteriores; o backend aceita o mesmo envelope JSON, sem nova tabela. A migração supabase/migrations/202610010001_impede_regressao_esquema.sql deve ser aplicada antes da publicação para impedir que clientes antigos sobrescrevam históricos v3; foi preparada, mas não executada. Backups v3 não são compatíveis com clientes antigos. A política de conta foi atualizada para informar tempo de resposta e confusões.

Os históricos começam nesta versão: tempo ativo em perguntas respondidas, 200 sessões detalhadas e 1.000 confusões recentes. Tempo total permanece acumulado. Instalação/offline não receberam novos recursos. Nenhuma publicação ou alteração do Supabase real foi executada.

Os cenários novos estão em tests/features.test.cjs e tests/features-browser.cjs; capturas em docs/features-review/. O teste de navegador precisa rodar com acesso ao Chrome; no ambiente restrito a conexão CDP era encerrada. A identificação do país nos cenários de revisão agora compara a pergunta inteira, para não confundir Guiné com Papua-Nova Guiné.

---

# Prompt de continuação — Atlas 195

> Copie tudo daqui para baixo e cole como primeira mensagem numa sessão nova
> do Claude Code, já dentro da pasta do projeto. O arquivo é autocontido: quem
> receber não tem o histórico da conversa anterior.

---

Você vai continuar um projeto que já existe e está maduro — não é um esqueleto.
Leia este briefing inteiro antes de mexer em qualquer arquivo. Eu sou leigo em
programação: explique decisões em linguagem simples e evite jargão sem tradução.

## O projeto

**Atlas 195** — treinador de geografia em português (bandeiras, capitais,
localização no mapa, silhuetas, regiões e subregiões dos 195 países), com
revisão espaçada, prova, indicadores oficiais e conta opcional para
sincronizar entre aparelhos.

- Código: `https://github.com/davifrancarlx-svg/projetoAtlas` (branch `main`)
- No ar: `https://atlas-195.lovable.app`
- Requer **Node 22 ou superior** (um teste usa WebSocket nativo para controlar
  um Chrome de verdade)

```sh
npm test          # suíte completa; um dos testes abre o app num Chrome real via CDP
npm run build     # gera atlas-195.html + manifest.webmanifest + sw.js + ícones
npm run budget    # impede crescimento acidental dos principais artefatos
npm run serve     # servidor local em http://127.0.0.1:8743/atlas-195.html
npm run indicators   # rebaixa população/IDH das fontes oficiais (raro precisar)
npm run icons        # regera os ícones PWA (raro precisar)
```

**Antes de qualquer coisa, leia `README.md` e `DATA_SOURCES.md`.** Os dois
estão atualizados e documentam em detalhe: todo modo de jogo, a proveniência
de cada fonte de dados (Natural Earth, flag-icons, PNUD, Banco Mundial, FAO), a
distinção região/subregião, as fronteiras terrestres, o esquema de
conta/sincronização, a classificação das terras fora dos 195 e os fatos
derivados. Este arquivo aqui é só o operacional — não repete o que já está
bem contado lá.

### Como está organizado

O produto final é **um único arquivo autocontido**, `atlas-195.html` (~2,9 MB),
com CSS, JS, mapa SVG, bandeiras e fontes embutidos. O traçado do mapa e as
bandeiras viajam compactados sem perda (ver a rodada da tarde de 28/09). Abre direto do disco, sem
servidor e sem internet. **Esse arquivo é gerado — nunca edite ele à mão.**

- `src/core.js` — regras puras, sem DOM: validação de respostas, progresso,
  revisão espaçada, projeção do mapa, fatos derivados, variante de silhueta e
  motivo do erro. O que os testes cobrem melhor.
- `src/app.js` — interface, mapa, controles, renderização, séries fechadas
  (prova, treino de hoje, prática de um país) e a retomada de série.
- `src/account.js` — a conta opcional inteira (link mágico, perfil, apelido,
  sincronização). Recebe as dependências do app por injeção e é testada sem DOM.
- `src/atlas.js` — a aba Atlas: busca, filtro por área, ficha do país e
  territórios. Saiu de `app.js` pelo mesmo motivo da conta.
- `src/progress.js` — a aba Progresso: totais, domínio, revisões, prova,
  backup e a conversa do recomeço. Apagar de verdade continua em `app.js`
  (`resetAllProgress`), que é quem sabe gravar.
- `src/sync-queue.js` — fila pequena e testável que serializa sincronizações e não perde mudanças concorrentes.
- `src/study.js` — treino de hoje, próxima revisão e resumo de evolução.
- `src/audio.js` — sons opcionais sintetizados (acerto, erro e fim de série),
  em quatro estilos de timbre, mais o painel de som da aba Progresso.
- `src/styles.css` — visual. Toda cor é um token em `:root`; o tema claro é
  uma redefinição desses tokens, tanto por `prefers-color-scheme` (automático)
  quanto por `[data-theme]` (escolha fixada pelo botão do app).
- `src/index.template.html` — estrutura da página, com marcadores `{{CSS}}`,
  `{{DATA}}`, `{{CSP}}` etc.
- `src/sw.js` — service worker (instalação como app, funcionamento offline).
- `src/cloud.json` — endereço e chave pública do Supabase usado pela conta opcional.
- `src/countries.base.json`, `src/territories.json`, `src/context-areas.json`,
  `src/content-policy.json`, `src/languages.json`, `src/borders.json`,
  `src/currencies.json` — dados editoriais dos 195 países (com subregião M49),
  dos territórios não soberanos, das terras fora do escopo, de correções
  pontuais (capital disputada, região M49 etc.), dos idiomas oficiais, das
  fronteiras terrestres e das moedas.
- `data/map-geometry.json`, `data/flags.json`, `data/indicators.json`,
  `data/fonts/` — dados gerados a partir de fontes externas, cada um com
  origem, data e SHA-256 registrados. Regenerados pelos scripts em `scripts/`,
  cada um com `--check` para conferir sem regravar.
- `scripts/build.cjs` — monta o arquivo final a partir de tudo acima e valida
  os dados editoriais (subregião de um só continente, fronteiras simétricas).
- `supabase/migrations/` — tabela e políticas RLS da conta, versionadas para auditoria e recuperação.
- `tests/` — 160 testes em `node --test`, incluindo um smoke test que abre um
  Chrome de verdade via CDP e chama os cenários de `*-browser.cjs`.

## Regras inegociáveis

1. **O projeto não tem nenhuma dependência npm e isso é proposital.** Não
   instale pacotes. Ícones PNG, controle do Chrome nos testes, tudo foi feito
   só com o que vem no Node.

2. **Quebras de linha precisam ser LF, nunca CRLF, e nenhum fonte pode ter
   caractere de controle solto.** O arquivo final se protege com hashes de CSP
   calculados sobre o conteúdo exato; o navegador normaliza CRLF→LF e troca
   NUL por outro caractere antes de conferir o hash, então um artefato com
   CRLF ou com NUL invalida os hashes e **a página inteira para de funcionar,
   sem erro visível**. Isso já derrubou o site em produção uma vez (CRLF) e
   quase aconteceu de novo em 2026-09-16, quando um escape `\u0000` numa
   expressão regular virou um NUL de verdade ao criar `src/account.js`.
   Defesas: `.gitattributes` com `eol=lf`, normalização no build, um teste e a
   recusa do build a artefato com CR ou NUL — não desative nenhuma. Ao gerar
   código com ferramenta, confira que sequências `\uXXXX` chegaram ao arquivo
   como texto, não como o caractere.

3. **Nunca edite `atlas-195.html`, `sw.js` ou `manifest.webmanifest` na raiz
   diretamente.** Edite `src/` e rode `npm run build`.

4. **Sempre rode `npm test` antes de commitar.** Há CI no GitHub que roda a
   suíte a cada push — confira que ficou verde.

5. **Verifique no navegador de verdade, não só nos testes.** Use
   `npm run serve` e abra a página, ou use as ferramentas de browser
   disponíveis na sessão. Testes em Node não enxergam "o app não inicia" —
   foi exatamente esse tipo de defeito (regra 2) que motivou o smoke test.
   Atenção: uma aba que já tinha o app aberto continua servindo a versão
   antiga do cache do service worker até o próprio worker atualizar; confira a
   versão pela CSP do documento ou recarregue duas vezes.

6. **Ações de risco pedem confirmação primeiro**, mesmo dentro do que já foi
   pedido: publicar no Lovable, mudar a classificação de uma terra disputada,
   ou qualquer coisa que mude a promessa de privacidade do app.

7. **Sem conquistas, troféus ou gamificação.** Existiu um sistema de 25
   conquistas; o usuário não gostou do resultado e pediu a remoção completa
   em 2026-09-16. Não reintroduzir nem propor de novo.

8. **Resposta só por escolha.** A digitação foi removida a pedido do usuário
   em 2026-09-28: toda pergunta tem alternativas, ou se responde apontando no
   mapa. Não reintroduzir campo de texto, modo "Digitar" nem reconhecimento de
   grafia.

## O que já existe (não é para reconstruir, é para conhecer)

- **Modos de treino**: misto, bandeiras, capitais, localização, regiões —
  sete direções de pergunta, com filtro por região e por subregião (22
  subregiões do M49 da ONU, em todos os continentes; a América do Sul é a
  única sem subdivisão porque o M49 não a divide).
- **Variantes de pergunta, não direções novas.** "Mapa → país" alterna entre
  pin e silhueta. "País → mapa" tem três formas: apontar no mapa (metade dos
  sorteios), escolher entre quatro silhuetas e dizer quem faz fronteira. Todas
  gravam na mesma habilidade do progresso — é `question.variant` no núcleo, e
  na fronteira a resposta certa vem em `question.answerId`, que não é o país da
  pergunta. Países abaixo de `Core.SHAPE_MIN_AREA` nunca viram silhueta; países
  sem vizinho nunca viram pergunta de fronteira. **Esse é o caminho barato para
  exercícios novos**: direção nova mexeria em validação, migração, fusão e
  sincronização do progresso.
- **Cronômetro opcional** (pausa com a aba oculta), **baralho de revisão de
  erros**, **modo prova** (10/20/30 perguntas fechadas com nota), **treino de
  hoje** e **prática de um país** a partir da ficha do Atlas.
- **Retomar o que ficou pela metade**: prova, treino de hoje, prática de país e
  **revisão focada** ficam em `atlas195:serie:v1` neste navegador; ao abrir, o
  app oferece retomar ou descartar. Qualquer outra ação descarta. Na série o
  tempo parado não conta; na revisão voltam a fila, o placar e quantos acertos
  faltam para cada carta. O rascunho é versionado por `v` (hoje 2).
- **Mapa**: projeção Robinson própria, zoom por gesto/roda/botões, resposta
  certa marcada com um pin de tamanho fixo (sem zoom automático: o usuário
  não gostou de a visão mudar sozinha).
- **Terras fora dos 195** (Groenlândia, Antártida, Taiwan...) desenhadas
  identificadas — dependência de um dos 195 recebe a cor do soberano; área
  disputada ou sem soberania recebe cor própria e uma nota, nunca um dono.
  Nenhuma delas é resposta de pergunta.
- **Ficha do país**: outro nome e nome anterior (quando há), capital com as
  mesmas notas do veredito do erro (`Core.capitalNotes`), subregião, área,
  idiomas oficiais, moeda com código ISO, fronteiras terrestres, seis
  indicadores oficiais (com o ano de cada um), fatos derivados, o domínio do
  jogador por habilidade e o botão Praticar. Vizinhos abrem a própria ficha;
  idioma e moeda filtram a lista pelo valor exato (`state.atlasFacet`). A
  busca aceita também idioma, moeda e os outros nomes, e há um filtro por
  área: os seis baldes amplos e, sob o escolhido, as subregiões dele.
- **Explicação do erro**: diz de quem era a resposta escolhida (a capital
  errada é de qual país, a bandeira errada é de quem) e o motivo da confusão
  (bandeira parecida, capitais parecidas, fronteira em comum, perto no mapa,
  mesma subregião).
- **Progresso**: totais de todo o histórico (respostas, acerto, recorde de
  sequência), sessão atual, domínio por habilidade e por região, revisões
  recomendadas, pontos para reforçar, conta, backup, apagar.
- **PWA completo**: instalável, funciona offline, avisa a aba aberta quando
  uma versão nova é publicada.
- **Tema**: automático (segue o sistema) por padrão, com botão para fixar
  claro ou escuro. **Sons** opcionais de acerto e erro.
- **Conta opcional**: sincroniza progresso via Supabase, sem exigir cadastro
  para treinar. `connect-src` na CSP abre só para a origem do Supabase — ver
  `src/cloud.json` e `DATA_SOURCES.md` § Conta e sincronização.

## Como publicar no Lovable

O site no Lovable **não está ligado ao GitHub** — é um projeto React que só
redireciona para o `atlas-195.html` estático, hospedado à parte.

1. `npm run check` (precisa passar)
2. Commit e push para o GitHub (CI precisa ficar verde)
3. Comparar cada arquivo publicável com `release-manifest.json`; depois do envio,
   `npm run verify:production` precisa confirmar os hashes servidos em produção.
4. Enviar os arquivos que mudaram para o projeto Lovable
   (id `d00d8eb3-5261-428f-b5bb-7d8f89247846`) e pedir explicitamente para
   **copiar byte a byte, sem reformatar, sem linter** — um byte alterado
   quebra os hashes de CSP e derruba a página inteira.
5. Publicar e conferir o hash do arquivo já no ar antes de considerar concluído.

**Só publique no Lovable se o usuário pedir.** Terminar de codar e testar
localmente não é licença para publicar sozinho.

## Estado atual (16 de setembro de 2026)

Rodada grande, commitada e enviada ao GitHub, **não publicada no Lovable**:

- Conquistas removidas por completo (código, testes, estilos, som, docs e a
  migration `202609100001_conquistas_atlas.sql`, que nunca chegou a ser
  aplicada no Supabase — não há nada a desfazer no banco). O app apaga o
  registro local antigo `atlas195:conquistas:v1` ao abrir.
- Conta separada em `src/account.js` (orçamento próprio de 24 KiB).
  `src/app.js` ficou em ~145 de 150 KiB sem aumento de limite.
- Correções: recorde visível, país da resposta errada no veredito, atalhos
  1–4 depois de clicar numa aba, cronômetro pausado com a aba oculta, lista de
  erros da sessão igual na aba Progresso e no fechamento.
- Novidades: subregiões M49 em todos os continentes, ficha com domínio e
  Praticar, busca por idioma, estatísticas gerais, retomar série interrompida,
  silhueta, fronteiras terrestres (`src/borders.json`, 313 pares).
- Verificação: 144 testes passaram (`npm run check`), Chrome real incluído.

Segunda rodada do mesmo dia, também commitada e enviada, **não publicada**:
as cinco sugestões que estavam em `IMPROVEMENTS.md` foram implementadas.

- Pergunta de fronteira e silhueta invertida, as duas como variantes de
  `locate` (ver a seção de variantes acima).
- Filtro por área na aba Atlas e moeda na ficha (`src/currencies.json`).
- A revisão focada passou a ser retomável, no mesmo rascunho das séries.
- Aba Atlas separada em `src/atlas.js` (orçamento próprio de 20 KiB).
- O teto de `src/core.js` subiu de 80 para 88 KiB, decisão consciente
  registrada em `scripts/check-budgets.cjs`. O de `src/app.js` **não** subiu e
  ficou em ~141 de 150 KiB. Não suba nenhum dos dois por conveniência: separar
  um bloco coeso, como foi feito com a conta e com o Atlas, é o caminho.
- Verificação: 151 testes (`npm run check`) com Chrome real, mais conferência
  manual em claro/escuro a 1280 e 360 pixels.

**Publicado em 16 de setembro de 2026**, a pedido do usuário, com as duas
rodadas juntas. `npm run verify:production` reporta "Produção confere com o
release c8cf8b750232"; o agente do Lovable copiou os dois arquivos com `cp` e
devolveu os sha256 idênticos aos do `release-manifest.json`. Conferido ao vivo
em `atlas-195.lovable.app`: o app inicia, os quatro módulos carregam, o
service worker registra, o console fica limpo, a ficha mostra a moeda e a
pergunta de fronteira aparece. Só `atlas-195.html` e `sw.js` divergiam e só
eles foram enviados.

Sobrou no artefato uma menção a "conquistas": é o comentário e a linha que
apagam o registro local antigo (`atlas195:conquistas:v1`) de quem usou a
versão anterior. Não aparece na interface e deve continuar lá por enquanto.

### Quatro rodadas, publicadas juntas no release `fb6d9cedae82`

Tudo abaixo está commitado, no GitHub com CI verde e **no ar** desde
16 de setembro de 2026, 20h53 UTC, a pedido do usuário. `npm run verify:production`
confere os sete arquivos: `atlas-195.html` com 5.195.199 bytes
(`dddc2bb7b946a3ec…`) e `sw.js` com 4.183 bytes (`8a7607c0ea70dc54…`).

Conferido num Chrome de perfil novo, que é o que um visitante novo encontra:
195 países, CSP intacta (os módulos carregam), os quatro estilos de som, o
painel de som na aba Progresso, o fato de fronteira na ficha do Japão e o cache
do worker já com o nome `atlas-195-fb6d9cedae82` guardando o HTML novo.

- `480fe92` — rodada do Codex, revisada e aceita: contador da prova, ciclo da
  revisão, cache offline mais seguro (o HTML é obrigatório na instalação e o
  worker não apaga o cache antigo sem ter o novo), lotes de pendências e
  cartões de comparação no veredito.
- `b20273e` — alto contraste do sistema. O bloco `@media (forced-colors:
  active)` **precisa continuar no fim do `src/styles.css`**: media query não
  soma especificidade, e do meio do arquivo ele perdia para qualquer regra de
  componente escrita depois — era por isso que nem os destaques antigos de
  certo e errado funcionavam. Dentro dele, `transition: none` também é
  necessário: a transição de cor de 160 ms do mapa atrasava a troca.
- Som: quatro estilos de timbre, o efeito de fim de série, a opção de tocar só
  nos erros e o painel da aba Progresso. O teto de `src/audio.js` subiu de 8
  para 12 KiB — o painel não cabia em `app.js`, que está em 97%.
- Fatos derivados de fronteira: `Core.derivedFacts` passou a usar
  a contagem de `nb`, só nos extremos, com empate tratado — ver a seção "Fatos
  derivados" do `DATA_SOURCES.md`. `src/core.js` foi de 79,3 para 80,9 KiB.
  160 testes passando com Chrome real, mais conferência da ficha num Chrome de
  verdade (Japão, China, Portugal e Alemanha).

### Rodada de 28 de setembro de 2026 — publicada no release `51cc13762c0f`

**No ar desde 28/09/2026, 15h UTC**, a pedido do usuário, junto com a página
inicial do Lovable descrita mais abaixo. PR
https://github.com/davifrancarlx-svg/projetoAtlas/pull/1 com CI verde.
Publicação feita assim, e é o caminho a repetir: os dois arquivos que mudaram
(`atlas-195.html`, 5.187.315 bytes, `2770118bda6a6366…`, e `sw.js`, 4.183
bytes, `71b8066edf1d1876…`) foram enviados por `get_file_upload_url` + PUT e
anexados numa mensagem ao agente do Lovable, que os copiou com `cp` para
`public/` e devolveu os sha256 idênticos (commit Lovable `4bafa2a`, só esses
dois arquivos no diff). Depois de `deploy_project`, o próprio agente do Lovable
baixou do domínio publicado com `curl` e conferiu os dois hashes e o
cabeçalho de `/`. Este contêiner não alcança `*.lovable.app` (a rede do
ambiente bloqueia), por isso `npm run verify:production` não roda daqui.


- **No celular, o mapa só vem antes do painel quando é a própria pergunta**
  (apontar no mapa ou ler o pin). Antes, toda pergunta visual subia o mapa, e
  nas de bandeira nenhuma alternativa aparecia sem rolar: numa tela de
  390×844, a primeira começava em 929 px. Quem decide é `isMapQuestion` em
  `src/app.js`, pelo atributo `data-question-map` (antes
  `data-question-visual`); `isVisualQuestion` continua decidindo só o botão
  de pular. Esse botão mora no cabeçalho do mapa, então nas perguntas de
  bandeira ele passou a ficar abaixo das alternativas no celular.
- **A grade de quatro bandeiras e de quatro silhuetas tem duas colunas também
  abaixo de 560 px.** As quatro cabem juntas na tela, que é como se compara;
  em coluna única a grade ia até 1344 px.
- **A linha de instrução abaixo da placa não repete mais a direção**
  ("capital → país" aparecia duas vezes). Ela só fica quando acrescenta algo:
  "Observe as formas e cores", "Escolha uma bandeira", "Selecione o país no
  mapa". Nauru, sem capital oficial, diz "sede do governo" na própria placa.
- Teste novo `tests/mobile-browser.cjs`, a 390×844 dentro do smoke test:
  ordem do painel e do mapa nas sete formas de pergunta, as quatro opções da
  grade na primeira tela e nenhuma instrução repetindo a placa. 167 testes com
  Chrome real. `src/app.js` ficou em 146,3 de 150 KiB (97,6%).

**Silhuetas na forma real e barra de opções aberta por padrão** (mesmo dia). O usuário estranhou a Islândia no mapa. Não é
defeito de dado: é a Robinson, que estica na horizontal o que fica perto dos
polos e inclina o que fica longe do meridiano central. Medido nos 195: 35
passam de 25% de deformação (Islândia 78%, Suécia, Noruega, Finlândia, Nova
Zelândia, Canadá, Rússia, Japão, Coreias...). Trocar de projeção foi medido e
descartado: a Winkel Tripel melhora os nórdicos e piora Japão, Nova Zelândia e
Brasil, com 78 países acima de 25%. A escolha do usuário foi manter o mapa e
corrigir onde a forma é o assunto:

- `Core.trueShape` volta o contorno a longitude e latitude e o reprojeta
  numa ortográfica centrada no aglomerado principal do país. Usado pelas
  perguntas de silhueta, pelos cartões de comparação e pela ficha do Atlas,
  que ganhou a silhueta real. A Islândia volta de 2,55 para 1,41 de largura
  por altura (a real é cerca de 1,45).
- `Core.distortionNote` escreve na ficha, só acima de 25%, se o país sai
  esticado, inclinado ou os dois no mapa-múndi.
- A barra de opções de treino abre por padrão no computador e no tablet e
  começa recolhida no celular (até 560 px de largura ou 500 de altura), onde
  aberta ocuparia 497 dos 844 px e esconderia as alternativas. Foi escolha do
  usuário. Recolher ou abrir vira preferência salva em `filtersHidden`; o
  antigo `filtersCollapsed` é ignorado porque era gravado com qualquer outra
  preferência enquanto o padrão era fechado. O modo foco não grava mais a
  barra como recolhida.
- Testes novos: `tests/shape.test.cjs`, `tests/filters-browser.cjs` e a ficha
  em `tests/variants-browser.cjs`. 174 testes com Chrome real.
- Orçamentos: `src/core.js` 85,6 de 88 KiB (97,3%) e `src/app.js` 147,1 de
  150 KiB (98,1%). A próxima novidade em qualquer um dos dois precisa
  separar um bloco antes; a geometria de exibição do núcleo (projeção, zoom,
  enquadramento e forma real) é a candidata natural.

**Resposta só por escolha** (mesmo dia). A pedido do
usuário, a digitação saiu do app inteiro: o controle "Resposta" da barra, o
campo de texto, o reconhecimento de texto do núcleo (`matchAnswer`,
`matchCountryAnswer`, `fuzzy`, `acceptedAnswers`, tipos de alias seguros) e
`PICK_ONLY_DIRECTIONS`. `Core.createQuestion` sempre gera as alternativas e
`Core.gradeAnswer` não recebe mais modo de resposta: só apontar no mapa, que
não tem alternativas, conta como recuperação sem chance cega. Os nomes
alternativos continuam no artefato porque a busca do Atlas os usa. Preferência
e rascunho antigos com `answerMode: 'type'` são ignorados (o fixture de
`tests/workflows-browser.cjs` grava um de propósito). Na mesma rodada, a barra
de opções deixou de cortar os botões de Modo entre 821 e 980 px e passou a ter
os cinco numa linha até 820 px. 170 testes com Chrome real; `src/app.js` caiu
para 142,3 KiB (94,8%) e `src/core.js` para 76,5 KiB (86,9%).

**Banco da conta alinhado às migrations, já em produção (28/09/2026).** O
Supabase do Lovable (`wckbqklezfxfoaaiybab`, o mesmo de `src/cloud.json`) não
tinha o `FORCE ROW LEVEL SECURITY`, nem os dois limites do envelope, e usava
quatro políticas antigas ("le o proprio progresso" etc.) valendo para o papel
`public`, com `anon` e `authenticated` mantendo todos os privilégios padrão,
`TRUNCATE` incluído. Foi aplicado o que faltava da `202608200001` e a nova
`202609280001_alinha_permissoes_progresso.sql`. A conferência trocou de papel
dentro de blocos que terminam em erro, para nada ficar gravado: a dona lê e
grava a própria linha (inclusive o upsert que o app faz), outra conta não lê
nem grava a linha alheia, o `anon` recebe permissão negada, nenhum papel tem
`TRUNCATE`, e os limites recusam lista e excesso de 2 MB. O único progresso
gravado (69,7 KB) ficou intacto. Consequência documentada: sem sessão, um
pedido com a chave `anon` agora é recusado em vez de devolver lista vazia; o
app só consulta a tabela com sessão, então nada muda para quem usa.

**Página inicial do Lovable corrigida e publicada.** O
`src/routes/__root.tsx` do projeto Lovable tinha o cabeçalho padrão ("Lovable
App", "Lovable Generated Project", `lang="en"`), que é o que o WhatsApp e as
redes sociais mostram ao compartilhar `atlas-195.lovable.app`. O agente do
Lovable trocou título, descrição, `og:*`, `twitter:*` e ícone pelos mesmos
textos do `atlas-195.html`, pôs `lang="pt-BR"`, traduziu as páginas de erro e
404, e acrescentou em `src/routes/index.tsx` um `<meta http-equiv="refresh">`
que leva a `/atlas-195.html` antes de o React carregar (commit Lovable
`2f30adb`). O mesmo commit trouxe duas atualizações automáticas da
plataforma: `@lovable.dev/vite-tanstack-config` fixado em 2.23.1 e um ajuste
em `previewAuthStorage.ts`. Foi ao ar junto com o release `51cc13762c0f`;
o WhatsApp pode guardar a prévia antiga do link por algum tempo.

### Rodada da tarde de 28 de setembro de 2026 — não publicada

Pedida pelo usuário a partir da lista de melhorias: itens 2, 3 e 5 (o 1, o
app se atualizar sozinho e o aviso aparecer no modo Foco, ficou para depois).
Branch `claude/epic-galileo-og69d5`, recomeçada do `main` depois do merge do
PR 1.

- **Aba Progresso em módulo próprio** (`src/progress.js`, orçamento de 26
  KiB), no formato de `atlas.js`: recebe estado, fabricantes de elemento e
  ações por injeção e devolve `render`. `src/app.js` foi de 142,3 para ~123
  KiB. Mesmos textos e IDs de antes; os testes de reset, importação e revisão
  passaram sem mudança. De carona, o comentário de `scripts/build.cjs` que
  fala do NUL deixou de ter um NUL de verdade.
- **Ficha do Atlas mais completa.** As notas da capital saíram de
  `explanatoryNotes` para `Core.capitalNotes` e aparecem na ficha; vizinhos,
  idiomas e moedas são botões com cara de link (`.ficha-link`). O filtro de
  idioma e moeda compara o valor exato, porque a busca por texto acharia o
  Turcomenistão em "turco" e a Europa inteira em "EUR"; soma com área e busca
  e sai pelo botão "Limpar filtro". "Outro nome" e "Nome anterior" vêm de
  `alsoKnownAs` e `formerNames` em `src/content-policy.json`; ver
  `DATA_SOURCES.md`. Saíram as grafias só de digitação (Abidja, Aden,
  Birmania). O orçamento de `atlas.js` subiu de 20 para 24 KiB. Testes novos:
  `tests/names.test.cjs` e `tests/ficha-browser.cjs` (no smoke test).
- **Arquivo de 5,0 para 2,9 MB, sem perda.** O traçado viaja em centésimos
  inteiros como diferença do ponto anterior e `Core.decodePath` o abre no
  início de `app.js`; o build recusa o artefato se algum país ou área de
  contexto não voltar byte a byte ao path do gerador. As bandeiras vão como
  SVG em texto em vez de base64, e as 195 foram comparadas pixel a pixel no
  Chrome contra as antigas, sem diferença. Comprimido: gzip de 1,62 para
  1,05 MB, brotli de 1,14 para 0,88 MB. Custo: com a CPU quatro vezes mais
  lenta, abrir levou cerca de 70 ms a mais (mediana de ~880 para ~950 ms). A
  simplificação do traçado, que perderia detalhe dos países pequenos, não foi
  feita. O teto do artefato desceu de 5,25 para 3,25 MiB.

174 testes com Chrome real.

**Conferência das fontes de dados** (mesmo dia, a pedido do usuário: "as mais
recentes e as mais confiáveis"). Cada dado foi comparado com a edição mais nova
de quem o produz; a tabela completa está em `DATA_SOURCES.md` § Conferência de
28 de setembro de 2026. O que mudou:

- **Área florestal passou do Banco Mundial para a FAO** (FAOSTAT, arquivo do
  domínio Uso da terra, atualizado em 16/09/2026, ano 2024). O Banco Mundial
  ainda servia a revisão anterior à FRA 2025, com 78 países diferindo em mais
  de um ponto. `scripts/update-indicators.cjs` ganhou um leitor mínimo de ZIP e
  CSV, só com o Node; Mônaco, Nauru e Vaticano ficam com nota (`faoNota`), não
  com zero. A ficha credita a FAO.
- **Idiomas**: notas de EUA (ordem executiva 14224), Burkina Faso (inglês
  também é língua de trabalho), Mali (13 línguas nacionais), Níger (Carta da
  Refundação) e Cazaquistão (Constituição de 2026), cada uma lida na fonte.
- **Moedas**: Butão, Lesoto e Namíbia listam também rupia indiana e rand, como
  a ISO 4217 de 17/09/2026.
- **Capital da Indonésia**: nota sobre Nusantara, depois da decisão da Corte
  Constitucional de maio de 2026.

Sem mudança, por já estarem na última edição: IDH (Relatório 2025), população,
expectativa de vida e urbanização (o Banco Mundial já usa a WPP 2024 e a WUP
2025), densidade (2023 é o último ano publicado), Natural Earth v5.1.2,
flag-icons 7.5.0 e as 195 subregiões do M49. A API do portal de dados da ONU
passou a exigir login (401), por isso a conferência usou os arquivos de
download da WUP.

### Armadilha de verificação no navegador

**Isso vale também para o site publicado.** Ao conferir o release
`fb6d9cedae82` no ar, um navegador que já tinha visitado o site continuou
mostrando a versão anterior: o worker antigo respondia toda navegação com o
HTML do cache dele (`atlas-195-c8cf8b750232`, 5.177.324 bytes), enquanto o
servidor já entregava o arquivo novo em onze requisições seguidas. Quem
verifica precisa de **perfil novo** ou de desregistrar o worker e limpar os
caches antes; senão é fácil concluir que a publicação falhou quando ela
funcionou. `scripts/` não tem isso automatizado — foi feito à mão com CDP.

Uma aba que já abriu o app continua servindo o artefato **do cache do service
worker** depois de um `npm run build`. Uma verificação manual pode testar
código antigo sem avisar — aconteceu nesta rodada. Antes de conferir à mão,
desregistre o worker e limpe os caches, ou confira que algo novo existe na
página (por exemplo `typeof AtlasBrowser`). O smoke test não sofre disso
porque usa um perfil temporário a cada execução.

### Ideias registradas, não pedidas ainda

`IMPROVEMENTS.md` tem treze, da mais barata à mais cara, cada uma com o
trecho de código que a justifica. As três primeiras da lista anterior (notas
da capital na ficha, ficha navegável e outros nomes) foram feitas na tarde de
28/09/2026; duas saíram junto com a digitação, no mesmo dia. Fora da lista,
o usuário deixou para depois o app se atualizar sozinho quando não há
pergunta em andamento e o aviso de versão nova aparecer no modo Foco, que
hoje esconde `.app-status`.

Duas foram **descartadas pelo usuário** e não devem voltar: a busca aceitar o
código ISO e o domínio por subregião na aba Progresso. Continuam fora:
tradução para inglês, fichas para as terras fora dos 195 e qualquer forma de
gamificação.

Dois arquivos editoriais merecem reconferência periódica, porque envelhecem em
silêncio: `src/languages.json` (Burkina Faso, Mali, Níger) e
`src/currencies.json` (adesões ao euro, redenominações, dolarizações).

Validação final de 02/10: 191 testes com Chrome, 18 verificações de banco e 24 cenários Firefox/WebKit aprovados. Detalhes e limites no início de TEST_REPORT.md.

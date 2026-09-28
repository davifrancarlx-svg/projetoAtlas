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
de cada fonte de dados (Natural Earth, flag-icons, PNUD, Banco Mundial), a
distinção região/subregião, as fronteiras terrestres, o esquema de
conta/sincronização, a classificação das terras fora dos 195 e os fatos
derivados. Este arquivo aqui é só o operacional — não repete o que já está
bem contado lá.

### Como está organizado

O produto final é **um único arquivo autocontido**, `atlas-195.html` (~4,9 MB),
com CSS, JS, mapa SVG, bandeiras e fontes embutidos. Abre direto do disco, sem
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
- **Ficha do país**: capital, subregião, área, idiomas oficiais, moeda com
  código ISO, fronteiras terrestres, seis indicadores oficiais (com o ano de
  cada um), fatos derivados, o domínio do jogador por habilidade e o botão
  Praticar. A busca aceita também idioma e moeda, e há um filtro por área:
  os seis baldes amplos e, sob o escolhido, as subregiões dele.
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

### Rodada de 28 de setembro de 2026 — commitada, **não publicada**

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

**Silhuetas na forma real e barra de opções aberta por padrão** (mesmo dia,
commitadas, não publicadas). O usuário estranhou a Islândia no mapa. Não é
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

**Página inicial do Lovable corrigida, mas ainda não publicada.** O
`src/routes/__root.tsx` do projeto Lovable tinha o cabeçalho padrão ("Lovable
App", "Lovable Generated Project", `lang="en"`), que é o que o WhatsApp e as
redes sociais mostram ao compartilhar `atlas-195.lovable.app`. O agente do
Lovable trocou título, descrição, `og:*`, `twitter:*` e ícone pelos mesmos
textos do `atlas-195.html`, pôs `lang="pt-BR"`, traduziu as páginas de erro e
404, e acrescentou em `src/routes/index.tsx` um `<meta http-equiv="refresh">`
que leva a `/atlas-195.html` antes de o React carregar (commit Lovable
`2f30adb`). O mesmo commit trouxe duas atualizações automáticas da
plataforma: `@lovable.dev/vite-tanstack-config` fixado em 2.23.1 e um ajuste
em `previewAuthStorage.ts`. `public/atlas-195.html` e `public/sw.js`
continuam com os hashes do release `fb6d9cedae82`. **Falta publicar** pelo
botão Publish do editor; depois, conferir a pré-visualização do link.

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

`IMPROVEMENTS.md` foi refeito e tem dezoito, da mais barata à mais cara, cada
uma com o trecho de código que a justifica. As mais baratas: a ficha do Atlas
mostrar as notas da capital (hoje elas só existem no veredito do erro),
explicar o erro que o artefato já tem catalogado quando a pessoa digita
"Inglaterra" para Reino Unido, e tornar a ficha navegável pelos vizinhos.

Duas foram **descartadas pelo usuário** e não devem voltar: a busca aceitar o
código ISO e o domínio por subregião na aba Progresso. Continuam fora:
tradução para inglês, fichas para as terras fora dos 195 e qualquer forma de
gamificação.

Dois arquivos editoriais merecem reconferência periódica, porque envelhecem em
silêncio: `src/languages.json` (Burkina Faso, Mali, Níger) e
`src/currencies.json` (adesões ao euro, redenominações, dolarizações).

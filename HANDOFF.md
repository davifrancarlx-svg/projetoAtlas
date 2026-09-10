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
localização no mapa, regiões e subregiões dos 195 países), com revisão
espaçada, prova, indicadores oficiais e conta opcional para sincronizar entre
aparelhos.

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
distinção região/subregião, o esquema de conta/sincronização, a classificação
das terras fora dos 195 e os fatos derivados. Este arquivo aqui é só o
operacional — não repete o que já está bem contado lá.

### Como está organizado

O produto final é **um único arquivo autocontido**, `atlas-195.html` (~4,7 MB),
com CSS, JS, mapa SVG, bandeiras e fontes embutidos. Abre direto do disco, sem
servidor e sem internet. **Esse arquivo é gerado — nunca edite ele à mão.**

- `src/core.js` — regras puras, sem DOM: validação de respostas, progresso,
  revisão espaçada, projeção do mapa, fatos derivados. O que os testes cobrem melhor.
- `src/app.js` — interface, mapa, controles, renderização, sincronização de conta.
- `src/sync-queue.js` — fila pequena e testável que serializa sincronizações e não perde mudanças concorrentes.
- `src/styles.css` — visual. Toda cor é um token em `:root`; o tema claro é
  uma redefinição desses tokens, tanto por `prefers-color-scheme` (automático)
  quanto por `[data-theme]` (escolha fixada pelo botão do app).
- `src/index.template.html` — estrutura da página, com marcadores `{{CSS}}`,
  `{{DATA}}`, `{{CSP}}` etc.
- `src/sw.js` — service worker (instalação como app, funcionamento offline).
- `src/cloud.json` — endereço e chave pública do Supabase usado pela conta opcional.
- `src/countries.base.json`, `src/territories.json`, `src/context-areas.json`,
  `src/content-policy.json` — dados editoriais dos 195 países, dos territórios
  não soberanos, das terras fora do escopo e de correções pontuais (capital
  disputada, região M49 etc.).
- `data/map-geometry.json`, `data/flags.json`, `data/indicators.json`,
  `data/fonts/` — dados gerados a partir de fontes externas, cada um com
  origem, data e SHA-256 registrados. Regenerados pelos scripts em `scripts/`,
  cada um com `--check` para conferir sem regravar.
- `scripts/build.cjs` — monta o arquivo final a partir de tudo acima.
- `supabase/migrations/` — tabela e políticas RLS da conta, versionadas para auditoria e recuperação.
- `tests/` — 150 testes em `node --test`, incluindo um smoke test que abre um
  Chrome de verdade via CDP.

## Regras inegociáveis

1. **O projeto não tem nenhuma dependência npm e isso é proposital.** Não
   instale pacotes. Ícones PNG, controle do Chrome nos testes, tudo foi feito
   só com o que vem no Node.

2. **Quebras de linha precisam ser LF, nunca CRLF.** O arquivo final se
   protege com hashes de CSP calculados sobre o conteúdo exato; o navegador
   normaliza CRLF→LF antes de conferir o hash, então um artefato com CRLF
   invalida os hashes e **a página inteira para de funcionar, sem erro
   visível**. Isso já derrubou o site em produção uma vez. Três defesas
   existem — `.gitattributes` com `eol=lf`, normalização no build, um teste —
   não desative nenhuma.

3. **Nunca edite `atlas-195.html`, `sw.js` ou `manifest.webmanifest` na raiz
   diretamente.** Edite `src/` e rode `npm run build`.

4. **Sempre rode `npm test` antes de commitar.** Há CI no GitHub que roda a
   suíte a cada push — confira que ficou verde.

5. **Verifique no navegador de verdade, não só nos testes.** Use
   `npm run serve` e abra a página, ou use as ferramentas de browser
   disponíveis na sessão. Testes em Node não enxergam "o app não inicia" —
   foi exatamente esse tipo de defeito (regra 2) que motivou o smoke test.

6. **Ações de risco pedem confirmação primeiro**, mesmo dentro do que já foi
   pedido: publicar no Lovable, mudar a classificação de uma terra disputada,
   ou qualquer coisa que mude a promessa de privacidade do app.

## O que já existe (não é para reconstruir, é para conhecer)

- **Modos de treino**: misto, bandeiras, capitais, localização, regiões —
  sete direções de pergunta, com filtro por região e por subregião (as
  Américas do Norte/Central/Caribe são o único caso hoje com subdivisão).
- **Cronômetro opcional**, **baralho de revisão de erros**, **modo prova**
  (10/20/30 perguntas fechadas com nota).
- **Mapa**: projeção Robinson própria, zoom por gesto/roda/botões, e desde a
  última correção — **a resposta certa sempre enquadra o país no mapa ao ser
  revelada**, mesmo em perguntas onde o mapa não é a pergunta (capital→país
  etc.); antes disso, um país pequeno acertado ficava marcado mas invisível
  no zoom do mundo inteiro.
- **Terras fora dos 195** (Groenlândia, Antártida, Taiwan...) são desenhadas
  identificadas — dependência de um dos 195 recebe a cor do soberano; área
  disputada ou sem soberania recebe cor própria e uma nota, nunca um dono.
  Nenhuma delas é resposta de pergunta. Ver `DATA_SOURCES.md` § Terras fora dos 195.
- **Ficha do país**: seis indicadores oficiais (população, expectativa de
  vida, densidade, população urbana, área florestal, IDH — Banco Mundial e
  PNUD, cada um com o próprio ano) e **fatos derivados** calculados a partir
  desses dados (superlativos mundiais e regionais) — nunca escritos à mão,
  nunca respostas de pergunta.
- **PWA completo**: instalável, funciona offline (service worker cacheia o
  artefato no primeiro uso, não na instalação — testado que sobrevive a
  aba/rede instável), avisa a aba aberta quando uma versão nova é publicada.
- **Tema**: automático (segue o sistema) por padrão, com botão para fixar
  claro ou escuro.
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

## Estado da revisão atual

Apelido, conquistas, sons e rotina de treino implementados localmente após aprovação, sem publicação. A auditoria visual encontrou seis bugs; todos foram corrigidos após aprovação e receberam verificação no Chrome. A verificação final (`npm run check`) passou com 150 testes, sem falhas ou testes ignorados. O diagnóstico e as evidências estão em `VISUAL_AUDIT.md`; os arquivos por tarefa, em `DELIVERY.md`; as sugestões restantes, em `IMPROVEMENTS.md`.

Não há correção pendente entre os seis bugs encontrados, mas há duas verificações externas pendentes: aplicar e validar a migration de conquistas no Supabase e verificar a instalação efetiva da PWA. Portanto, não declarar ausência de pendências técnicas.

**Atualização de 2026-09-10:** publicado no GitHub (commit `0692447`, CI verde) e no Lovable a pedido do usuário, mesmo com a migration de conquistas ainda pendente — decisão explícita dele, ciente de que a sincronização de troféus entre aparelhos mostra aviso à parte até a migration ser aplicada. `npm run verify:production` confirmou hash idêntico ao release após o publish. A instalação da PWA (service worker) foi verificada ao vivo em `atlas-195.lovable.app`: registro ativo, sem erros de console. Segue pendente apenas: aplicar `supabase/migrations/202609100001_conquistas_atlas.sql` no projeto Supabase.

As duas grandes tarefas do briefing anterior (botão de tema, conta com
sincronização) foram concluídas, testadas e publicadas. O funcionamento
offline em produção, que ficou como dúvida numa sessão anterior, foi
confirmado ao vivo depois (cache populando após o primeiro uso, app abrindo
com o servidor derrubado).

### Ideias registradas, não pedidas ainda

- As terras fora dos 195 (Groenlândia etc.) não têm ficha no Atlas nem entram
  na busca — só aparecem no mapa. Se um dia fizer sentido dar ficha a elas
  também, é recurso à parte.
- Não está confirmado se o Supabase por trás da conta está no plano gratuito
  dele ou gerenciado dentro do Lovable Cloud — só importa se o uso crescer a
  ponto de esbarrar em limite.
- Tradução para inglês continua fora do escopo. Sons foram solicitados e aprovados posteriormente; ver a seção de sons abaixo.

## Treino de hoje, próxima revisão e evolução

Rodada posterior solicitada e implementada: botão Treino de hoje na aba Progresso, série de até 10 habilidades sem repetição (até 6 vencidas, 2 fracas, 2 novas; completa vagas com as demais), conforme os filtros atuais. Reaproveita o mecanismo de série fechada, mas não concede troféus de prova. Pular uma questão visual reduz a série sem registrar erro. Pode ser repetido; não há bloqueio diário nem retomada após fechar a página.

Próxima revisão usa dia/horário local e informa a quantidade de habilidades no primeiro dia previsto; vencidas são contadas como disponíveis agora. O resumo destaca novidades praticadas e dificuldades novamente acertadas. Marcadores adicionais ficam somente na memória da sessão. Implementação em `src/study.js`, integrada a `src/app.js`; testes puros em `tests/study.test.cjs` e Chrome em `tests/study-browser.cjs`.

Verificação: 150 testes passaram, sem falhas ou ignorados. Treino de 10 perguntas concluído no Chrome em claro/mobile e escuro/desktop, sem transbordamento horizontal. HTML com 5019,3 KiB de 5376 KiB permitidos; `src/app.js` com 149,8 KiB de 150 KiB. Não aumentar esse limite por conveniência na próxima tarefa.

## Sons opcionais

Implementados após aprovação: acerto com três variações suaves, erro/tempo esgotado discreto e conquista com três notas. O controle visível “Som” cicla desligado → baixo → médio, começa desligado e toca uma amostra ao ativar/mudar volume. A preferência fica só no navegador (`atlas195:som:v1`), sem sincronização nem mudança do que sai do aparelho.

`src/audio.js` sintetiza tudo com Web Audio; o build o incorpora no script existente. Não há pacotes novos nem áudio baixado. Eventos simultâneos são agrupados, com prioridade para conquista; ganhos retroativos silenciosos não tocam. A aba oculta interrompe a reprodução. Os efeitos têm duração inferior a meio segundo. Os testes estão em `tests/audio.test.cjs` e `tests/audio-browser.cjs` (chamado pelo smoke test); incluem renderização offline nativa para verificar sinal e ausência de saturação.

A migration de conquistas e a instalação efetiva da PWA continuam adiadas por decisão do usuário. Não tentar concluí-las como parte dos sons. Nada deve ser publicado nesta sessão.

Verificação dos sons: 146 testes passaram, incluindo Chrome real em 360/768/1280 pixels, claro/escuro, teclado, preferência após recarregar e efeito disparado pela resposta. O HTML final ficou com 5014,6 KiB de 5376 KiB permitidos. Nenhum limite existente foi aumentado. As amostras para escuta estão em `docs/audio-samples/`; sua avaliação estética fica com o usuário.

## Apelido opcional da conta

O cartão de conta permite cadastrar, editar e remover um apelido de até 40 caracteres depois de entrar. O login por e-mail não exige apelido. Contas antigas sem apelido continuam válidas. Para remover, apague o campo e salve.

Com conta, são enviados ao Supabase o e-mail usado para entrar, o progresso e, se cadastrado, o apelido. O apelido fica nos dados do perfil do Supabase Auth (`user_metadata.atlas_nickname`), atualizado por `PUT /auth/v1/user`, com HTTP direto e sem SDK. Não integra o backup de progresso nem é apagado ao zerar o aprendizado. O apelido não exige alteração de tabela ou política de acesso.

O perfil é consultado ao reabrir uma sessão e ao usar “Sincronizar agora”. Entre edições em aparelhos diferentes, prevalece a última gravação aceita pelo servidor. Salvar requer conexão; uma falha mantém o texto em edição para nova tentativa enquanto a página continuar aberta, sem impedir o treino ou a sincronização do progresso.

## Conquistas

São 25 troféus nomeados, exibidos na aba Progresso com ◆/◇, descrição e raridade. Domínio significa nível máximo nas direções indicadas. O aviso de desbloqueio é temporário, não recebe foco e não exige fechamento. O humor fica apenas nos nomes, descrições e avisos de conquistas.

Há retroação parcial: níveis, países estudados e recorde existentes permitem reconhecer feitos comprováveis, sem avisos em massa nem datas antigas inventadas. Provas perfeitas, sequência digitada, zoom, revisão focada, exportação e troca de tema só contam a partir desta versão. A sequência digitada e as três trocas de tema valem na mesma abertura do app. A lista diária de revisões vencidas é registrada no primeiro uso de cada dia, pelo horário local; precisa ser não vazia e cada habilidade da lista precisa receber um acerto no mesmo dia.

As conquistas ficam num registro local separado (`atlas195:conquistas:v1`). Com conta, também são enviados ao Supabase os identificadores dos troféus desbloqueados e a geração/época de exclusão do progresso. Não são enviados identificadores de aparelhos. Contadores temporários, a lista diária e os cinco microestados acertados ficam locais; somente os troféus concluídos acompanham a conta. O backup por arquivo continua contendo o progresso educacional, sem apelido nem o registro separado de conquistas; ao importar, os troféus comprováveis por esse progresso são reavaliados.

A migration `supabase/migrations/202609100001_conquistas_atlas.sql` cria uma tabela separada com acesso restrito à própria conta e uma operação de união atômica — o banco combina os troféus em uma única gravação para evitar perda entre aparelhos. Clientes antigos continuam usando a tabela de progresso existente. Apagar progresso também apaga conquistas; a geração/época impede que versões antigas do registro restaurem troféus apagados. Sem rede ou sem a migration, o treino e o progresso continuam funcionando, com aviso separado para conquistas.

Implementação: `src/achievements.js` contém catálogo e regras puras expostas por `Core`; `src/achievements-ui.js` cuida da interface e persistência; `tests/achievements.test.cjs` verifica os desbloqueios sem DOM. Não há dependências novas, imagens ou mudança de geometria/dados educacionais.

### Verificação local das conquistas

Os testes incluem regras puras, falhas de rede, união entre aparelhos simulados, exclusão, avisos e teclado no Chrome. A migration foi inspecionada e coberta por verificações de estrutura, mas não foi executada contra um PostgreSQL/Supabase nesta sessão. A instalação no backend e sua validação continuam pendentes antes da publicação.

Durante a implementação, o teste no navegador encontrou um erro na fila de avisos que interrompia a terceira troca de tema; foi corrigido e recebeu teste de regressão. A lista aberta e o foco também são preservados quando a sincronização atualiza Progresso. A auditoria posterior, nos temas claro/escuro e em três larguras, está em `VISUAL_AUDIT.md`. Foram corrigidos: enquadramento de Tuvalu, visibilidade da seleção por teclado no mapa ampliado, espessura das linhas de referência, preservação do e-mail/foco, estado de conexão pendente e foco de importar. As regressões correspondentes rodam no Chrome por `tests/visual-regression.cjs`, chamado pelo smoke test. A suíte final passou com 140 testes.

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
npm test          # 87 testes; um deles abre o app num Chrome real via CDP
npm run build     # gera atlas-195.html + manifest.webmanifest + sw.js + ícones
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
- `tests/` — 87 testes em `node --test`, incluindo um smoke test que abre um
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

1. `npm run build` e `npm test` (precisa passar)
2. Commit e push para o GitHub (CI precisa ficar verde)
3. Comparar hash de cada arquivo publicável (`atlas-195.html`,
   `manifest.webmanifest`, `sw.js`, os 4 PNGs de ícone) contra o que já está
   em `https://atlas-195.lovable.app/<arquivo>` — só reenviar o que mudou.
4. Enviar os arquivos que mudaram para o projeto Lovable
   (id `d00d8eb3-5261-428f-b5bb-7d8f89247846`) e pedir explicitamente para
   **copiar byte a byte, sem reformatar, sem linter** — um byte alterado
   quebra os hashes de CSP e derruba a página inteira.
5. Publicar e conferir o hash do arquivo já no ar antes de considerar concluído.

**Só publique no Lovable se o usuário pedir.** Terminar de codar e testar
localmente não é licença para publicar sozinho.

## Não há pendência técnica conhecida agora

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
- Som e tradução para inglês foram cogitados e deliberadamente deixados de
  fora até agora (som pediria um controle de liga/desliga novo; traduzir
  poria em risco a precisão de 195 países de conteúdo).

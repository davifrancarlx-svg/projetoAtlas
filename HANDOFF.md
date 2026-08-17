# Prompt de continuação — Atlas 195

> Copie tudo daqui para baixo e cole como primeira mensagem numa sessão nova.
> Ele é autocontido: quem receber não tem o histórico da conversa anterior.

---

Você vai continuar um projeto que já existe. Leia este briefing inteiro antes de mexer em qualquer arquivo.

## O projeto

**Atlas 195** — treinador de geografia em português (bandeiras, capitais, localização no mapa e regiões dos 195 países), com revisão espaçada. Sou leigo em programação, então explique decisões em linguagem simples e evite jargão sem tradução.

- Código: `https://github.com/davifrancarlx-svg/projetoAtlas` (branch `main`)
- No ar: `https://atlas-195.lovable.app`
- Requer **Node 22 ou superior** (um dos testes usa WebSocket nativo)

```sh
npm test          # 65 testes; inclui um que abre o app num Chrome real
npm run build     # gera atlas-195.html + manifest.webmanifest + sw.js + ícones
npm run serve     # servidor local em http://127.0.0.1:8743/atlas-195.html
```

### Como está organizado

O produto final é **um único arquivo autocontido**, `atlas-195.html` (~4,7 MB), com CSS, JS, mapa SVG, bandeiras e fontes embutidos. Ele abre até direto do disco, sem servidor e sem internet. Esse arquivo é **gerado**: nunca edite ele à mão.

- `src/core.js` — regras puras, sem DOM: validação de respostas, progresso, revisão espaçada, projeção do mapa. É o que os testes cobrem melhor.
- `src/app.js` — interface, mapa, controles, renderização.
- `src/styles.css` — visual. **Toda cor é um token em `:root`**; o tema claro é só uma redefinição desses tokens dentro de `@media (prefers-color-scheme: light)`.
- `src/index.template.html` — estrutura da página, com marcadores `{{CSS}}`, `{{DATA}}`, `{{CSP}}` etc.
- `src/sw.js` — service worker (funcionamento offline).
- `scripts/build.cjs` — monta o arquivo final.
- `tests/` — 65 testes em `node --test`.

## Regras inegociáveis

1. **O projeto não tem nenhuma dependência npm e isso é proposital.** Não instale pacotes. Até os ícones PNG e o controle do Chrome nos testes foram feitos com o que vem no Node.

2. **Quebras de linha precisam ser LF, nunca CRLF.** O arquivo final protege a si mesmo com hashes de CSP calculados sobre o conteúdo exato. O navegador normaliza CRLF→LF antes de conferir o hash — então um arquivo com CRLF invalida os hashes e **a página inteira para de funcionar, sem erro visível**. Isso já derrubou o site em produção uma vez. Existem três defesas: `.gitattributes` com `eol=lf`, normalização no build, e um teste. Não desative nenhuma.

3. **Nunca edite `atlas-195.html` diretamente.** Edite `src/` e rode `npm run build`.

4. **Sempre rode `npm test` antes de commitar.** Há CI no GitHub que roda a suíte a cada push.

5. **Verifique no navegador de verdade, não só nos testes.** Use `npm run serve` e abra a página. Testes em Node não enxergam "o app não inicia".

## Tarefa 1 — Botão para alternar o tema (simples)

Hoje o app segue o tema do sistema operacional automaticamente, e não há como trocar dentro dele. Quero um botão no app.

- Um botão discreto na barra do topo, ciclando **Automático → Claro → Escuro**
- **Automático é o padrão** e mantém o comportamento atual (seguir o sistema)
- A escolha deve ser salva junto das outras preferências do usuário (veja `PREFS_KEY` em `src/app.js`)
- Acessível: rótulo claro para leitor de tela, anunciar a mudança

A parte difícil já está pronta: todas as cores são tokens. Deve bastar aplicar um atributo na raiz (ex.: `data-theme="light"`) e escrever as regras correspondentes, mantendo `prefers-color-scheme` como comportamento do modo automático. Há um teste que **proíbe cor fixa fora das paletas** — respeite-o.

## Tarefa 2 — Contas de usuário (grande, decida comigo antes de codar)

Hoje o progresso fica salvo **só no navegador**. Quero poder criar conta e ter o progresso vinculado a ela, para continuar em outro aparelho.

**Antes de escrever código, me explique o plano.** Esta mudança mexe em algo central do projeto, e eu quero entender antes de aprovar:

- O app hoje promete, no README e na interface, que **não envia nada para servidor nenhum**. A política de segurança está com `connect-src 'none'`, ou seja, ele está tecnicamente proibido de falar com a internet. Criar contas obriga a abrir isso e a mudar essa promessa. Quero que a promessa seja atualizada com honestidade, não apagada — o texto novo deve dizer o que passa a sair do aparelho e o que continua local.
- Quero que **continuar sem conta siga funcionando**, offline e sem cadastro. A conta deve ser opcional e adicional, nunca obrigatória, e nunca uma parede na frente de quem só quer treinar.
- Quero saber o que acontece com o progresso de quem já usa o app hoje (ele não pode ser perdido ao criar uma conta) e o que acontece se o serviço de contas ficar fora do ar.

**Aproveite o que já existe** — o projeto foi construído de um jeito que facilita isso:

- O progresso já é um "envelope" versionado, validado e serializável (`Core.serializeProgress` / `Core.deserializeProgress` / `Core.validateProgress`, com `Core.SCHEMA_VERSION`). Ele é exatamente o que precisaria ser enviado e recebido.
- **Já existe `Core.mergeProgress`**, que funde dois progressos resolvendo conflitos por habilidade — foi feito para sincronizar abas abertas ao mesmo tempo, e serve igual para sincronizar aparelhos. Não escreva um merge novo.
- Já existe exportar/importar progresso por arquivo (`exportProgress` / `importProgressFile` em `src/app.js`), que é a versão manual do que a conta faria sozinha.
- O armazenamento local já tem uma camada de abstração (`STORAGE_KEY`, `hostStorageAvailable`, leitura/escrita com timeout) — o servidor deve entrar como mais uma réplica, não substituindo a local.

**Princípio que quero preservado:** o dispositivo continua sendo a fonte da verdade; a conta é uma cópia que sincroniza. Se a internet cair, o treino não pode parar.

### Hospedagem: já está decidido

**O site será sempre hospedado no Lovable.** Não pretendo hospedar nada por conta própria, então não precisa avaliar alternativas de servidor. Use a integração de banco de dados e autenticação que o Lovable já oferece (Supabase / Lovable Cloud) — é para lá que a conta deve apontar. Vale confirmar comigo os limites do plano em uso antes de assumir volume.

### Um cuidado importante ao usar o Lovable para isso

O projeto no Lovable hoje é um app React que **só redireciona** para o `atlas-195.html` estático. Se a tarefa for entregue como "peça para a IA do Lovable adicionar login", o resultado provável é uma tela de login **em React, separada**, convivendo com o Atlas — dois aplicativos no mesmo endereço, cada um com seu estado. Não é isso que eu quero.

O login e a sincronização devem ser implementados **dentro do próprio `atlas-195.html`**, no código deste repositório (`src/app.js` e `src/core.js`), como qualquer outra tela do app. O Lovable entra apenas como:

1. **hospedagem** do arquivo estático, como já é hoje; e
2. **provedor do banco de dados e da autenticação**, provisionados pelo painel dele.

Consequência prática: o app deve conversar com o Supabase por **`fetch` puro** nos endpoints REST/Auth, sem instalar o SDK — isso mantém a regra de zero dependências e o arquivo continua único e autocontido. A URL do projeto e a chave pública (`anon`) ficam embutidas no arquivo, o que é normal e esperado para esse tipo de chave, desde que as permissões no banco estejam configuradas para que cada pessoa só enxergue o próprio progresso.

Na política de segurança, abra `connect-src` **apenas para a origem do Supabase** — nada de liberar geral.

E um detalhe que não pode ser esquecido: o `atlas-195.html` precisa continuar abrindo direto do disco, sem servidor. Quando não houver rede ou origem válida, a parte de conta simplesmente não aparece e o treino segue local, sem erro na tela.

## Como publicar (quando eu aprovar)

1. `npm run build` e `npm test`
2. Commit e push para o GitHub (o CI precisa ficar verde)
3. O site no Lovable **não** está ligado ao GitHub: os arquivos gerados (`atlas-195.html`, `manifest.webmanifest`, `sw.js` e os 4 ícones PNG) são enviados manualmente para a pasta `public/` do projeto Lovable, e depois publica-se.
   - Projeto Lovable: `d00d8eb3-5261-428f-b5bb-7d8f89247846`
   - Ao enviar, avise explicitamente para **copiar byte a byte, sem reformatar, sem linter** — qualquer byte alterado quebra os hashes de CSP e derruba a página.

## Uma pendência conhecida

O funcionamento offline foi verificado localmente (servidor derrubado, app abre completo). **Em produção não foi confirmado**: o service worker registra e controla a página, mas o cache não populou no navegador automatizado usado no teste, e a causa não foi determinada. Pode ser limitação do ambiente de teste. Se puder, confirme abrindo o site no celular, deixando carregar, e reabrindo em modo avião.

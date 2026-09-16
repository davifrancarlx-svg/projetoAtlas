# Entrega local — Atlas 195

Rodada de 16 de setembro de 2026. Estado: **testado localmente, commitado e enviado ao GitHub; não publicado no Lovable** (publicar exige pedido explícito).

## Resultado

- **Conquistas removidas** a pedido do usuário: catálogo, regras, interface, avisos, sincronização, som de conquista, estilos, testes e a migration que nunca chegou a ser aplicada. O registro local antigo (`atlas195:conquistas:v1`) é apagado na abertura do app. O texto da conta e do apagar progresso não cita mais troféus.
- **Conta separada em módulo próprio** (`src/account.js`, orçamento de 24 KiB), com as dependências injetadas e testes sem DOM sobre o próprio módulo. `src/app.js` voltou a ter folga no orçamento sem aumento de limite.
- **Correções pequenas**: o recorde de sequência agora aparece; o erro de capital diz de quem é a capital escolhida (e o erro de bandeira, de quem é a bandeira; o de mapa, o que foi marcado); os atalhos 1 a 4 funcionam logo após clicar numa aba; o cronômetro pausa com a aba oculta; a aba Progresso e o fechamento da sessão listam os erros pela mesma regra.
- **Subregiões em todos os continentes** (M49 da ONU): 22 áreas de estudo no filtro, distratores e explicação do erro mais precisos, ficha mais informativa. Chipre segue em Ásia Ocidental.
- **Ficha do Atlas**: domínio por habilidade do país selecionado, botão "Praticar" que abre uma série com todas as direções desse país, fronteiras terrestres e busca por idioma.
- **Estatísticas gerais** na aba Progresso: total de respostas, acerto geral e recorde.
- **Retomar série interrompida**: prova, treino de hoje e prática de um país ficam guardados neste navegador; ao abrir, o app oferece retomar ou descartar. O tempo parado não conta e a pergunta em curso é sorteada de novo.
- **Silhueta**: a pergunta "mapa → país" alterna entre o pin no mapa e o contorno isolado do país, na mesma habilidade, sem mudar o esquema do progresso. Países sem forma na escala do mapa nunca viram silhueta.
- **Fronteiras terrestres** editoriais (`src/borders.json`, 313 pares), validadas por simetria, contagens conhecidas e plausibilidade geográfica; o veredito diz "faz fronteira com" quando é o caso.

## Arquivos por tarefa

| Tarefa | Código, testes e documentação |
| --- | --- |
| Remover conquistas | apagados `src/achievements.js`, `src/achievements-ui.js`, `tests/achievements*.cjs`, `supabase/migrations/202609100001_conquistas_atlas.sql`, `docs/audio-samples/conquista.wav`; alterados `src/core.js`, `src/app.js`, `src/audio.js`, `src/styles.css`, `scripts/build.cjs`, `scripts/check-budgets.cjs`, `tests/smoke.test.cjs`, `tests/audio*.cjs`, docs |
| Módulo de conta | `src/account.js`, `src/app.js`, `scripts/build.cjs`, `scripts/check-budgets.cjs`, `tests/account.test.cjs`, `tests/infrastructure.test.cjs` |
| Correções pequenas | `src/app.js` |
| Subregiões | `src/countries.base.json`, `src/territories.json`, `scripts/build.cjs`, `tests/build.test.cjs`, `DATA_SOURCES.md` |
| Ficha, busca por idioma, estatísticas, retomar série, silhueta | `src/app.js`, `src/core.js`, `src/styles.css`, `tests/core.test.cjs` |
| Fronteiras | `src/borders.json`, `scripts/build.cjs`, `src/core.js`, `src/app.js`, `tests/borders.test.cjs`, `tests/build.test.cjs`, `DATA_SOURCES.md` |

Artefatos recriados pelo build: `atlas-195.html`, `sw.js`, `release-manifest.json`. Nenhum foi editado diretamente.

## Limites da entrega

- Nada foi publicado no Lovable. O site no ar continua com a versão anterior, com conquistas, até o usuário pedir a publicação.
- A tabela `conquistas_atlas` nunca foi criada no Supabase (a migration estava pendente), então não há nada a remover no banco.
- A retomada cobre séries fechadas (prova, treino de hoje, prática de um país). O treino livre e a revisão focada continuam vivendo só na memória da página.
- A lista de fronteiras é editorial e segue a convenção de facto do mapa; casos de fronteira ambígua estão documentados em `DATA_SOURCES.md`.

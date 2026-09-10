# Entrega local — Atlas 195

Estado: **testado localmente, pronto para revisão**. Nenhuma publicação, push, aplicação de migration ou instalação de pacote foi realizada nesta revisão.

## Resultado

- Apelido opcional editável pelo cartão da conta, guardado no perfil do Supabase Auth. Login existente preservado; ausência de apelido é válida.
- 25 conquistas com retroação parcial aprovada, persistência local, união de troféus por conta e avisos sem bloquear respostas. Migration preparada, ainda não aplicada ao servidor.
- Seis bugs visuais aprovados e corrigidos. O relatório `VISUAL_AUDIT.md` preserva sintomas, reprodução, proposta, resultado e capturas de antes/depois. O erro de avisos encontrado na tarefa 2 também está registrado no HANDOFF como corrigido.
- Sugestões priorizadas em `IMPROVEMENTS.md`, com status atualizado. A próxima revisão foi implementada na rodada posterior.
- Sons opcionais acrescentados após aprovação: acerto, erro/tempo esgotado e conquista, com controle desligado/baixo/médio e síntese local.
- Rotina de treino: botão Treino de hoje, data/horário e quantidade da próxima revisão e resumo de evolução. Verificação visual em claro/mobile e escuro/desktop.
- `npm run check` final: **150 passaram, 0 falhas, 0 ignorados**. Chrome real, build, CSP/LF, orçamento e atualidade dos dados passaram. `git diff --check` sem erros.

## Arquivos por tarefa

Um mesmo arquivo pode participar de mais de uma tarefa. A lista cobre a revisão inteira, não apenas a última rodada de correções.

| Tarefa | Código, testes e documentação |
| --- | --- |
| 1 — Apelido | `src/app.js`, `src/styles.css`, `tests/account.test.cjs`, `tests/smoke.test.cjs`, `README.md`, `DATA_SOURCES.md`, `HANDOFF.md` |
| 2 — Conquistas | `src/achievements.js`, `src/achievements-ui.js`, `src/core.js`, `src/app.js`, `src/styles.css`, `scripts/build.cjs`, `scripts/check-budgets.cjs`, `supabase/migrations/202609100001_conquistas_atlas.sql`, `tests/achievements.test.cjs`, `tests/achievements-ui.test.cjs`, `tests/account.test.cjs`, `tests/smoke.test.cjs`, `README.md`, `DATA_SOURCES.md`, `HANDOFF.md` |
| 3 — Correções visuais | `src/app.js`, `src/styles.css`, `tests/account.test.cjs`, `tests/infrastructure.test.cjs`, `tests/smoke.test.cjs`, `tests/visual-regression.cjs`, `VISUAL_AUDIT.md`, `docs/visual-audit/*.png`, `README.md`, `DATA_SOURCES.md`, `HANDOFF.md` |
| 4 — Sugestões e fechamento | `IMPROVEMENTS.md`, `DELIVERY.md`, atualização de estado no `HANDOFF.md` |
| Pedido posterior — Sons | `src/audio.js`, `src/app.js`, `src/achievements-ui.js`, `src/index.template.html`, `src/styles.css`, `scripts/build.cjs`, `scripts/check-budgets.cjs`, `tests/audio.test.cjs`, `tests/audio-browser.cjs`, `tests/smoke.test.cjs`, `README.md`, `DATA_SOURCES.md`, `HANDOFF.md`, `DELIVERY.md`, `VISUAL_AUDIT.md`, `docs/audio-samples/`, `docs/visual-audit/sound-*.png`; artefatos recriados: `atlas-195.html`, `sw.js`, `release-manifest.json` |
| Pedido posterior — Rotina de treino | `src/study.js`, `src/app.js`, `scripts/build.cjs`, `scripts/check-budgets.cjs`, `tests/study.test.cjs`, `tests/study-browser.cjs`, `tests/smoke.test.cjs`, `README.md`, `DATA_SOURCES.md`, `HANDOFF.md`, `IMPROVEMENTS.md`, `DELIVERY.md`; artefatos recriados: `atlas-195.html`, `sw.js`, `release-manifest.json` |

Artefatos compartilhados das tarefas 1–3, recriados pelo build: `atlas-195.html`, `sw.js`, `release-manifest.json`. O manifesto PWA não teve mudança de conteúdo. Nenhum desses artefatos foi editado diretamente. A alteração em `data/fonts/LICENSE-ibm-plex.txt` já existia antes do trabalho e foi preservada, sem intervenção.

## Limites da entrega

- A migration de conquistas tem revisão e testes de estrutura, mas precisa ser aplicada e validada contra Supabase/PostgreSQL antes de uma publicação futura. Os testes de conta e de sincronização nesta sessão usaram respostas simuladas; não substituem essa validação.
- Offline, manifesto e aviso de atualização da PWA foram verificados no Chrome. A instalação efetiva e abertura em janela independente não foram verificadas porque o comando de instalação não estava disponível no ambiente.
- O backup por arquivo continua contendo somente o progresso educacional. Não inclui apelido nem troféus de eventos; ampliar esse backup é uma sugestão separada, não uma funcionalidade desta entrega.
- Os dados educacionais, a geometria do mapa e a classificação de territórios não foram alterados.

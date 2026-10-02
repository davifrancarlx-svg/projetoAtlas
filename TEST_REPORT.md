# Revisão da rodada do Codex — 02/10/2026

`npm run check` com `ATLAS_REQUIRE_BROWSER=1`: **204 testes aprovados, zero
falhas e zero ignorados**, com Chrome real; build, orçamentos, atualidade dos
indicadores e auditoria editorial estrita aprovados. Artefato: 3184,3 KiB de
3328 KiB. `npm --prefix qa run test:database`: 19 verificações aprovadas. Os
cenários Firefox/WebKit não foram repetidos nesta revisão (exigiriam baixar os
navegadores do Playwright).

Conferido num Chrome de verdade, com o service worker e o cache limpos antes:
com versão nova pendente, o resumo da sessão continuou na tela 13 s depois de
"Encerrar"; "Nova sessão" recarregou com a revisão do progresso intacta (3 →
3), sem erro no console. Três erros de bandeira seguidos (França × Costa Rica,
Reino Unido × Cuba, Índia × Nauru) receberam só o pedido de comparar as duas
imagens. Antes da correção, a troca de versão apagava o resumo em cerca de
10 s, e Irlanda × Madagascar recebia "o desenho das estrelas".

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

# Validação anterior — evolução, desempenho e acessibilidade — 02/10/2026

**193 testes aprovados, zero falhas e zero ignorados** em npm run check com
ATLAS_REQUIRE_BROWSER=1, incluindo Chrome real, build, orçamentos e atualidade dos
indicadores. git diff --check limpo. Duas novas verificações de unidade cobrem
métricas por sessão, ausência de acertos antigos, migração v3, limites, backup,
fusão sem duplicação, ordem determinística e imutabilidade. O cenário de navegador
confere a comparação 40% (2/5) → 80% (4/5) e os controles recolhíveis.

O cliente usa esquema 4. Migrações de v2/v3 preservam dados anteriores sem
inventar métricas; sessões antigas sem métricas não entram na comparação. Erros
sem país confundido também contam como erros nas métricas de acerto. Exige duas
sessões com ao menos cinco respostas em cada habilidade. Não afirma significância
estatística ou aumento de domínio; dificuldade e países podem variar.

**24 cenários Firefox/WebKit aprovados**, com temas claro/escuro, 360/1280 px e
três abas. Auditoria axe-core sem violações automáticas detectadas; listas abertas,
link de pular conteúdo, foco na grade e abertura pelo teclado incluídos. Capturas
de evolução mobile clara e escura inspecionadas visualmente. Inconclusivos de
contraste permanecem no relatório para revisão humana. Não certifica WCAG completa.

**19 verificações de banco local aprovadas**, agora incluindo v4→v3 recusado
pelo trigger existente. Nenhuma migração remota foi aplicada; o usuário adiou essa
etapa. Aparelhos físicos, leitores de tela e participantes reais seguem pendentes.

Redução do DOM ao abrir Progresso: grade de 195 países, sessões e confusões são
criadas na expansão. Com histórico fictício cheio, 587 elementos no painel fechado
e 1.757 com a grade de domínio aberta: 1.170 elementos adiados apenas na grade.
Learning.record evita uma cópia integral adicional a cada resposta. Benchmark
reproduzível: npm --prefix qa run test:performance, com CPU4 e viewport360×640.
Mede carregamento, renderização síncrona, heap JS e quadros durante arraste; relatório
em reports/performance.json. São medições locais de laboratório, sem equivalência
a INP, memória total do navegador ou celular físico. Não há comparação de tempos
antes/depois que sustente uma promessa de aceleração percentual.

A reserva da barra mobile passou a 58 px para evitar encobrir uma borda do mapa.
O limite de learning.js passou de 12 para 14 KiB para as métricas e o painel, com
uso aproximado de 13 KiB; todos os outros orçamentos mantidos e aprovados.

Entrega local, sem commit, push, deploy ou alteração do Supabase. Históricos e
backups do esquema 4 exigem esta versão ou posterior. Antes de publicar, a proteção
SQL existente deve estar aplicada no backend.

---

# Validação anterior — 02/10/2026

Resultado: **191 testes aprovados, zero falhas e zero ignorados** em
`npm run check` com `ATLAS_REQUIRE_BROWSER=1`. Chrome real, build,
orçamentos e atualidade mínima dos indicadores aprovados.

## Conta e banco

Quatro novos testes cobrem renovação concorrente e falhas temporárias, saída
imediata com resposta atrasada, troca de conta durante leitura remota e 401 antigo
após renovação. A suíte de conta tem 15 testes, todos aprovados.

`npm --prefix qa run test:database`: **18 verificações aprovadas** em PostgreSQL
WASM (PGlite 0.5.8) descartável. Migrações aplicadas duas vezes; isolamento de dois
usuários, bloqueio anônimo, ausência de TRUNCATE, limites do envelope e progressão
v2→v3/v3→v3 com rejeição de regressão, ausência, null e string na versão.
Identidade e papéis do Supabase são substitutos locais; não é validação do serviço
remoto. A migração de proteção continua pendente no backend configurado.

Consulta remota somente de leitura: autenticação pública HTTP 200; consulta
anônima de progresso com limit=0 HTTP 401. Não foram acessadas linhas, criadas
contas ou confirmada a existência de ambiente/contas de teste.

## Compatibilidade e acessibilidade

`npm --prefix qa run test:browsers`: **24 cenários aprovados**, Firefox 153.0 e
WebKit 26.5, larguras 1280/360, temas claro/escuro e abas Treinar/Atlas/Progresso.
Resposta, avanço, busca, seleção, foco móvel, ausência de transbordamento e erros
JS verificados. Axe-core 4.13.0 não detectou violações nas regras WCAG A/AA
executadas. Resultados completos e itens inconclusivos para revisão manual em
reports/compatibility/results.json. Captura WebKit 360 px inspecionada visualmente.

Corrigidos: semântica ARIA do grupo de países e dos grupos de status/busca;
contraste do título do mapa e do país selecionado no tema claro. Os resultados
inconclusivos incluem contrastes cuja sobreposição ou imagem impede cálculo;
ausência de violações automáticas não certifica conformidade completa.

Dependências novas restritas à pasta qa/, com versões e lockfile fixados; nenhuma
vai para o HTML publicado. Workflow de CI preparado, ainda não executado no GitHub.
Roteiro para participantes e aparelhos em docs/validacao-com-jogadores.md.

## Pendências externas

Login por e-mail, duas contas reais, migração remota, Safari/iPhone e Android
físicos, teclado virtual e VoiceOver/TalkBack dependem de acesso e aparelhos.
Nenhuma sessão com jogadores foi realizada. Nenhum commit, push ou deploy.

---

# Validação anterior — 01/10/2026

Resultado: **187 testes aprovados, zero falhas e zero ignorados**. Executado npm run check com ATLAS_REQUIRE_BROWSER=1: Chrome real, build, orçamentos e atualidade mínima dos indicadores aprovados. git diff --check sem problemas.

## Checkup mobile

Validação completa: 187 testes aprovados com Chrome real. Novo cenário integrado ao smoke test cobre 15 combinações (Treinar, Atlas e Progresso em 320×568, 360×640, 390×844, 844×390 e 320×340): nenhuma rolagem horizontal, nenhum botão/seletor/summary medido abaixo de 44 px e nenhum campo de texto/seletor abaixo de 16 px. Eventos de toque reais do CDP verificam navegação, seleção do país, retorno à busca, acesso ao mapa, resposta, próxima pergunta, arraste e pinça sem registrar resposta acidental. Capturas antes/depois e medições em docs/mobile-review/.

Inspeção visual das capturas em 360 px: barra inferior, pergunta, busca, ficha e mapa com enunciado. Orçamentos aprovados; atlas.js passou a 26 KiB de limite para comportar o fluxo móvel de busca/ficha/mapa, com uso de 24,1 KiB. A janela reduzida testa falta de espaço; não é teste de teclado virtual nativo. Safari/iOS, TalkBack/VoiceOver e aparelhos físicos continuam pendentes.

## Fontes e treino de pares

As três melhorias adicionais foram validadas: auditoria remota com cinco verificações e relatório sem mudanças; falhas parciais e diferenças simuladas cobertas por testes; seis links de fontes por ficha e exportação com URLs; comparação direta pelo histórico; treino do par com seis perguntas, presença do país confundido, retomada após recarga, conclusão e repetição no Chrome. O agendamento foi preparado no workflow do repositório, sem execução remota do GitHub nesta rodada.

## Atualização dos dados

FRA 2025 incorporada via API publicada da FAO para 195 países (120 valores revisados e três novas coberturas). Importador testa ausência versus zero, denominador, faixa e consistência das áreas. Nova consulta remota com --check reproduziu o arquivo sem divergências. Idiomas da Nova Zelândia e nota da Síria atualizados por fontes primárias; demais séries numéricas mantidas após comparação. Auditoria e links em DATA_SOURCES.md.

## Recursos desta rodada

Filtros sincronizados com o mapa; ordenação por nome/área/população; comparação de países; links diretos; impressão e download de ficha em texto; listas completas de revisão/dificuldades; painel de atalhos; contagem de países não estudados e treino somente de novidades; histórico de tempo ativo e confusões; aviso de versão no modo Foco e atualização automática após encerramento seguro.

## Evidências adicionais

- Migração de v2, rejeição de dados inválidos, backup, fusão entre aparelhos sem duplicação, reset e retenção dos históricos testados em Node.
- Treino de novidades e retomada, exclusão do tempo com aba oculta, listas expandidas, link após recarga, ordenação, filtros com enquadramento e alto contraste emulado testados no Chrome.
- Download real da ficha concluído e conteúdo conferido. Layout de impressão verificado com media print; comparação inspecionada visualmente a 1280 px (claro) e 360 px (escuro), sem transbordamento horizontal. Capturas em docs/features-review/.
- Aviso no modo Foco e atualização automática após encerrar o treino testados com recarregamento real, preservando o histórico salvo.
- Conta recusa sobrescrever envelope remoto futuro ou inválido. A migração SQL que impede downgrade do esquema foi preparada, mas não executada em banco PostgreSQL nem aplicada ao Supabase remoto.

## Limites e publicação

Instalação e novas funcionalidades offline foram adiadas pelo usuário. Login real por e-mail, testes com aparelhos físicos e alto contraste do Windows continuam fora da validação local. Antes de publicar, aplicar supabase/migrations/202610010001_impede_regressao_esquema.sql. Os novos históricos começam a ser registrados nesta versão, sem reconstrução do passado.

A entrega é local: não houve commit, push, publicação do site ou alteração de serviço remoto nesta rodada. Os arquivos publicáveis foram regenerados pelo build.

---

## Relatório histórico anterior

# Validação do Atlas 195 — 16/09/2026

Resultado final: **158 testes aprovados, zero falhas e zero testes pulados**.

Executado `npm run check` com `ATLAS_REQUIRE_BROWSER=1`, incluindo Chrome real em perfil temporário, build, orçamento dos arquivos e atualidade dos indicadores. O Chrome precisou ser executado fora do sandbox local para disponibilizar seu canal de testes. Nenhum serviço de produção foi alterado.

## Problemas reproduzidos e corrigidos

| Problema | Correção e proteção |
| --- | --- |
| Após responder a primeira pergunta, o cabeçalho já mostrava “2 de 5”, enquanto o rodapé ainda mostrava “1 de 5”. | Cabeçalho e rodapé agora usam o mesmo critério, avançando a numeração na próxima pergunta. Cenário no Chrome. |
| Uma carta aposentada após seis tentativas ainda era salva no rascunho. | O rascunho só inclui a carta em exibição se ainda não foi respondida, além da fila que realmente continua. Cenário no Chrome. |
| Um acerto isolado na sexta tentativa podia ultrapassar o limite da revisão. | O teto também é aplicado nesse caminho; dois acertos concluídos ainda consolidam a carta. Cenário específico no Chrome. |
| Uma revisão com todas as cartas adiadas terminava sem explicar o resultado. | O fechamento também informa cartas deixadas para a próxima revisão quando nenhuma foi consolidada. Cenários no Chrome. |
| Apagar o progresso mantinha respostas da sessão e uma série disponível para retomada. | O reset limpa também a sessão, a fila e o rascunho; voltar ao treino cria uma pergunta nova. Cenário no Chrome. |
| Trocar filtros durante uma série podia continuar fazendo perguntas incompatíveis com o modo selecionado. | A troca de modo, região, forma de resposta ou inclusão visual encerra a fila anterior e aplica a nova configuração. As respostas já gravadas são preservadas. Cenário no Chrome. |
| Iniciar uma revisão individual ou focada podia disputar prioridade com uma série anterior. | Os pontos de entrada agora encerram explicitamente a atividade anterior antes de preparar a nova fila. |
| Uma instalação incompleta do service worker podia apagar a versão offline anterior e anunciar uma atualização sem HTML disponível. | O HTML novo precisa ser armazenado antes da substituição; a ativação confirma sua presença antes de apagar os caches antigos. Testes de ciclo de vida com falha de rede. |
| Falta de espaço para gravar cache transformava uma resposta online válida em erro 503. | Falhas de gravação não descartam a resposta recebida da rede. Teste com quota simulada. |
| O teste dos tamanhos diários redeclarava uma variável global e interrompia a suíte. | Cada interação foi isolada em uma função. A suíte inteira agora executa no Chrome. |

## Cobertura executada

- Regras de respostas, normalização, colisões de nomes, migração e validação do progresso.
- Seleção adaptativa, agendamento, recuperação de erros, limites da revisão e retomada.
- Sete direções de pergunta pela prática de um país, com resposta correta em cada direção.
- Prova de 10 perguntas; configuração e persistência dos treinos de 5, 10 e 20; encerramento de treino diário.
- Pendências em lotes de 30 e 5, sem repetir cartas concluídas, retomada e estado sem pendências.
- Digitação vazia, digitação normalizada e correção da resposta.
- Cronômetro, pausa em segundo plano e expiração, com relógio controlado no teste.
- Importação de backup válido e rejeição de arquivo inválido sem modificar o progresso; formato e fusão do backup nos testes do núcleo.
- Atlas, moeda, filtros geográficos, microestados, zoom, teclado e enquadramento.
- Comparação de bandeiras e silhuetas após erro, destaque dos vizinhos e limpeza antes da pergunta seguinte.
- Temas, persistência das preferências, áudio, foco e acessibilidade exercitados pelos cenários existentes.
- Comparações sem transbordamento em 360 e 1280 pixels, nos temas claro e escuro; screenshots de celular claro e desktop escuro inspecionados visualmente. Os testes existentes também exercitam larguras intermediárias.
- Conta, apelido, falhas de rede, sincronização, renovação de token e conflitos com respostas simuladas; políticas do banco verificadas estaticamente.
- Instalação do service worker e recarregamento real com a rede desativada no Chrome.
- Falhas de atualização e quota de cache em testes isolados do service worker.
- Integridade dos 195 países, dados cartográficos, bandeiras, idiomas, moedas, indicadores, CSP e manifesto de release.

## Limites da validação

O login por e-mail e as gravações remotas foram simulados: não foi enviado magic link nem alterado o Supabase real. Não foi exercitada a instalação da PWA pela interface do sistema operacional, nem realizada uma matriz de navegadores ou aparelhos físicos. A exportação teve seu formato/serialização verificados; não foi conferida a conclusão de um download pelo gerenciador do navegador. O site publicado não foi atualizado nem comparado com estes arquivos locais.

O artefato `atlas-195.html` e o `sw.js` da raiz foram regenerados, com seus hashes no `release-manifest.json`. Nenhuma dependência npm foi adicionada.

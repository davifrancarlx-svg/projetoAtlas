# Atlas 195

Aplicação educacional para praticar bandeiras, capitais e localização de 193 Estados-membros da ONU, da Santa Sé e do Estado da Palestina.

O treino combina sete direções independentes (bandeira ↔ país, capital ↔ país, mapa ↔ país e país → região), sempre respondidas por escolha entre alternativas (ou apontando no mapa), tempo por pergunta opcional, revisão espaçada e reforço das habilidades mais fracas. O Atlas é navegável por teclado, aceita pular questões visuais sem penalidade e mantém o progresso no dispositivo, com conta opcional para sincronizar.

## Treino

- **Modos**: misto, bandeiras, capitais, localização e regiões. A área de estudo vai do mundo inteiro a um continente ou a uma subregião: as 22 subregiões do geoscheme M49 da ONU aparecem indentadas sob o balde amplo que o modo região cobra (Sudeste Asiático sob Ásia, África Ocidental sob África, Caribe sob as Américas do Norte, Central e Caribe).
- **Três formas de perguntar localização**: saber onde um país fica é uma habilidade só, e o Atlas a cobra de três jeitos, sorteados na mesma direção do progresso. **Apontar no mapa** fica com metade dos sorteios, porque é a interação que dá identidade ao app. **A silhueta** aparece nos dois sentidos: "que país tem esta forma?" e "qual destas formas é o Chile?", com quatro contornos lado a lado. **A fronteira** pergunta "qual destes faz fronteira com o Brasil?", com uma só alternativa correta e três países que não fazem — e o veredito lista todos os vizinhos, que é onde a pergunta ensina. Países sem forma na escala do mapa (microestados, Malta, Singapura) nunca viram silhueta; países sem vizinho terrestre nunca viram pergunta de fronteira. Nada disso muda o esquema do progresso: muda a evidência, não o que fica gravado.
- **Tempo**: livre, 30 s ou 15 s por pergunta. A barra fica vermelha nos últimos cinco segundos e o estouro entra como erro pelo mesmo caminho de uma resposta errada, sem tratamento especial no progresso. Com a aba em segundo plano o relógio pausa e retoma de onde parou.
- **Prova**: séries fechadas de 10, 20 ou 30 perguntas, iniciadas na aba Progresso, com nota, tempo médio e a lista de erros no fim. Respeita o modo e a área de estudo selecionados, e os erros alimentam o mesmo baralho de revisão.
- **Retomar o que ficou pela metade**: uma prova, um treino de hoje, uma prática de país **ou uma revisão focada** interrompidos ficam guardados neste navegador por até sete dias. Ao abrir o app, ele oferece retomar (com os filtros de então) ou descartar; qualquer outra ação descarta. No caso da série, o tempo parado não conta e a pergunta em curso é sorteada de novo. No caso da revisão, voltam a fila inteira, o placar e quantos acertos ainda faltam para cada habilidade — retomar continua o ciclo, não recomeça do zero.
- **Revisão focada**: encerrar a sessão abre o fechamento e oferece a revisão como ação principal — é o momento em que ela rende mais. A ordem é a da gravidade, não a cronológica: primeiro o que foi errado mais vezes, depois o que ficou sem recuperação, depois o que está em nível mais baixo. Cada habilidade só sai do baralho após **dois acertos separados por outras perguntas**; acertar uma vez logo depois do erro costuma ser memória de curto prazo, que não sobrevive ao dia seguinte. Errar de novo zera o ciclo, e um teto de seis aparições impede que alguém fique preso numa carta. A prova alimenta o mesmo baralho, e a aba Progresso lista os erros da sessão pela mesma regra do fechamento.
- **Escolha do que perguntar**: o sorteio pesa nível, vencimento da revisão e histórico de acerto. Uma habilidade vencida vale como uma de nível mais baixo, e cai mais fundo quanto mais atrasada, até empatar com um país inédito — deixar escapar o que já custou acertos é pior do que atrasar uma estreia. A direção da pergunta também segue a fraqueza (quem erra capitais recebe mais capitais), com um piso deliberado para nenhuma direção sumir: intercalar é o que faz a memória durar.
- **Só escolha**: toda pergunta é respondida escolhendo entre alternativas, ou apontando no mapa nas perguntas de localização. Não existe resposta digitada: ela cobrava grafia e acento, não geografia. Preferências e séries salvas por versões anteriores com "Digitar" continuam abrindo normalmente, já por escolha.
- **Força da resposta**: acertar apontando no mapa de cabeça, acertar rápido entre alternativas e acertar devagar entre alternativas não valem a mesma promoção: entre quatro alternativas sempre há 25% de chance cega, e apontar no mapa não tem nenhuma. A nota da resposta define o tamanho do passo e do intervalo até a próxima revisão. Sem tempo medido, o agendamento é o mesmo de antes.
- **Explicação do erro**: quando a resposta errada é um país concreto, o Atlas diz de quem era a resposta escolhida ("Banjul é a capital da Gâmbia", "a bandeira escolhida é a de Chade") e por que a confusão era plausível — bandeira parecida, capitais de escrita próxima ou de mesma inicial, fronteira em comum, vizinhança no mapa ou mesma subregião.
- **Backup**: exportar gera um arquivo com o envelope validado do progresso; importar funde com o que já existe no aparelho, sem apagar nada. O arquivo é o mesmo formato lido pelo `AtlasCore`, então um progresso corrompido é recusado sem efeito colateral.
- **Opções de treino**: a barra com modo, área, tempo e perguntas visuais abre sozinha no computador e no tablet. No celular (até 560 px de largura, ou 500 px de altura) ela começa recolhida no resumo "Misto · Mundo inteiro · Livre +", porque aberta ocuparia a primeira tela inteira e empurraria as alternativas para baixo da dobra. Abrir ou recolher pelo resumo é escolha da pessoa e fica salva neste navegador; o modo foco esconde a barra só enquanto dura.
- **Tema**: o botão na barra do topo cicla automático → claro → escuro. Automático é o padrão e segue o sistema; escolher claro ou escuro fixa a paleta mesmo que o sistema diga o contrário, e a escolha fica salva com as demais preferências. Um script no `<head>` aplica o tema salvo antes da primeira pintura, para a página não nascer com a paleta errada e piscar.

## Atlas

A ficha de cada país traz a silhueta na forma real (sem a deformação do mapa-múndi), **outros nomes** e **nome anterior** quando existem ("Outro nome: Eswatini", "Nome anterior: Suazilândia (até 2018)"), capital com as **mesmas notas do veredito do erro** (as três capitais da África do Sul, a sede de governo do Benin, o nome antigo da capital do Cazaquistão), subregião, área, idiomas listados com notas sobre seu estatuto, **moeda** com o código ISO ("Moeda: real (BRL)"), **fronteiras terrestres** ("Fronteiras terrestres (10): Argentina, Bolívia, …" ou "Sem fronteiras terrestres"), os seis indicadores oficiais com o ano de cada um e os destaques derivados. Vizinhos, idiomas e moedas são clicáveis: o vizinho abre a própria ficha, e o idioma ou a moeda lista os países que os compartilham, comparando o valor exato ("turco" não traz o Turcomenistão, "EUR" não traz a Europa inteira). O filtro soma com a busca e com a área e sai pelo botão **Limpar filtro**. Ela também mostra **o seu domínio** daquele país por habilidade (bandeira, capital, localização, região, com nível e revisão vencida) e um botão **Praticar** que abre uma série com todas as direções desse país.

A busca aceita país, capital, região, subregião, território, **idioma** e **moeda**: "francês" lista quem o tem na ficha, "euro" e "EUR" listam quem o usa. Ao lado dela, um **filtro por área**: os seis baldes amplos em fila e, quando um deles é escolhido, as subregiões dele logo abaixo. Tocar de novo no filtro ativo devolve o mundo inteiro.

## Progresso

A aba Progresso mostra os países estudados, dominados e as revisões vencidas, mais os totais de todo o histórico: respostas dadas, acerto geral e recorde de sequência. Abaixo vêm a sessão atual, o treino de hoje, a prova, o domínio por habilidade e por região, as revisões recomendadas, os pontos para reforçar, a conta opcional, o backup e o apagar progresso.

## Treino de hoje e evolução

Na aba Progresso, **Treino de hoje** permite escolher 5, 10 ou 20 perguntas com os filtros atuais. O tamanho fica salvo neste navegador. Reserva 60% das vagas para revisões vencidas, 20% para habilidades de nível baixo e 20% para novidades; quando falta algum grupo, completa com os demais. Não repete a mesma habilidade na série. Pode ser repetido e não exige conta. Questões visuais podem ser puladas sem penalidade, reduzindo o tamanho da série.

**Revisar somente pendências**, na mesma aba, seleciona exclusivamente habilidades vencidas no modo e na área atuais, das mais antigas às mais recentes. Cada lote contém até 30 perguntas, com contador, resultado e retomada em caso de interrupção. Ao terminar, é possível continuar com outro lote; sem pendências, o botão fica desabilitado. Cada habilidade aparece uma vez por lote, e os erros podem ser trabalhados na revisão focada do fechamento.

Depois de uma resposta incorreta identificável, dois cartões comparam a resposta correta com a escolhida: bandeiras, capitais ou silhuetas, conforme a pergunta. Nas perguntas de fronteira, todos os vizinhos aparecem destacados com contorno tracejado no mapa, acompanhados de legenda e da lista textual. O enquadramento não muda e os destaques desaparecem na pergunta seguinte.

Trocar modo, região ou inclusão de perguntas visuais encerra a série/revisão em curso e inicia treino livre com os novos filtros, preservando as respostas já gravadas. Apagar o progresso também limpa a sessão e o rascunho de retomada. O limite de seis aparições da revisão focada vale tanto para erros quanto para um acerto isolado que ainda não conclua a carta.

Uma atualização offline só substitui a versão anterior depois de armazenar o HTML novo com sucesso. Falhas de rede na instalação mantêm a versão anterior; falta de espaço no cache não impede uma resposta online válida de abrir.

Progresso e os fechamentos mostram quando revisar novamente, incluindo horário local e quantidade de habilidades no primeiro dia previsto. Se já houver revisões vencidas, mostram quantas estão disponíveis agora. O resumo destaca habilidades novas praticadas e aquelas que voltaram a ser acertadas após dificuldade, sem tratar um único acerto como domínio definitivo.

O plano usa o progresso existente. Os marcadores do resumo vivem apenas na sessão aberta; não criam histórico remoto adicional. `src/study.js` contém seleção, textos e pequenos componentes da interface.

## Sons opcionais

O botão **Som** no topo alterna entre desligado, baixo e médio. Começa desligado; ativar ou mudar o volume reproduz uma amostra curta. Na aba Progresso, a seção **Som** reúne os três controles — volume, **estilo** e **tocar em** — e trocar qualquer um deles toca uma amostra na hora. As escolhas ficam salvas somente neste navegador, separadas da conta e do progresso.

São três efeitos. O **acerto** sobe duas notas; a nota inicial percorre uma pentatônica de cinco pares antes de repetir, para uma série longa não martelar sempre o mesmo som. O **erro** cai uma terça menor no grave — cair é o gesto que se lê como "não" sem precisar de aspereza — e vale também para o tempo esgotado. O **fim de série** resolve em tônica, quinta e oitava, e toca uma vez ao fechar uma prova, um treino de hoje ou uma prática de país, nunca numa resposta.

Quatro estilos mudam só o timbre, nunca as notas nem os tempos, para "acertei" e "errei" não trocarem de significado: **Sino** (o padrão), **Marimba**, **Corda** e **Sopro**. Nenhum deles usa onda serra ou quadrada, e nada passa de meio segundo. Em **tocar em** dá para escolher "só os erros", que cala o acerto — o som que mais se repete — sem perder o aviso do erro nem o do fim de série.

Não há música de fundo, tique-taque, sons de navegação nem aumento de volume por sequência. Ao ocultar a aba ou desligar o som, a reprodução é interrompida.

Os sons são sintetizados localmente pela Web Audio API, sem downloads, arquivos de áudio no app ou dependências. Funcionam offline após a interação necessária para o navegador liberar áudio. Se o áudio não estiver disponível, o treino continua funcionando. `src/audio.js` contém síntese, preferência, controle e o painel da aba Progresso; as amostras em `docs/audio-samples/` são apenas para revisão e não entram no build.

## Melhorias de 1º de outubro de 2026

Instalação e novas funcionalidades de disponibilidade offline estão fora desta rodada, por decisão do usuário. A infraestrutura que já existia não foi expandida.

- Os filtros do Atlas (área, idioma, moeda e busca) destacam os resultados com contorno tracejado e enquadram seus aglomerados principais. Limpar os filtros restaura a visão mundial. Selecionar uma ficha ainda permite aproximar um país individualmente.
- A lista pode ser ordenada por nome, maior área ou maior população; valores ausentes ficam no fim, com desempate por nome.
- A ficha oferece comparação entre dois países, com capital, área, idiomas, moedas, fronteiras e os seis indicadores com seus anos. Ausências e diferenças de ano ficam explícitas.
- **Copiar link da ficha** produz um endereço com #pais=BR, por exemplo. Abrir esse endereço seleciona e enquadra o país. O fragmento de autenticação continua reservado à conta, e o link compartilhado não inclui tokens nem parâmetros de consulta.
- **Imprimir / PDF** usa um layout próprio para a ficha, incluindo bandeira e silhueta. **Exportar ficha (.txt)** baixa os dados, notas, territórios e fontes em texto; não inclui progresso pessoal.
- Progresso mostra quantos países ainda não foram estudados. **Treinar somente novidades** usa exclusivamente habilidades sem tentativas, respeita os filtros e oferece lotes de até 30, retomada e continuação.
- Revisões e dificuldades mostram os primeiros 12 itens e oferecem expansão para todos; a ordem está explicada. Os atalhos do teclado têm um painel recolhível e alimentam também as instruções acessíveis do mapa.
- O aviso de versão nova permanece visível no modo Foco. Depois de encerrar o treino, sem série/revisão ativa ou edição de campo, a atualização pode recarregar automaticamente após confirmar a gravação local. Durante exercícios permanece o botão manual.

### Histórico e compatibilidade

O envelope de progresso usa agora o **esquema 4**, com migração dos esquemas anteriores. A chave local permanece atlas195:v2 para encontrar os dados existentes. Backups novos exigem esta versão ou posterior; versões antigas do app não entendem o esquema 4. Antes de publicar, aplique supabase/migrations/202610010001_impede_regressao_esquema.sql: ela bloqueia gravações que rebaixem o esquema de uma linha existente. Clientes antigos mantêm seu progresso local, mas precisam atualizar a página para voltar a sincronizar. A migração foi preparada, não aplicada nesta rodada.

O tempo contabiliza apenas as perguntas respondidas a partir desta versão, excluindo períodos com a aba oculta ou em outra aba do Atlas. É tempo ativo de resposta, não uma estimativa retroativa. Uma nova visita inicia uma sessão. Guardam-se detalhes das 200 sessões mais recentes e das 1.000 escolhas incorretas identificáveis; o tempo acumulado continua incluindo sessões mais antigas. Confusões são agrupadas por país esperado, escolhido, habilidade e motivo. Erros de região e expirações não identificam outro país e não entram nessa lista.

Os históricos seguem o mesmo backup, sincronização opcional e limite de reset do restante do progresso. Contadores por instalação são fundidos pelo máximo; sessões e erros têm identificadores próprios para não duplicar reenvios. Apagar o progresso apaga também estes históricos. Não há nova chamada de rede nem novo serviço. A política de conta explica os dados adicionais.

Os módulos src/learning.js e src/country-tools.js isolam o histórico e as ferramentas de ficha; src/features.css contém seus estilos e a impressão, com orçamentos próprios. Nenhuma dependência foi adicionada.

## Desenvolvimento

Requer Node.js 22 ou superior. O código-fonte vive em `src/`; `atlas-195.html` é um artefato autocontido gerado.

```sh
npm test
npm run build
npm run budget
npm run serve
```

Abra `http://127.0.0.1:8743/atlas-195.html`.

## Estrutura

- `src/index.template.html`: estrutura semântica da interface.
- `src/styles.css`: identidade visual e responsividade.
- `src/core.js`: regras puras, validação, revisão adaptativa e a geometria de exibição (projeção Robinson, zoom, enquadramento e resolução de território).
- `src/sync-queue.js`: coordenador assíncrono testável que garante uma nova sincronização quando o progresso muda durante um envio em curso.
- `src/account.js`: a conta opcional (link mágico, perfil, apelido, sincronização), com as dependências injetadas pelo app e testes sem DOM.
- `src/atlas.js`: a aba Atlas — busca, filtro por área, ficha do país e territórios. Saiu de `app.js` pelo mesmo motivo da conta: é um bloco coeso que cresce sozinho.
- `src/progress.js`: a aba Progresso — totais, domínio, revisões, prova, backup e o recomeço. Apagar de verdade continua no app, que é quem sabe gravar; o módulo cuida da conversa com a pessoa.
- `src/app.js`: mapa, controles e renderização. Não guarda cópia própria dessas regras: consome o núcleo, que é testado sem DOM.
- `src/theme-boot.js`: aplica o tema salvo antes da primeira pintura. Só isso — a lógica de tema mora em `app.js`.
- `src/countries.base.json`: conteúdo educacional, com região e subregião (M49) de cada país.
- `src/languages.json`: idiomas oficiais de cada país, com nota quando o uso cotidiano diverge do estatuto legal. Complemento da ficha, nunca resposta de pergunta — ver `DATA_SOURCES.md`.
- `src/borders.json`: fronteiras terrestres entre os 195, um par por linha, com nota quando a fronteira acontece longe da metrópole. Alimentam a ficha, a explicação do erro e a variante de pergunta "quem faz fronteira com X".
- `src/currencies.json`: moeda de cada país, com nome em português e código ISO 4217, e nota quando o curso legal não conta a história sozinho. Complemento da ficha, nunca resposta de pergunta — ver `DATA_SOURCES.md`.
- `data/indicators.json`: seis indicadores oficiais — população, densidade, expectativa de vida e população urbana do Banco Mundial, área florestal da FAO e IDH do PNUD —, com origem, ano e hash registrados. São dados complementares da ficha e nunca viram pergunta; os destaques exibidos são derivados deles — e da contagem de fronteiras — por `Core.derivedFacts`.
- `src/territories.json`: territórios que a cartografia entrega dentro de outro país, com rótulo, capital regional e notas.
- `data/map-geometry.json`: geometria projetada gerada a partir do Natural Earth.
- `data/flags.json`: bandeiras SVG 4:3 geradas do flag-icons, com licença documentada.
- `scripts/`: build, servidor local e atualização cartográfica.
- `supabase/migrations/`: esquema e políticas RLS reproduzíveis da conta opcional.
- `tests/`: invariantes do núcleo, conteúdo, mapa, conta e um smoke test num Chrome real.

`npm run check` executa todos os testes, recria o HTML final, aplica os orçamentos de tamanho e verifica a atualidade mínima dos indicadores. O build também gera `release-manifest.json`, com hash e tamanho de cada arquivo publicado. Depois de publicar, `npm run verify:production` compara byte a byte a produção com esse manifesto. Os dados fixados também podem ser auditados com `node scripts/update-map.cjs --check` e `node scripts/update-flags.cjs --check` (o segundo baixa o arquivo de origem fixado para comparar os hashes).

## Dados cartográficos

Os contornos usam Natural Earth 1:10m, uma base cartográfica pública. A camada interativa preserva 6.222 componentes dos 195 países, incluindo 2.596 ilhas menores; outras 63 feições Admin-0 completam, de forma neutra e não interativa, a Groenlândia, a Antártida, dependências e áreas disputadas. O enquadramento Robinson contém o mundo inteiro e os alvos ampliados são calculados a partir de componentes territoriais reais, sem substituir a geometria visível.

A projeção Robinson preserva a leitura global, mas, como toda projeção plana, distorce áreas, distâncias e formas: estica na horizontal o que fica perto dos polos e inclina o que fica longe do meridiano central. No mapa, a Islândia sai quase duas vezes mais larga do que é e a Nova Zelândia sai deitada; 35 países passam de 25% de deformação. Trocar de projeção não resolve (a Winkel Tripel melhora os nórdicos e piora Japão, Nova Zelândia e Brasil), então o mapa continua Robinson e **as silhuetas mostram a forma real**: `Core.trueShape` volta cada ponto do contorno a longitude e latitude e o reprojeta num globo visto de frente, centrado no próprio país. Isso vale para as perguntas de silhueta, os cartões de comparação e a ficha do Atlas, que ganha a silhueta real e, quando o mapa deforma o país a ponto de se notar, uma nota dizendo se ele sai esticado, inclinado ou os dois (`Core.distortionNote`). Fronteiras disputadas seguem a convenção de facto da versão registrada em `DATA_SOURCES.md`.

O zoom vai de 1× a 60× e é ancorado no ponto apontado: nos dois extremos a janela para de mudar em vez de deslizar, e os botões `+` e `−` desabilitam quando o limite é alcançado.

No Atlas, o zoom por botão usa como âncora o país selecionado enquanto ele estiver visível; isso mantém microestados como Tuvalu no enquadramento. A navegação por teclado desloca a janela para manter visível o país ativo, sem mudar o nível de zoom. As linhas de latitude e longitude mantêm espessura constante.

Cada país guarda também os limites do seu **aglomerado principal** (`pb`): o componente que contém o ponto de rótulo mais tudo que estiver a menos de seis unidades projetadas dele. É esse retângulo que o Atlas enquadra e que recorta a silhueta da pergunta. O bounding box completo abria o mundo inteiro em 29 países — o dos Estados Unidos vai de Guam a Porto Rico, o da França vai do Caribe ao Índico —, enquanto o aglomerado mantém arquipélagos inteiros (as duas ilhas da Nova Zelândia, a Indonésia) e deixa de fora o que está a um oceano de distância.

Vaticano, Mônaco, Tuvalu, Nauru e San Marino ocupam frações de pixel nessa escala mesmo no zoom máximo; a partir de 6× eles recebem um anel de tamanho fixo em pixels, que não intercepta o ponteiro — a resolução de cliques continua sendo a geometria real mais as âncoras de toque.

Territórios que chegam dentro do polígono de outro país, como a Guiana Francesa, o Alasca ou as Canárias, são identificados pelo nome próprio no mapa e ganham ficha no Atlas, sem virar resposta de pergunta — ver `DATA_SOURCES.md`.

As bandeiras usam a coleção flag-icons 7.5.0 sob licença MIT. O progresso possui validação, migração, revisão independente por habilidade e sincronização segura entre abas, inclusive após um reset.

## O que sai do aparelho

**Sem conta, nada sai.** Sem entrar, o Atlas não faz nenhuma requisição de rede — nem para o backend, nem para qualquer outro lugar. É verificável: a política de segurança do artefato autoriza exatamente uma origem em `connect-src`, a do backend de contas, e nada dispara pedido sem sessão iniciada. Todo o resto (mapa, bandeiras, fontes) vem embutido no próprio arquivo.

**Com conta, são enviados ao Supabase:** o e-mail usado para entrar, o apelido (se você cadastrar) e o seu progresso — países, níveis, datas de revisão, recorde, tempo ativo respondendo e histórico de confusões entre países. Isso é derivado das suas respostas. Não há anúncio, rastreio, analytics nem terceiro envolvido; a conta existe só para levar o progresso a outro aparelho.

A conta é sempre opcional e nunca aparece na frente de quem quer treinar: ela vive num cartão da aba Progresso. Aberto direto do disco, o cartão nem existe. O aparelho continua sendo o dono do progresso — a conta é uma cópia que sincroniza, e o que decide conflito é o mesmo `Core.mergeProgress` que já reconcilia duas abas abertas, fundindo os dois lados em vez de escolher um. Se a rede cair ou o serviço sair do ar, aparece um aviso discreto e o treino continua igual.

O backup por arquivo continua existindo para quem prefere não criar conta nenhuma. A série interrompida fica só neste navegador (`atlas195:serie:v1`) e não é enviada a lugar nenhum.

O servidor local negocia `Accept-Encoding` e responde comprimido: os 2,9 MB do artefato viram cerca de 1,0 MB na primeira resposta e 0,9 MB nas seguintes, quando o brotli de qualidade máxima termina em segundo plano e substitui o cache. Nenhuma dependência é usada para isso.

O artefato já sai do build compactado sem perda: o traçado do mapa viaja em centésimos inteiros, cada ponto como diferença do anterior, e o app o descompacta ao abrir (`Core.decodePath`) de volta, byte a byte, ao path do gerador — o build recusa o arquivo se algum país não voltar igual. As bandeiras vão como SVG em texto na data URI, não em base64. Foi isso que levou o arquivo de 5,0 para 2,9 MB em 28/09/2026; o custo é a descompactação a cada abertura, cerca de 70 ms com a CPU quatro vezes mais lenta.

## Apelido opcional da conta

O cartão de conta permite cadastrar, editar e remover um apelido de até 40 caracteres depois de entrar. O login por e-mail não exige apelido. Contas antigas sem apelido continuam válidas. Para remover, apague o campo e salve.

Com conta, são enviados ao Supabase o e-mail usado para entrar, o progresso e, se cadastrado, o apelido. O apelido fica nos dados do perfil do Supabase Auth (`user_metadata.atlas_nickname`), atualizado por `PUT /auth/v1/user`, com HTTP direto e sem SDK. Não integra o backup de progresso nem é apagado ao zerar o aprendizado. O apelido não exige alteração de tabela ou política de acesso.

O perfil é consultado ao reabrir uma sessão e ao usar “Sincronizar agora”. Entre edições em aparelhos diferentes, prevalece a última gravação aceita pelo servidor. Salvar requer conexão; uma falha mantém o texto em edição para nova tentativa enquanto a página continuar aberta, sem impedir o treino ou a sincronização do progresso.

Enquanto o magic link confirma a identidade, o cartão informa o carregamento e permite sair. Uma falha oferece nova tentativa; editar o apelido só aparece depois da confirmação. O envio do link preserva o e-mail digitado e o foco, inclusive quando a rede falha.

## Auditoria das fontes e treino de confusões

Execute `npm run audit:sources` para consultar os indicadores oficiais, versões de bandeiras e cartografia, a lista ISO 4217 e novas edições do IDH. O comando escreve `reports/source-audit.md` e `.json`, sem alterar dados educacionais. Retorna 0 sem mudanças, 1 com mudanças e 2 com falha de consulta. O workflow existente executa essa consulta mensalmente e por disparo manual, publicando o relatório no resumo e nos artefatos do CI. A configuração passa a valer quando enviada ao repositório; nenhum serviço remoto foi alterado nesta implementação. Não depende da abertura do site por usuários.

Revise cada diferença antes de importar: `npm run indicators` atualiza as séries; versões de mapas e bandeiras permanecem fixadas até revisão. A referência da SIX fica em `data/source-audit-baseline.json` e só deve mudar após revisar o novo arquivo. Idiomas e capitais continuam exigindo análise editorial. A verificação local `data:freshness` permanece disponível sem rede.

Nas fichas, abra “Fontes e definições dos indicadores” para consultar a origem, o significado, o ano de referência e a data da coleta. Os links abrem uma nova aba e não são consultados automaticamente. A exportação de ficha inclui os endereços e as definições.

Em Progresso → Histórico de estudo → Confusões recorrentes, “Comparar os dois” abre a comparação pronta e “Treinar este par” inicia seis perguntas sobre os dois países. O treino alterna o par, prioriza a habilidade da confusão, inclui capitais como reforço e mantém o outro país nas alternativas de escolha. Respeita a preferência sem visual; localização é exercitada no mapa, sem perguntas de fronteira que mudariam a resposta esperada. O treino específico usa os países escolhidos independentemente do filtro regional, registra o progresso normalmente e pode ser retomado após recarga.

## Experiência no celular

As seções Treinar, Atlas e Progresso ficam numa barra inferior em telas de até 820 px. A barra respeita a área segura do aparelho e desaparece no modo Foco. Botões pequenos do Atlas e links de idioma, moeda e fronteira têm alvos de pelo menos 44 px em telas pequenas ou com ponteiro de toque; campos e seletores usam 16 px.

No Atlas móvel, os resultados aparecem antes da ficha, em uma lista recolhível. Selecionar um país recolhe a lista e leva à ficha. A ficha oferece retorno à busca e acesso ao mapa. Buscar um único resultado e pressionar Enter também abre a ficha. No treino, a próxima pergunta leva ao enunciado ou ao mapa necessário; o retorno após responder prioriza a explicação. Perguntas respondidas no mapa mostram o enunciado junto dele.

O cenário `tests/mobile-checkup-browser.cjs` verifica telas de 320×568, 360×640, 390×844, 844×390 e 320×340, sem transbordamento horizontal, campos legíveis, alvos de toque, navegação, busca, ficha, mapa, resposta e avanço. Usa eventos de toque do Chrome, incluindo arraste e pinça sem resposta acidental. Capturas e medições estão em `docs/mobile-review/`. A janela de altura reduzida verifica falta de espaço, mas não substitui testes com teclado virtual, Safari/iOS ou aparelhos físicos.

## Validação ampliada

A suíte opcional em [qa/README.md](qa/README.md) verifica migrações em banco
descartável, Firefox, WebKit e acessibilidade automática. Suas dependências são
exclusivas dos testes. O [roteiro de avaliação](docs/validacao-com-jogadores.md)
cobre aparelhos físicos, jogadores iniciantes e contas reais; não há ambiente
de teste remoto ou contas de teste confirmados nesta sessão.

## Evolução entre sessões — 02/10/2026

Progresso compara acertos nas duas sessões mais recentes de cada habilidade: capitais, bandeiras, localização e regiões. Cada lado precisa de ao menos cinco respostas. A comparação mostra acertos/total e diferença em pontos percentuais; não equivale a domínio, pois países e dificuldade podem mudar. A sessão atual é atualizada enquanto você joga.

Acertos por habilidade começam nesta versão. Históricos v2/v3 migram sem inventar acertos anteriores; duração, confusões e revisões são preservadas. O esquema 4 participa do backup e da sincronização. A proteção SQL já preparada também impede v4→v3; sua implantação remota foi adiada.

Listas de sessões, confusões e os 195 botões de domínio são montados ao abrir os respectivos painéis. A medição reproduzível em qa/performance.cjs usa CPU reduzida e dados fictícios, sem representar um aparelho real.

## Próximo passo e explicações — 02/10/2026

Progresso destaca um treino recomendado e recolhe opções secundárias. A escolha respeita pendências nos filtros atuais; depois considera erros da sessão, novidades e treino de hoje. As explicações associam cada capital ao seu país e sublinham diferenças de escrita. Bandeiras da Austrália/Nova Zelândia têm descrição verificada; outros pares recebem orientação visual. A lógica vive em src/feedback.js.

As fichas e a exportação incluem fontes editoriais por trecho, com data e escopo. Os 142 códigos ISO de moeda foram conferidos na SIX para os 195 países; nomes traduzidos e notas de uso não são validados por essa consulta. Fontes individuais de idiomas e capitais cobrem os 195 países; parte depende de arquivos históricos identificados. npm run audit:editorial gera o relatório e a [documentação por país](docs/editorial-195.md).

A navegação de abas e recolhimento vive em src/navigation.js; zoom, enquadramento,
coordenadas e pan vivem em src/map-viewport.js. Os módulos usam o mesmo estado do
mapa para preservar a seleção por toque. O build valida o registro de fontes
editoriais com scripts/editorial-metadata.cjs. audit:editorial registra referências para idiomas e capitais dos 195 países, em
02/10/2026. Idiomas de 68 países e capitais de 92 têm apenas fonte histórica.
Textos legais identificam a versão; consulta não equivale a vigência atual.
O snapshot em data/editorial-reference-audit.json registra revisão, hashes e
artigos consultados. npm run check exige cobertura completa desses dois campos.

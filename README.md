# Atlas 195

Aplicação educacional offline para praticar bandeiras, capitais e localização de 193 Estados-membros da ONU, da Santa Sé e do Estado da Palestina.

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

A ficha de cada país traz a silhueta na forma real (sem a deformação do mapa-múndi), **outros nomes** e **nome anterior** quando existem ("Outro nome: Eswatini", "Nome anterior: Suazilândia (até 2018)"), capital com as **mesmas notas do veredito do erro** (as três capitais da África do Sul, a sede de governo do Benin, o nome antigo da capital do Cazaquistão), subregião, área, idiomas oficiais, **moeda** com o código ISO ("Moeda: real (BRL)"), **fronteiras terrestres** ("Fronteiras terrestres (10): Argentina, Bolívia, …" ou "Sem fronteiras terrestres"), os seis indicadores oficiais com o ano de cada um e os destaques derivados. Vizinhos, idiomas e moedas são clicáveis: o vizinho abre a própria ficha, e o idioma ou a moeda lista os países que os compartilham, comparando o valor exato ("turco" não traz o Turcomenistão, "EUR" não traz a Europa inteira). O filtro soma com a busca e com a área e sai pelo botão **Limpar filtro**. Ela também mostra **o seu domínio** daquele país por habilidade (bandeira, capital, localização, região, com nível e revisão vencida) e um botão **Praticar** que abre uma série com todas as direções desse país.

A busca aceita país, capital, região, subregião, território, **idioma** e **moeda**: "francês" lista quem o tem como oficial, "euro" e "EUR" listam quem o usa. Ao lado dela, um **filtro por área**: os seis baldes amplos em fila e, quando um deles é escolhido, as subregiões dele logo abaixo. Tocar de novo no filtro ativo devolve o mundo inteiro.

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
- `data/indicators.json`: seis indicadores oficiais (população, densidade, expectativa de vida, população urbana, área florestal e IDH), com origem, ano e hash registrados. São dados complementares da ficha e nunca viram pergunta; os destaques exibidos são derivados deles — e da contagem de fronteiras — por `Core.derivedFacts`.
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

**Com conta, são enviados ao Supabase:** o e-mail usado para entrar, o apelido (se você cadastrar) e o seu progresso — países, níveis, datas de revisão e recorde. Isso é derivado das suas respostas. Não há anúncio, rastreio, analytics nem terceiro envolvido; a conta existe só para levar o progresso a outro aparelho.

A conta é sempre opcional e nunca aparece na frente de quem quer treinar: ela vive num cartão da aba Progresso. Aberto direto do disco, o cartão nem existe. O aparelho continua sendo o dono do progresso — a conta é uma cópia que sincroniza, e o que decide conflito é o mesmo `Core.mergeProgress` que já reconcilia duas abas abertas, fundindo os dois lados em vez de escolher um. Se a rede cair ou o serviço sair do ar, aparece um aviso discreto e o treino continua igual.

O backup por arquivo continua existindo para quem prefere não criar conta nenhuma. A série interrompida fica só neste navegador (`atlas195:serie:v1`) e não é enviada a lugar nenhum.

O servidor local negocia `Accept-Encoding` e responde comprimido: os 2,9 MB do artefato viram cerca de 1,0 MB na primeira resposta e 0,9 MB nas seguintes, quando o brotli de qualidade máxima termina em segundo plano e substitui o cache. Nenhuma dependência é usada para isso.

O artefato já sai do build compactado sem perda: o traçado do mapa viaja em centésimos inteiros, cada ponto como diferença do anterior, e o app o descompacta ao abrir (`Core.decodePath`) de volta, byte a byte, ao path do gerador — o build recusa o arquivo se algum país não voltar igual. As bandeiras vão como SVG em texto na data URI, não em base64. Foi isso que levou o arquivo de 5,0 para 2,9 MB em 28/09/2026; o custo é a descompactação a cada abertura, cerca de 70 ms com a CPU quatro vezes mais lenta.

## Apelido opcional da conta

O cartão de conta permite cadastrar, editar e remover um apelido de até 40 caracteres depois de entrar. O login por e-mail não exige apelido. Contas antigas sem apelido continuam válidas. Para remover, apague o campo e salve.

Com conta, são enviados ao Supabase o e-mail usado para entrar, o progresso e, se cadastrado, o apelido. O apelido fica nos dados do perfil do Supabase Auth (`user_metadata.atlas_nickname`), atualizado por `PUT /auth/v1/user`, com HTTP direto e sem SDK. Não integra o backup de progresso nem é apagado ao zerar o aprendizado. O apelido não exige alteração de tabela ou política de acesso.

O perfil é consultado ao reabrir uma sessão e ao usar “Sincronizar agora”. Entre edições em aparelhos diferentes, prevalece a última gravação aceita pelo servidor. Salvar requer conexão; uma falha mantém o texto em edição para nova tentativa enquanto a página continuar aberta, sem impedir o treino ou a sincronização do progresso.

Enquanto o magic link confirma a identidade, o cartão informa o carregamento e permite sair. Uma falha oferece nova tentativa; editar o apelido só aparece depois da confirmação. O envio do link preserva o e-mail digitado e o foco, inclusive quando a rede falha.

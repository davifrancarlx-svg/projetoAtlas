# Atlas 195

Aplicação educacional offline para praticar bandeiras, capitais e localização de 193 Estados-membros da ONU, da Santa Sé e do Estado da Palestina.

O treino combina sete direções independentes (bandeira ↔ país, capital ↔ país, mapa ↔ país e país → região), escolha ou digitação, tempo por pergunta opcional, revisão espaçada e reforço das habilidades mais fracas. O Atlas é navegável por teclado, aceita pular questões visuais sem penalidade e mantém o progresso no dispositivo, com conta opcional para sincronizar.

## Treino

- **Modos**: misto, bandeiras, capitais, localização e regiões. A área de estudo vai do mundo inteiro a um continente ou a uma subregião: as 22 subregiões do geoscheme M49 da ONU aparecem indentadas sob o balde amplo que o modo região cobra (Sudeste Asiático sob Ásia, África Ocidental sob África, Caribe sob as Américas do Norte, Central e Caribe). A direção país → região é sempre por escolha — digitar "América do Norte, Central e Caribe" cobraria grafia, não geografia —, e escolher esse modo com a resposta em "Digitar" mantém o assunto em vez de trocar o treino.
- **Silhueta**: a pergunta "mapa → país" alterna entre o pin no mapa e o contorno isolado do país ("Que país tem esta forma?"). É a mesma habilidade, registrada no mesmo lugar do progresso, com duas evidências diferentes. Países que na escala do mapa não têm forma (microestados, Malta, Singapura) nunca viram silhueta.
- **Tempo**: livre, 30 s ou 15 s por pergunta. A barra fica vermelha nos últimos cinco segundos e o estouro entra como erro pelo mesmo caminho de uma resposta errada, sem tratamento especial no progresso. Com a aba em segundo plano o relógio pausa e retoma de onde parou.
- **Prova**: séries fechadas de 10, 20 ou 30 perguntas, iniciadas na aba Progresso, com nota, tempo médio e a lista de erros no fim. Respeita o modo e a área de estudo selecionados, e os erros alimentam o mesmo baralho de revisão. Uma prova, um treino de hoje ou uma prática de país interrompidos ficam guardados neste navegador por até sete dias: ao abrir o app, ele oferece retomar (com os filtros de então) ou descartar. O tempo parado não conta e a pergunta em curso é sorteada de novo.
- **Revisão focada**: encerrar a sessão abre o fechamento e oferece a revisão como ação principal — é o momento em que ela rende mais. A ordem é a da gravidade, não a cronológica: primeiro o que foi errado mais vezes, depois o que ficou sem recuperação, depois o que está em nível mais baixo. Cada habilidade só sai do baralho após **dois acertos separados por outras perguntas**; acertar uma vez logo depois do erro costuma ser memória de curto prazo, que não sobrevive ao dia seguinte. Errar de novo zera o ciclo, e um teto de seis aparições impede que alguém fique preso numa carta. A prova alimenta o mesmo baralho, e a aba Progresso lista os erros da sessão pela mesma regra do fechamento.
- **Escolha do que perguntar**: o sorteio pesa nível, vencimento da revisão e histórico de acerto. Uma habilidade vencida vale como uma de nível mais baixo, e cai mais fundo quanto mais atrasada, até empatar com um país inédito — deixar escapar o que já custou acertos é pior do que atrasar uma estreia. A direção da pergunta também segue a fraqueza (quem erra capitais recebe mais capitais), com um piso deliberado para nenhuma direção sumir: intercalar é o que faz a memória durar.
- **Força da resposta**: acertar digitando de cabeça, acertar rápido entre alternativas e acertar devagar entre alternativas deixaram de valer a mesma promoção. A nota da resposta define o tamanho do passo e do intervalo até a próxima revisão. Sem tempo medido, o agendamento é o mesmo de antes.
- **Explicação do erro**: quando a resposta errada é um país concreto, o Atlas diz de quem era a resposta escolhida ("Banjul é a capital da Gâmbia", "a bandeira escolhida é a de Chade") e por que a confusão era plausível — bandeira parecida, capitais de escrita próxima ou de mesma inicial, fronteira em comum, vizinhança no mapa ou mesma subregião.
- **Backup**: exportar gera um arquivo com o envelope validado do progresso; importar funde com o que já existe no aparelho, sem apagar nada. O arquivo é o mesmo formato lido pelo `AtlasCore`, então um progresso corrompido é recusado sem efeito colateral.
- **Tema**: o botão na barra do topo cicla automático → claro → escuro. Automático é o padrão e segue o sistema; escolher claro ou escuro fixa a paleta mesmo que o sistema diga o contrário, e a escolha fica salva com as demais preferências. Um script no `<head>` aplica o tema salvo antes da primeira pintura, para a página não nascer com a paleta errada e piscar.

## Atlas

A ficha de cada país traz capital, subregião, área, idiomas oficiais, **fronteiras terrestres** ("Fronteiras terrestres (10): Argentina, Bolívia, …" ou "Sem fronteiras terrestres"), os seis indicadores oficiais com o ano de cada um e os destaques derivados. Ela também mostra **o seu domínio** daquele país por habilidade (bandeira, capital, localização, região, com nível e revisão vencida) e um botão **Praticar** que abre uma série com todas as direções desse país. A busca aceita país, capital, região, subregião, território e **idioma**: "francês" lista quem o tem como oficial.

## Progresso

A aba Progresso mostra os países estudados, dominados e as revisões vencidas, mais os totais de todo o histórico: respostas dadas, acerto geral e recorde de sequência. Abaixo vêm a sessão atual, o treino de hoje, a prova, o domínio por habilidade e por região, as revisões recomendadas, os pontos para reforçar, a conta opcional, o backup e o apagar progresso.

## Treino de hoje e evolução

Na aba Progresso, **Treino de hoje** inicia uma série de até 10 perguntas com os filtros atuais. Reserva até seis perguntas para revisões vencidas, duas para habilidades de nível baixo e duas para novidades; quando falta algum grupo, completa com os demais. Não repete a mesma habilidade na série. Pode ser repetido e não exige conta. Questões visuais podem ser puladas sem penalidade, reduzindo o tamanho da série.

Progresso e os fechamentos mostram quando revisar novamente, incluindo horário local e quantidade de habilidades no primeiro dia previsto. Se já houver revisões vencidas, mostram quantas estão disponíveis agora. O resumo destaca habilidades novas praticadas e aquelas que voltaram a ser acertadas após dificuldade, sem tratar um único acerto como domínio definitivo.

O plano usa o progresso existente. Os marcadores do resumo vivem apenas na sessão aberta; não criam histórico remoto adicional. `src/study.js` contém seleção, textos e pequenos componentes da interface.

## Sons opcionais

O botão **Som** alterna entre desligado, baixo e médio. Começa desligado; ativar ou mudar o volume reproduz uma amostra curta. A escolha fica salva somente neste navegador, separada da conta e do progresso.

Acertos usam duas notas suaves com três variações; erros e tempo esgotado usam uma nota baixa e curta. Não há música de fundo, tique-taque, sons de navegação nem aumento de volume por sequência. Ao ocultar a aba ou desligar o som, a reprodução é interrompida.

Os sons são sintetizados localmente pela Web Audio API, sem downloads, arquivos de áudio no app ou dependências. Funcionam offline após a interação necessária para o navegador liberar áudio. Se o áudio não estiver disponível, o treino continua funcionando. `src/audio.js` contém síntese, preferência e controle; as amostras em `docs/audio-samples/` são apenas para revisão e não entram no build.

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
- `src/app.js`: mapa, controles e renderização. Não guarda cópia própria dessas regras: consome o núcleo, que é testado sem DOM.
- `src/theme-boot.js`: aplica o tema salvo antes da primeira pintura. Só isso — a lógica de tema mora em `app.js`.
- `src/countries.base.json`: conteúdo educacional, com região e subregião (M49) de cada país.
- `src/languages.json`: idiomas oficiais de cada país, com nota quando o uso cotidiano diverge do estatuto legal. Complemento da ficha, nunca resposta de pergunta — ver `DATA_SOURCES.md`.
- `src/borders.json`: fronteiras terrestres entre os 195, um par por linha, com nota quando a fronteira acontece longe da metrópole. Complemento da ficha e da explicação do erro, nunca resposta.
- `data/indicators.json`: seis indicadores oficiais (população, densidade, expectativa de vida, população urbana, área florestal e IDH), com origem, ano e hash registrados. São dados complementares da ficha e nunca viram pergunta; os destaques exibidos são derivados deles por `Core.derivedFacts`.
- `src/territories.json`: territórios que a cartografia entrega dentro de outro país, com rótulo, capital regional e notas.
- `data/map-geometry.json`: geometria projetada gerada a partir do Natural Earth.
- `data/flags.json`: bandeiras SVG 4:3 geradas do flag-icons, com licença documentada.
- `scripts/`: build, servidor local e atualização cartográfica.
- `supabase/migrations/`: esquema e políticas RLS reproduzíveis da conta opcional.
- `tests/`: invariantes do núcleo, conteúdo, mapa, conta e um smoke test num Chrome real.

`npm run check` executa todos os testes, recria o HTML final, aplica os orçamentos de tamanho e verifica a atualidade mínima dos indicadores. O build também gera `release-manifest.json`, com hash e tamanho de cada arquivo publicado. Depois de publicar, `npm run verify:production` compara byte a byte a produção com esse manifesto. Os dados fixados também podem ser auditados com `node scripts/update-map.cjs --check` e `node scripts/update-flags.cjs --check` (o segundo baixa o arquivo de origem fixado para comparar os hashes).

## Dados cartográficos

Os contornos usam Natural Earth 1:10m, uma base cartográfica pública. A camada interativa preserva 6.222 componentes dos 195 países, incluindo 2.596 ilhas menores; outras 63 feições Admin-0 completam, de forma neutra e não interativa, a Groenlândia, a Antártida, dependências e áreas disputadas. O enquadramento Robinson contém o mundo inteiro e os alvos ampliados são calculados a partir de componentes territoriais reais, sem substituir a geometria visível.

A projeção Robinson preserva a leitura global, mas, como toda projeção plana, distorce áreas e distâncias. Fronteiras disputadas seguem a convenção de facto da versão registrada em `DATA_SOURCES.md`.

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

O servidor local negocia `Accept-Encoding` e responde comprimido: os 4,9 MB do artefato viram cerca de 1,6 MB na primeira resposta e 1,1 MB nas seguintes, quando o brotli de qualidade máxima termina em segundo plano e substitui o cache. Nenhuma dependência é usada para isso.

## Apelido opcional da conta

O cartão de conta permite cadastrar, editar e remover um apelido de até 40 caracteres depois de entrar. O login por e-mail não exige apelido. Contas antigas sem apelido continuam válidas. Para remover, apague o campo e salve.

Com conta, são enviados ao Supabase o e-mail usado para entrar, o progresso e, se cadastrado, o apelido. O apelido fica nos dados do perfil do Supabase Auth (`user_metadata.atlas_nickname`), atualizado por `PUT /auth/v1/user`, com HTTP direto e sem SDK. Não integra o backup de progresso nem é apagado ao zerar o aprendizado. O apelido não exige alteração de tabela ou política de acesso.

O perfil é consultado ao reabrir uma sessão e ao usar “Sincronizar agora”. Entre edições em aparelhos diferentes, prevalece a última gravação aceita pelo servidor. Salvar requer conexão; uma falha mantém o texto em edição para nova tentativa enquanto a página continuar aberta, sem impedir o treino ou a sincronização do progresso.

Enquanto o magic link confirma a identidade, o cartão informa o carregamento e permite sair. Uma falha oferece nova tentativa; editar o apelido só aparece depois da confirmação. O envio do link preserva o e-mail digitado e o foco, inclusive quando a rede falha.

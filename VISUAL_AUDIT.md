# Auditoria visual local — 10 de setembro de 2026

> **Nota de 16 de setembro de 2026:** as conquistas (troféus, avisos, cartão na aba Progresso, sincronização e migration) foram removidas do produto a pedido do usuário. As menções a elas abaixo são registro histórico da auditoria daquela data e não descrevem o app atual. As seis correções visuais (V01–V06) continuam em vigor e cobertas por `tests/visual-regression.cjs`.

Estado: as seis correções abaixo foram aprovadas, implementadas e verificadas localmente no Chrome nos temas claro e escuro. Apelido e conquistas já estavam implementados e aprovados antes da auditoria. Nada foi publicado. O diagnóstico original está preservado para registrar o que acontecia antes.

## Ambiente e método

- Chrome real 153.0.8010.28, controlado por CDP, com perfil temporário isolado; Node 24.18.0; Windows.
- Artefatos locais servidos por HTTP. Nenhum pacote instalado.
- Temas claro e escuro; tema automático com preferência do sistema clara e escura.
- Janelas de 360 × 900, 768 × 1024 e 1280 × 900 pixels. São dimensões emuladas no Chrome de desktop, não aparelhos físicos.
- Capturas de tela, medidas de posição e foco, eventos de mouse/teclado e estado do navegador. Conta com respostas HTTP simuladas e credenciais fictícias; nenhum e-mail real enviado.
- Offline provocado no navegador depois de preencher o cache. Atualização de versão provocada alterando somente a resposta do servidor temporário em memória.

## Bugs confirmados e plano de correção

| ID | Prioridade | Tela e reprodução | Problema observado | Correção proposta | Arquivos de implementação |
| --- | --- | --- | --- | --- | --- |
| V01 | Alta | Atlas, buscar Tuvalu, selecionar e aumentar pelo botão + até 60×; ambos os temas | Tuvalu sai da área visível conforme o zoom aumenta. O centro do país fica fora da janela do mapa, embora a ficha continue aberta. | No Atlas, ancorar o zoom por botão no país selecionado quando ele estiver visível. Preservar o comportamento de zoom sob o ponteiro e os limites existentes. Não alterar coordenadas nem formas. | `src/app.js` |
| V02 | Alta | Mapa ampliado a 60×, foco no mapa, tecla End; reproduzido com Zimbábue | O país ativo no teclado muda, mas fica fora da área visível. A seleção existe para o leitor de tela e não aparece para quem acompanha visualmente. | Deslocar a janela quando a navegação por teclado levar a um país fora dela, mantendo o nível de zoom e respeitando os limites do mundo. | `src/app.js` |
| V03 | Média | Mapa a 60× perto do cruzamento de latitude/longitude, ambos os temas | As linhas engrossam para aproximadamente 28,6 pixels no desktop. A regra de espessura fixa está no grupo SVG, mas os caminhos têm `vector-effect: none`. | Aplicar a espessura independente de zoom diretamente aos caminhos das linhas de referência. | `src/styles.css` |
| V04 | Alta | Progresso → Conta, digitar e-mail, Enter, resposta lenta ou falha de rede; ambos os temas | O e-mail desaparece imediatamente e o foco vai para o corpo da página. Na falha, é preciso digitar novamente. | Preservar o rascunho do e-mail e o foco ao atualizar o estado do envio. Manter prevenção de envios duplicados e permitir nova tentativa. | `src/app.js` |
| V05 | Alta | Abrir magic link e atrasar ou rejeitar a consulta do perfil; ambos os temas no carregamento | O cartão anuncia “Conectado como sua conta” e oferece salvar apelido antes de confirmar a identidade. Na falha, mantém a afirmação de conexão ao lado do erro. | Distinguir conexão em andamento, falha recuperável e conta confirmada. Exibir ações de perfil apenas após confirmar a identidade, mantendo treino disponível e oferecendo recuperação/saída. | `src/app.js` |
| V06 | Média | Progresso → Backup, Tab de Exportar para Importar; ambos os temas | O campo de arquivo recebe foco, mas o botão visível Importar não mostra contorno. A regra CSS espera uma ordem de elementos diferente da ordem real. | Alinhar a ordem do campo e do rótulo à regra de foco, conservando o seletor nativo de arquivos e um contorno visível nos dois temas. | `src/app.js`, `src/styles.css` se necessário |

Evidências visuais preservadas em `docs/visual-audit/`: `tuvalu-60.png` (V01), `keyboard-map-60-dark.png` (V02 e V03), `keyboard-map-60-light.png` (V03), `account-error-light.png` (V04), `account-callback-pending-light.png` e `account-callback-fail.png` (V05), `keyboard-import-light.png` (V06). A perda de foco e o país fora da tela também foram confirmados por medidas do DOM; uma captura isolada não demonstra esses estados por completo.

As seis correções foram aplicadas em `src/app.js` e `src/styles.css`. `tests/visual-regression.cjs`, chamado pelo smoke test, repete os cenários no Chrome. `tests/account.test.cjs` também cobre perfil pendente, recuperação, resposta atrasada após saída e perfil malformado; `tests/infrastructure.test.cjs` acompanha o bloqueio de envio duplicado sem retirar o botão da navegação por teclado. Os artefatos foram gerados exclusivamente pelo build.

### Resultado depois das correções

- V01: os cinco microestados ficaram visíveis a 60× nos dois temas; os anéis continuaram com cerca de 14 pixels e os cliques alcançaram o país correto.
- V02: End moveu a janela até Zimbábue sem alterar o nível de zoom. A ficha só muda ao selecionar com Enter, preservando a navegação existente.
- V03: os caminhos das linhas de referência agora têm `non-scaling-stroke`, mantendo a espessura independente da ampliação.
- V04: o e-mail e o foco foram preservados durante o envio e depois da falha. Enter repetido durante o envio não duplicou o pedido.
- V05: o carregamento informa “Confirmando sua conexão”; falhas permitem tentar novamente. Não há campo de apelido antes da confirmação. A recuperação por teclado leva o foco ao campo de apelido. Tokens continuam removidos da URL.
- V06: Tab alcança o seletor de arquivo e mostra contorno no botão Importar nos dois temas.

Capturas posteriores em `docs/visual-audit/fixed-*.png`. As capturas originais foram mantidas. O erro da fila de avisos de conquistas, descoberto e corrigido durante a tarefa 2, também permanece documentado no HANDOFF; ele não é uma pendência adicional.

## Verificações sem falha observada

- Primeiro paint: seis combinações de escolha salva (automático/claro/escuro) e preferência do sistema. As primeiras imagens pintadas usaram o tema esperado; não houve flash de tema errado.
- Zoom: limites 1× e 60× estáveis ao insistir na roda; botões desabilitados no limite correspondente. Vaticano, Mônaco, Nauru e San Marino permaneceram acessíveis a 60×. Tuvalu é a exceção registrada em V01.
- Anéis dos microestados: cerca de 14 pixels e `pointer-events: none`; cliques atravessaram o anel e alcançaram o país correto nos quatro casos visíveis a 60×.
- Responsividade: cronômetro, barra vermelha nos últimos cinco segundos, opções, resposta digitada, bandeiras e encerramentos de sessão/prova nas três larguras e nos dois temas. Não houve transbordamento horizontal nos cenários medidos; opções tiveram pelo menos 44 pixels de altura. As telas longas usam rolagem.
- Conta: perfil confirmado e saída funcionaram com a API simulada. O fragmento com tokens foi removido da URL, inclusive com consulta pendente ou falha. Edição de apelido e preservação do rascunho/foco também estão cobertas pela verificação anterior e pelo teste Chrome da suíte.
- Teclado: link para pular ao conteúdo, resposta/continuação, validação de resposta vazia, abrir/fechar conquistas, confirmação de apagar progresso e retorno do foco ao cancelar. Navegação do mapa funcionou na visão global; V02 trata a visibilidade no mapa ampliado. V06 trata o foco de importar.
- PWA: manifesto sem erros e verificação de requisitos de instalação sem impedimentos reportados pelo Chrome. App reabriu e respondeu a uma questão com a rede desativada. Aba já aberta recebeu o aviso de versão nova; o botão Recarregar ativou a nova versão e retirou o aviso.

## Limitações e pendências externas

- A instalação efetiva da PWA e sua abertura em janela independente não foram verificadas. O Chrome deste ambiente não disponibilizou o comando de instalação, embora tenha aprovado os requisitos. Isso é uma limitação da verificação, não um bug comprovado do app.
- Os estados de conta foram simulados para provocar atrasos/falhas sem enviar dados reais. A migration de conquistas não foi aplicada nem executada contra Supabase/PostgreSQL. A integração real continua pendente antes de uma futura publicação.
- A cobertura não equivale a testar todos os navegadores, dispositivos físicos ou leitores de tela. A navegação por teclado foi exercitada no Chrome.

## Resultado da suíte na descoberta dos bugs

`npm run check`: **137 testes passaram, 0 falhas, 0 ignorados**. Inclui Chrome real, build, hashes de CSP/normalização de quebras de linha, orçamento de tamanho e atualidade dos dados. HTML gerado: 5007,4 KiB de 5376 KiB permitidos. `src/app.js`: 146,9 KiB de 150 KiB; as correções precisam respeitar a margem restante, sem aumentar o limite por conveniência.

Esse resultado verde ainda coexistia com os seis defeitos: eles foram encontrados na exploração de estados então ausentes da suíte. Os testes de regressão acrescentados agora cobrem esses casos no navegador real.

## Verificação final após as correções

`npm run check`: **140 testes passaram, 0 falhas, 0 ignorados**, incluindo as regressões visuais no Chrome e os testes de recuperação/validação do perfil. Build, CSP/LF, orçamento e atualidade dos dados passaram. HTML: 5009,4 KiB de 5376 KiB; `src/app.js`: 148,9 KiB de 150 KiB. Nenhum limite foi aumentado para acomodar as correções. `git diff --check` também passou.

## Verificação posterior — sons opcionais

O pedido de sons foi aprovado depois da entrega das seis correções. O botão Som foi verificado em Chrome real nas larguras 360, 768 e 1280, em claro/escuro, inclusive com teclado. Durante a implementação, o botão inicialmente criava uma linha extra no cabeçalho desktop; a apresentação compacta do subtítulo da marca nessa faixa resolveu isso, sem reduzir as áreas de toque. Capturas em `docs/visual-audit/sound-*.png`.

Ativação pelo teclado, amostra de volume, som associado à resposta, prioridade entre sons simultâneos e preferência após recarregar passaram. A renderização offline nativa confirmou sinal presente, sem saturação e com final silencioso. O teste passou a aguardar a primeira pergunta: antes disso, podia tentar clicar no botão ainda sem controlador, durante a leitura inicial do HTML. A qualidade percebida do timbre fica para escuta do usuário, com amostras em `docs/audio-samples/`.

`npm run check` após sons: **146 passaram, 0 falhas, 0 ignorados**. HTML final: 5014,6 KiB de 5376 KiB. As pendências externas continuam adiadas, conforme decisão do usuário.

### Segunda rodada de som — estilos, escopo e fim de série (16 de setembro de 2026)

A pedido do usuário, os sons ganharam quatro estilos de timbre (Sino, Marimba, Corda, Sopro), um terceiro efeito para o fim de série e a opção de tocar só nos erros. A seção **Som** da aba Progresso foi conferida em Chrome real a 390 e 1280 pixels, em claro e escuro: os três seletores ficam numa linha no desktop (725×91) e empilham no celular (362×301), sem estourar a largura em nenhum dos dois.

A medição offline agora cobre os doze sons (quatro estilos × três efeitos): pico entre 0,02 e 0,5 — ficou entre 0,125 e 0,149 —, silêncio depois de um segundo e assinatura de energia diferente entre todos, que é o que impede dois estilos acabarem iguais. Nenhum estilo usa onda serra ou quadrada, e o teste recusa quem usar. Amostras atualizadas em `docs/audio-samples/`, uma por estilo.

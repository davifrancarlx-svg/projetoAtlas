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

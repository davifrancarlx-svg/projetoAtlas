# Sugestões novas — somente para avaliação

Atualizado em 16 de setembro de 2026. As cinco sugestões da rodada anterior foram resolvidas: a próxima revisão, a retomada de prova interrompida e a separação do módulo de conta foram implementadas; o backup completo e o filtro de conquistas deixaram de existir junto com as conquistas, removidas a pedido do usuário. As ideias abaixo são novas, não foram pedidas e ficam só para avaliação. A ordem considera benefício para quem joga, esforço e risco. Não inclui inglês nem fichas para terras fora dos 195.

| Ordem | Sugestão | Por que faz sentido neste código | Decisão e custo a avaliar |
| --- | --- | --- | --- |
| 1 | Pergunta de fronteira ("qual destes faz fronteira com X?") | As fronteiras já existem em `src/borders.json` e no artefato (`nb`), validadas por testes. Hoje só alimentam a ficha e a explicação do erro. | Seria uma direção nova de pergunta, o que toca o esquema do progresso (validação, migração, fusão, sincronização) e a compatibilidade entre aparelhos com versões diferentes. Alternativa mais segura: variante da pergunta de localização, como foi feito com a silhueta. Esforço médio. |
| 2 | Silhueta com escolha entre silhuetas ("qual destas formas é X?") | A variante atual mostra uma forma e pede o país. O sentido inverso, quatro silhuetas e um nome, usa a mesma habilidade e os mesmos dados. | Renderizar quatro contornos por pergunta em vez de um; cuidar do tamanho no celular. Esforço baixo. |
| 3 | Filtro do Atlas por subregião (chips) | Com 22 subregiões, a busca por texto exige saber o nome. Um filtro clicável ao lado da busca ajuda quem explora. | Só interface; o dado já existe em `sr`. Esforço baixo; observar orçamento de `src/app.js`. |
| 4 | Retomar também a revisão focada interrompida | A prova, o treino de hoje e a prática de um país já são retomáveis. O baralho de revisão ainda vive só na memória da página. | Guardar a fila de cartas e o placar do baralho no mesmo rascunho da série. Esforço médio; regras claras para o ciclo de dois acertos. |
| 5 | Moeda na ficha do país | Complemento editorial no mesmo molde dos idiomas: lista de 195 entradas, política de "nunca resposta", teste de colisão com o universo de respostas. | Esforço médio de curadoria; manutenção quando moedas mudam. Sem valor para o quiz, só para a ficha. |

Continua pendente, como verificação e não como sugestão: a instalação efetiva da PWA em janela independente não foi exercitada porque o Chrome de teste não expõe o comando de instalação.

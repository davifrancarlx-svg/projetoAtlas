# Sugestões novas — somente para avaliação

Atualizado em 16 de setembro de 2026, depois de implementar as cinco sugestões da rodada anterior: pergunta de fronteira, silhueta no sentido inverso, filtro do Atlas por subregião, retomada da revisão focada e moeda na ficha. As ideias abaixo são novas, não foram pedidas e ficam só para avaliação. A ordem considera benefício para quem joga, esforço e risco. Não inclui inglês, fichas para terras fora dos 195 nem qualquer forma de gamificação.

| Ordem | Sugestão | Por que faz sentido neste código | Decisão e custo a avaliar |
| --- | --- | --- | --- |
| 1 | Pergunta de capital entre quatro capitais, com o país no enunciado invertido | Hoje "capital → país" e "país → capital" existem, mas sempre com texto. Um formato de reconhecimento puro ajudaria quem sabe reconhecer e ainda não sabe produzir. | Não exige dado novo nem direção nova: seria uma variante de `cap`, como a silhueta é de `locate`. Esforço baixo. |
| 2 | Mostrar no mapa, ao revelar, todos os vizinhos do país da pergunta | A pergunta de fronteira já lista os vizinhos em texto. Pintá-los no mapa faria a lista virar imagem, que é como fronteira se aprende. | Só interface; `nb` já viaja no artefato. Cuidado para não poluir o mapa quando o país tem 14 vizinhos. Esforço baixo. |
| 3 | Modo "só o que está vencido" no filtro de treino | O treino de hoje já reserva seis vagas para revisões vencidas, mas quem tem 200 vencidas não consegue atacar só essa fila. | Um filtro a mais na barra, alimentado por `dueReviews`. Decidir o que fazer quando a fila esvazia no meio da sessão. Esforço médio. |
| 4 | Exportar a ficha de um país como imagem ou texto | Quem estuda costuma querer levar a ficha para fora do app. Hoje só dá para copiar à mão. | Sem dependência: `canvas` ou uma cópia estruturada para a área de transferência. Decidir o que fazer com a bandeira embutida. Esforço médio. |
| 5 | Registrar a duração real das sessões | O app mostra tempo por resposta, mas não quanto tempo de estudo se acumulou. É o número que mais motiva quem estuda com regularidade. | Exige um campo novo no progresso, o que toca validação, migração, fusão e sincronização — o mesmo cuidado que manteve `struggleFactor` derivado em vez de gravado. Esforço alto para o benefício. |

Continua pendente, como verificação e não como sugestão: a instalação efetiva da PWA em janela independente não foi exercitada porque o Chrome de teste não expõe o comando de instalação.

Merece reconferência periódica, por serem dados editoriais que envelhecem em silêncio: os idiomas oficiais (Burkina Faso, Mali, Níger) e as moedas (adesões ao euro, redenominações, dolarizações). Nenhum dos dois é resposta de pergunta, então um dado defasado erra uma linha da ficha, não a correção de um exercício.

# Estado das melhorias — 01/10/2026

O usuário autorizou as melhorias restantes e adiou instalação e disponibilidade offline.

| Melhoria | Estado |
| --- | --- |
| Integrar filtros e mapa | Implementada: destaque, enquadramento e limpeza |
| Convite para instalar | Adiado pelo usuário |
| Aviso de disponibilidade offline | Adiado pelo usuário |
| Painel de atalhos | Implementado, com instrução compartilhada com o mapa |
| Lote só de novidades e países não estudados | Implementado, com retomada e continuação |
| Listas completas de pendências e dificuldades | Implementadas com expansão e ordem explícita |
| Ordenação do Atlas | Implementada por nome, área e população |
| Comparar países | Implementado com indicadores datados e ausências explícitas |
| Link direto da ficha | Implementado, separado do fragmento de autenticação |
| Impressão da ficha | Implementada, incluindo a comparação quando aberta |
| Exportação da ficha | Implementada em texto, com notas, territórios e fontes |
| Duração das sessões | Implementada como tempo ativo de resposta; ver limites no README |
| Histórico de confusões | Implementado e incluído no backup e na conta opcional |
| Aviso de atualização no modo Foco | Corrigido |
| Atualização automática em momento seguro | Implementada após encerrar o treino e confirmar a gravação |

## Verificações externas

Login por e-mail e sincronização com contas reais, matriz de navegadores/aparelhos físicos e alto contraste real do Windows continuam sendo verificações de ambiente. As simulações automatizadas não substituem esses ensaios. Instalação da PWA fica fora do escopo atual.

## Decisões anteriores preservadas

Não propor novamente busca por código ISO, domínio por subregião no Progresso, tradução para inglês, fichas para terras fora dos 195, digitação de respostas ou gamificação.

## Manutenção dos dados

Idiomas, moedas e fronteiras exigem revisão editorial periódica. Além da checagem local de idade, `npm run audit:sources` consulta as fontes oficiais e produz relatórios de valores, anos, ausências e versões. O CI executa a auditoria no agendamento mensal existente e por disparo manual, mantendo o relatório como artefato; mudanças e falhas de consulta sinalizam atenção sem alterar o conteúdo automaticamente.

## Três melhorias adicionais — 01/10/2026

- Auditoria remota de indicadores, novas edições do IDH, bandeiras, cartografia e lista ISO 4217, com relatório Markdown e JSON em `reports/`.
- Fichas com seis links de fonte, definições, ano de referência e data de consulta; links e definições também acompanham a exportação em texto.
- Histórico de confusões com comparação direta dos dois países e treino de seis perguntas alternando o par. A habilidade registrada é priorizada quando compatível com a preferência sem visual; perguntas de localização usam o mapa. O outro país aparece nas alternativas das perguntas de escolha. A série oferece retomada e repetição.

## Checkup mobile — 01/10/2026

Implementados: navegação inferior persistente, alvos de toque maiores, seletores de 16 px, resultados do Atlas antes da ficha no celular, lista recolhível, retorno à busca e acesso ao mapa, Enter para busca com um único resultado, enunciado junto do mapa e rolagem orientada ao feedback/próxima pergunta. Cobertura de toque, arraste, pinça, retrato, paisagem e altura reduzida adicionada ao smoke test. Instalação e novos recursos offline continuam fora do escopo.

## Evolução e desempenho — 02/10/2026

Implementados resumo de acertos entre sessões por habilidade, migração preservando histórico anterior, listas e grade de domínio criadas sob demanda, benchmark com histórico cheio e CPU reduzida e expansão de testes de teclado/foco e acessibilidade em listas abertas. Validação remota da conta adiada pelo usuário. As outras sugestões (timeout de rede, proveniência editorial detalhada e nova divisão de app.js) continuam propostas, não implementadas nesta etapa.

## Clareza e procedência — 02/10/2026

Recomendação principal em Progresso e detalhes recolhíveis implementados. Explicações com capitais pareadas/sublinhadas, subregiões e duas bandeiras documentadas; módulo feedback.js extraído. Fontes editoriais por trecho e exportação implementadas; códigos de moeda cobrem 195/195 países, idiomas e capitais seguem com documentação individual parcial (audit:editorial). Roteiro humano atualizado; avaliação real com jogadores pendente.

## Continuação de 02/10/2026

Navegação e enquadramento do mapa separados em módulos próprios, com orçamentos.
Registro editorial validado no build; cobertura ampliada para trechos de idiomas
de 11 países e capitais de 10. Nota do romanche corrigida para explicitar o uso
federal. 201 testes locais passaram. Seguem pendentes a cobertura editorial
completa, a observação de jogadores reais e a separação restante dos gestos e
regras de sessão.

## Documentação dos demais países — 02/10/2026

Concluída a cobertura de referências individuais de idiomas e capitais: 195/195
em ambos os campos, com documento consolidado em docs/editorial-195.md.
O aviso de referência histórica aparece na ficha e exportação. Restam a revisão
atual de fontes exclusivamente históricas (68 países em idiomas, 92 em capitais),
a fundamentação específica de outras notas e dos nomes traduzidos de moedas.
203 testes e os cenários de navegador passaram. A documentação completa de
referências não equivale à certificação atual de todas as afirmações.

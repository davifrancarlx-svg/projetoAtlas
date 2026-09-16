# Entrega local — Atlas 195

Rodada de 16 de setembro de 2026 (segunda do dia). Estado: **testado localmente, commitado e enviado ao GitHub; não publicado no Lovable** (publicar exige pedido explícito).

## Resultado

As cinco sugestões que estavam em `IMPROVEMENTS.md` foram implementadas.

- **Pergunta de fronteira**: "qual destes faz fronteira com X?" — uma alternativa correta e três países que não fazem fronteira, escolhidos entre os mais próximos disponíveis. O veredito lista todos os vizinhos do país, que é onde a pergunta ensina. Não é direção nova: é variante de `locate`, então o progresso, a sincronização e os aparelhos com versões diferentes não mudam.
- **Silhueta no sentido inverso**: "qual destas formas é X?", quatro contornos na mesma grade das bandeiras. Só concorrem países que têm forma na escala do mapa.
- **Sorteio das três formas de localização**: apontar no mapa fica com metade; silhueta e fronteira dividem o resto e caem para o mapa quando não cabem (país sem forma, país sem vizinho).
- **Filtro do Atlas por área**: os seis baldes amplos em fila e, ao escolher um, as subregiões dele logo abaixo. Combina com a busca e some ao segundo toque no filtro ativo.
- **Retomada da revisão focada**: a fila de cartas, o placar e quantos acertos faltam para cada habilidade passam a ser guardados no mesmo rascunho das séries fechadas. Retomar continua o ciclo; descartar apaga.
- **Moeda na ficha**: 195 entradas em `src/currencies.json`, com nome em português, código ISO 4217 e nota quando o curso legal não conta a história sozinho. Entra na busca e nunca é resposta de pergunta.
- **Aba Atlas separada em `src/atlas.js`**, com orçamento próprio de 20 KiB, pelos mesmos motivos da conta: bloco coeso, crescimento próprio e `app.js` no teto.

## Arquivos por tarefa

| Tarefa | Código, testes e documentação |
| --- | --- |
| Fronteira e silhueta invertida | `src/core.js`, `src/app.js`, `src/styles.css`, `tests/core.test.cjs`, `tests/variants-browser.cjs`, `DATA_SOURCES.md`, `README.md` |
| Filtro por área | `src/atlas.js`, `src/styles.css`, `tests/variants-browser.cjs`, `README.md` |
| Retomada da revisão | `src/app.js`, `tests/resume-browser.cjs`, `README.md` |
| Moeda | `src/currencies.json`, `scripts/build.cjs`, `src/atlas.js`, `src/styles.css`, `tests/currencies.test.cjs`, `DATA_SOURCES.md`, `README.md` |
| Módulo do Atlas | `src/atlas.js`, `src/app.js`, `scripts/build.cjs`, `scripts/check-budgets.cjs`, `tests/indicators.test.cjs` |

Artefatos recriados pelo build: `atlas-195.html`, `sw.js`, `release-manifest.json`. Nenhum foi editado diretamente.

## Verificação

`npm run check` com Chrome real obrigatório: **151 testes, 0 falhas, 0 ignorados**. Os dois cenários de navegador novos (`variants-browser.cjs` e `resume-browser.cjs`) rodam dentro do smoke test.

Além dos testes, verificação manual no navegador embutido, em claro e escuro, a 1280 e a 360 pixels: silhueta entre quatro, pergunta de fronteira com o veredito listando os vizinhos, chips de área combinando com a busca, moeda na ficha e retomada da revisão depois de recarregar a página. Sem transbordamento horizontal no celular.

Orçamentos depois da rodada:

| Arquivo | Uso |
| --- | --- |
| `src/app.js` | 140,8 de 150 KiB |
| `src/core.js` | 79,3 de 88 KiB |
| `src/atlas.js` | 15,2 de 20 KiB |
| `src/account.js` | 19,5 de 24 KiB |
| `atlas-195.html` | 5056 de 5376 KiB |

O teto de `src/core.js` subiu de 80 para 88 KiB, decisão consciente registrada em `scripts/check-budgets.cjs`: as três variantes de localização são lógica pura e o núcleo não tem bloco que valha separar sem espalhar as regras do jogo por mais arquivos. O teto de `src/app.js` não subiu.

## Limites da entrega

- Nada foi publicado no Lovable. O site no ar continua duas versões atrás, ainda com conquistas.
- A pergunta de fronteira e a silhueta são visuais: quem desliga "incluir perguntas visuais" deixa de recebê-las junto com o restante da direção de localização.
- A moeda é dado editorial, com data. Adesões ao euro, redenominações e dolarizações envelhecem o arquivo em silêncio; como a moeda nunca é resposta, um dado defasado erra uma linha da ficha, não a correção de um exercício. Vale uma conferência antes de publicar.
- A retomada cobre séries fechadas e a revisão focada. O treino livre continua sem rascunho, de propósito: ele não tem fim nem placar a preservar.

# Sugestões novas — somente para avaliação

Atualizado em 16 de setembro de 2026, depois da rodada do Codex. Da lista anterior, duas foram implementadas por ele — pintar os vizinhos no mapa ao revelar e o filtro "só o que está vencido", que virou **Revisar somente pendências** — e três continuam de pé, marcadas abaixo. As demais são novas, levantadas lendo o código à procura de dados que já existem e ainda não rendem nada na tela.

Nada aqui foi pedido nem implementado. A ordem considera benefício para quem joga, esforço e risco. Não inclui inglês, fichas para terras fora dos 195 nem qualquer forma de gamificação.

| Ordem | Sugestão | Por que faz sentido neste código | Decisão e custo a avaliar |
| --- | --- | --- | --- |
| 1 | Fatos derivados de fronteira na ficha | `Core.derivedFacts` monta destaques por consequência aritmética dos dados embarcados — área, população, IDH, número de ilhas. As fronteiras entraram no artefato em `nb` e são o único dado que ele ainda ignora. Renderiam frases fortes e verdadeiras por construção: "o país com mais vizinhos do mundo, 14", "faz fronteira com um só país", "não faz fronteira com nenhum". | Só núcleo, no mesmo molde das regras existentes, com teste de extremos. Nada de curadoria: se a lista de fronteiras mudar, a frase muda junto. Esforço baixo. |
| 2 | Busca do Atlas aceitar o código do país | A busca já cobre nome, capital, região, subregião, território, idioma e moeda, mas não o código ISO. "DE" não acha a Alemanha — e o código é justamente o que aparece nos quadradinhos do mapa de domínio, de onde a pessoa vem clicando. | Uma linha em `matches()`. Conferir que duas letras não poluam o resultado por coincidência de substring. Esforço muito baixo. |
| 3 | Domínio por subregião na aba Progresso | Os selos de domínio ainda mostram só os seis baldes amplos, embora o app tenha 22 subregiões desde a rodada do M49. Quem treina "Sudeste Asiático" não consegue ver o próprio avanço nele. | Reaproveita `regionMastery` trocando o campo de agrupamento. Cuidar da quantidade de selos na tela do celular. Esforço baixo. |
| 4 | Painel de atalhos de teclado | O app é inteiramente navegável por teclado — 1 a 4 respondem, Enter e Espaço avançam, no mapa há setas, Home/End, inicial, Enter, mais, menos e zero — e nada disso está escrito em lugar nenhum fora do texto para leitor de tela. Quem usa teclado por necessidade descobre por acaso. | Um bloco recolhível na aba Progresso, alimentado por uma lista única que também vira o texto do leitor de tela, para os dois nunca divergirem. Esforço baixo. |
| 5 | Convite para instalar o app | O Atlas é uma PWA completa e nunca oferece instalação: o navegador guarda o evento `beforeinstallprompt` e o app o descarta. Falta a porta de entrada — e é por isso que "instalação efetiva da PWA" está pendente de verificação há três rodadas, sem ninguém conseguir exercitá-la. | Guardar o evento e mostrar um botão discreto na aba Progresso, que some quando o app já está instalado. Não muda o que sai do aparelho. Esforço baixo; destrava uma verificação parada. |
| 6 | Comparar dois países lado a lado no Atlas | O Codex acabou de criar os cartões de comparação para o veredito do erro. A mesma peça serviria para uma comparação escolhida pela pessoa, que é como se estuda "qual é maior" sem transformar indicador em pergunta. | Reaproveita `.comparison-card`; precisa de um segundo seletor de país e de decidir o que comparar. Esforço médio. |
| 7 | Pergunta de capital entre quatro capitais *(da lista anterior)* | "Capital → país" e "país → capital" existem, sempre com texto. Um formato de reconhecimento puro ajudaria quem já reconhece e ainda não produz. | Variante de `cap`, como a silhueta é de `locate`: sem direção nova, sem mexer no progresso. Esforço baixo. |
| 8 | Exportar a ficha de um país *(da lista anterior)* | Quem estuda quer levar a ficha para fora do app; hoje só copiando à mão. | Sem dependência: `canvas` ou cópia estruturada para a área de transferência. Decidir o que fazer com a bandeira embutida. Esforço médio. |
| 9 | Registrar a duração das sessões *(da lista anterior)* | O app mostra tempo por resposta, mas não quanto tempo de estudo se acumulou — o número que mais motiva quem estuda com regularidade. | Exige campo novo no progresso, o que toca validação, migração, fusão e sincronização. É o mesmo cuidado que manteve `struggleFactor` derivado em vez de gravado. Esforço alto para o benefício. |

## Verificações pendentes, não sugestões

A instalação efetiva da PWA em janela independente nunca foi exercitada, porque o Chrome de teste não expõe o comando de instalação e o app não oferece o convite. A sugestão 5 é o caminho para destravar isso.

O alto contraste do sistema não é reproduzível com fidelidade no Chrome sem cabeça: a emulação liga a media query mas o comportamento das cores depende de `forced-color-adjust`, e a medição só ficou confiável depois de desligar a transição de cor do mapa. A verificação atual mede cor calculada num Chrome real; uma conferência num Windows com alto contraste de verdade continua valendo.

## Dados editoriais que envelhecem em silêncio

Nenhum deles é resposta de pergunta, então um dado defasado erra uma linha da ficha, não a correção de um exercício.

- `src/languages.json`: Burkina Faso, Mali e Níger mudaram de regime linguístico entre 2023 e 2025.
- `src/currencies.json`: adesões ao euro, redenominações e dolarizações.
- `data/indicators.json`: IDH com três anos de defasagem; `npm run data:freshness` avisa.

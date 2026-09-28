# Sugestões novas — somente para avaliação

Atualizado em 16 de setembro de 2026. Da lista anterior, **os fatos derivados de
fronteira foram implementados** (`Core.derivedFacts` agora rende "um dos 39 países
sem fronteira terrestre", "um dos 17 países com um único vizinho" e "entre os
países com mais vizinhos do mundo, 14"). Duas foram **descartadas por decisão
sua** e não voltam nesta lista: a busca do Atlas aceitar o código ISO e o domínio
por subregião na aba Progresso. As marcadas *(da lista anterior)* continuam de pé;
as demais são novas, levantadas lendo o código à procura de dado embarcado que
ainda não rende nada na tela.

Em 28 de setembro de 2026 a resposta digitada saiu do app: o Atlas passou a
responder só por escolha. Com ela saíram duas sugestões que dependiam dela:
explicar o erro catalogado de quem digita "Inglaterra" e a pergunta de capital
entre quatro capitais, que é como toda pergunta de capital funciona agora.

Ainda em 28 de setembro, a pedido seu, **as três primeiras foram implementadas**:
a ficha do Atlas mostra as notas da capital, os vizinhos, idiomas e moedas
viraram links e há "Outro nome" e "Nome anterior". A lista foi renumerada.

Nada do que sobrou aqui foi pedido nem implementado. A ordem considera benefício para quem
joga, esforço e risco. Não inclui inglês, fichas para terras fora dos 195 nem
qualquer forma de gamificação.

## Antes de implementar qualquer uma

A aba Progresso saiu de `app.js` para `src/progress.js` em 28/09/2026, e o app
principal voltou a ter folga (81,8%). Quem aperta agora é `src/styles.css`, em
96,6%, e `src/core.js`, em 90,1%: uma sugestão que traga regra visual nova
provavelmente precisa antes separar um bloco do CSS. Atlas (83,9%) e Progresso
(83,7%) têm orçamento próprio e cabem as sugestões que moram neles.

| Ordem | Sugestão | Por que faz sentido neste código | Decisão e custo a avaliar |
| --- | --- | --- | --- |
| 1 | O filtro de área mexer no mapa | Clicar em "Sudeste Asiático" filtra a lista e deixa o mapa-múndi exatamente como estava. As duas metades da aba Atlas não conversam, embora o mapa já saiba enquadrar (`fitCountry`) e pintar. | Enquadrar a área e destacar seus países ao ativar o filtro. O mesmo valeria para o filtro de idioma e moeda que nasce na ficha: hoje a lista mostra os 27 países de língua francesa e o mapa não pinta nenhum. Precisa de um `fitArea` e cuidado com o alto contraste (regra nova no bloco do fim do CSS). Esforço médio. |
| 2 | Convite para instalar o app *(da lista anterior)* | O Atlas é uma PWA completa e nunca oferece instalação: o navegador guarda o evento `beforeinstallprompt` e o app o descarta. É por isso que "instalação efetiva da PWA" está pendente de verificação há três rodadas, sem ninguém conseguir exercitá-la. | Guardar o evento e mostrar um botão discreto na aba Progresso, que some quando o app já está instalado. Não muda o que sai do aparelho. Esforço baixo; destrava uma verificação parada. |
| 3 | Avisar quando o app ficou pronto para usar sem internet | O worker avisa a aba quando existe **versão nova** (`versao-nova` → `showUpdateNotice`), mas nada avisa quando o app terminou de baixar pela primeira vez. A promessa "funciona sem internet" está no texto da loja e no `<meta>`, e o app nunca a confirma — quem entra no avião não tem como saber se deu certo. | Reaproveitar o canal de mensagens que já existe entre o worker e a página. Esforço baixo. |
| 4 | Painel de atalhos de teclado *(da lista anterior)* | O app é inteiramente navegável por teclado — 1 a 4 respondem, Enter e Espaço avançam, no mapa há setas, Home/End, inicial, Enter, mais, menos e zero — e nada disso está escrito fora do texto para leitor de tela. Quem usa teclado por necessidade descobre por acaso. | Um bloco recolhível na aba Progresso, alimentado por uma lista única que também vira o texto do leitor de tela, para os dois nunca divergirem. Esforço baixo. |
| 5 | Lote só de novidades, e quantos países faltam ver | "Revisar somente pendências" provou o formato. Falta o simétrico: o treino de hoje reserva 20% para novidades, mas não existe botão para atacar só o que nunca foi visto, nem lugar que diga quantos países ainda não foram tocados — o cabeçalho conta os estudados e nunca o complemento. | Um `freshPlan` ao lado do `duePlan` que já existe em `src/study.js`, e um número no cabeçalho. Esforço baixo. |
| 6 | Ver a lista inteira de pendências e de pontos fracos | As duas listas da aba Progresso cortam em 12 (`due.slice(0, 12)`). Com 195 países e sete habilidades, quem estuda há semanas vê uma janelinha e não tem como saber o que ficou de fora nem por que aqueles doze. | Um "ver todas" que expande, com a ordem dita em palavras. Esforço baixo. |
| 7 | Ordenar a lista do Atlas | A lista sai sempre em ordem alfabética. Ordenar por área ou por população transformaria o Atlas em ferramenta de comparação sem fazer indicador virar pergunta — que é a linha que o projeto não cruza. | Um seletor de ordem em `renderList`. Decidir o que fazer com quem não tem o dado (Vaticano não tem população). Esforço baixo. |
| 8 | Comparar dois países lado a lado no Atlas *(da lista anterior)* | Os cartões de comparação do veredito do erro serviriam para uma comparação escolhida pela pessoa, que é como se estuda "qual é maior" sem transformar indicador em pergunta. | Reaproveita `.comparison-card`; precisa de um segundo seletor de país e de decidir o que comparar. Esforço médio. |
| 9 | Link direto para um país | Hoje o endereço nunca muda: o `#` só é usado pelo link mágico da conta, que o lê e o apaga. Não dá para mandar a ficha do Paraguai para alguém, nem voltar nela amanhã pelo favorito. | Um `#pais=PY` lido na abertura. Precisa conviver com o token da conta, que também mora no `#`. Esforço médio, e mexe em como o app trata o endereço — vale conferir se não vira rastro do que se estuda. |
| 10 | Folha de impressão da ficha | Não existe `@media print` no CSS. Imprimir ou salvar em PDF a ficha de um país sai com barra, botões e mapa no meio. Para quem estuda no papel, é o caminho mais curto entre o app e o caderno. | Um bloco de impressão pequeno, sem JavaScript. Esbarra no teto do `styles.css` (96,6%): provavelmente exige extrair um bloco antes. Esforço baixo, obstáculo de orçamento. |
| 11 | Exportar a ficha de um país *(da lista anterior)* | Quem estuda quer levar a ficha para fora do app; hoje só copiando à mão. | Sem dependência: `canvas` ou cópia estruturada para a área de transferência. Decidir o que fazer com a bandeira embutida. Esforço médio. Se a 10 entrar, talvez cubra parte disto. |
| 12 | Registrar a duração das sessões *(da lista anterior)* | O app mostra tempo por resposta, mas não quanto tempo de estudo se acumulou — o número que mais motiva quem estuda com regularidade. | Exige campo novo no progresso, o que toca validação, migração, fusão e sincronização. É o mesmo cuidado que manteve `struggleFactor` derivado em vez de gravado. Esforço alto para o benefício. |
| 13 | Guardar o motivo do erro, não só o erro | `confusionReason` já classifica cada erro na hora — vizinho, mesma fronteira, nome parecido, mesma região — e a classificação morre quando a tela sai. Saber que você troca Eslováquia por Eslovênia há três semanas é outro tipo de informação, e ela existiria de graça. | Mesmo custo da 12: campo novo no progresso, com migração e fusão. Além disso, guarda mais sobre quem estuda do que o app guarda hoje — decisão de privacidade, não só de código. Esforço alto. |

## Verificações pendentes, não sugestões

A instalação efetiva da PWA em janela independente nunca foi exercitada, porque o
Chrome de teste não expõe o comando de instalação e o app não oferece o convite.
A sugestão 2 é o caminho para destravar isso.

O alto contraste do sistema está corrigido e medido num Chrome real com a media
query emulada, e um teste em `tests/theme.test.cjs` recolhe os destaques do mapa
direto do `app.js`, de modo que um destaque novo sem regra de alto contraste
quebra a suíte. Ainda assim, uma conferência num Windows com alto contraste de
verdade continua valendo: a emulação liga a media query, mas quem troca a paleta
no fim é o sistema operacional.

## Dados editoriais que envelhecem em silêncio

Nenhum deles é resposta de pergunta, então um dado defasado erra uma linha da
ficha, não a correção de um exercício.

- `src/languages.json`: Burkina Faso, Mali e Níger mudaram de regime linguístico entre 2023 e 2025.
- `src/currencies.json`: adesões ao euro, redenominações e dolarizações.
- `src/borders.json`: 313 pares escritos à mão. Agora eles também alimentam os fatos da ficha, então um par a mais ou a menos muda a frase de quem está no topo — o teste em `tests/indicators.test.cjs` confere a contagem, mas não confere a geografia.
- `data/indicators.json`: IDH com três anos de defasagem; `npm run data:freshness` avisa.

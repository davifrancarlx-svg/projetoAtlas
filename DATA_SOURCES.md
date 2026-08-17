# Fontes e política editorial

## Geometria do mapa

- Fonte: Natural Earth, Admin 0 — Countries, escala 1:10m.
- Complemento: Natural Earth Minor Islands 1:10m quando aplicável.
- Datum de origem: WGS84.
- Projeção de exibição: Robinson.
- Licença: domínio público.
- Convenção: fronteiras de facto do dataset global padrão. Linhas disputadas devem ser apresentadas como convenção cartográfica, não como afirmação política definitiva.

A saída contém 195 países interativos (6.222 componentes, dos quais 2.596 vêm da camada de ilhas menores) e uma camada contextual neutra com as outras 63 feições Admin-0. Juntas, elas preservam 7.045 polígonos e 7.064 anéis. A camada contextual não recebe IDs, foco ou elegibilidade para perguntas.

Cada país também carrega `pb`, os limites do aglomerado principal: o componente que contém o ponto de rótulo do Natural Earth, mais todo componente a menos de seis unidades projetadas do aglomerado, repetidamente. É o retângulo usado para enquadrar o país sem que um território a um oceano de distância force a visão do mundo inteiro — 29 dos 195 países têm componentes fora desse aglomerado. O gerador valida que `pb` cabe dentro de `b` e contém o ponto de rótulo.

O script de atualização registra a versão e a URL exatas no próprio arquivo de geometria. O produto exibe essa procedência na interface.

## Países e capitais

O conteúdo anterior foi preservado como base e passa por validações automáticas de IDs, aliases e colisões de resposta. Sedes administrativas e nomes coloquiais não devem ser tratados como sinônimos da capital ou do país; devem aparecer apenas em notas explicativas.

Decisões editoriais sensíveis são explícitas em `src/content-policy.json`. Entre elas estão a capital da Guiné Equatorial conforme o Decreto-Lei 1/2026, a classificação M49 do Chipre na Ásia Ocidental e a distinção entre capitais, sedes de governo e nomes históricos.

### Região (`r`) e subregião (`sr`)

Todo país carrega dois rótulos geográficos. `r` é o balde amplo usado pelo filtro de região e pelo modo "país → região" — inclui, por exemplo, "América do Norte, Central e Caribe" como uma única opção de resposta, para não cobrar ortografia de topônimo em vez de geografia. `sr` é a subregião real do país e é o que aparece na ficha do Atlas, no resultado da pergunta e na busca: dentro desse mesmo balde, Canadá e Estados Unidos são "América do Norte", os oito países istmicos são "América Central" e os 13 insulares e Guiana são "Caribe" — a classificação segue o geoscheme M49 da ONU, coerente com a decisão já tomada para o Chipre. Fora desse balde, `sr` é sempre igual a `r`: os demais continentes não têm hoje uma subdivisão exibida. Uma correção editorial de `r` em `content-policy.json` (como a do Chipre) vale também para `sr`, para as duas etiquetas nunca se contradizerem. O build recusa qualquer país ou território sem `sr` preenchido.

## Territórios dentro de um soberano

Vários territórios chegam do Natural Earth dentro do polígono do país a que pertencem: a Guiana Francesa é parte do polígono Admin-0 da França porque é um departamento ultramarino francês, o Alasca é um estado dos Estados Unidos e as Canárias são uma comunidade autônoma espanhola. Chamar essas áreas apenas de "França", "Estados Unidos" ou "Espanha" no mapa esconde uma capital regional, uma região e uma história próprias.

`src/territories.json` registra 16 casos com nome, capital regional, região, área, natureza jurídica, um box geográfico em graus, um ponto de rótulo e notas explicativas:

| Soberano | Territórios |
| --- | --- |
| França | Guiana Francesa, Guadalupe, Martinica, Reunião, Mayotte |
| Estados Unidos | Alasca, Havaí |
| Portugal | Açores, Madeira |
| Países Baixos | Bonaire, Saba, Santo Eustáquio |
| Espanha | Ilhas Canárias |
| Equador | Galápagos |
| Chile | Ilha de Páscoa |
| Noruega | Svalbard |

Eles **não** entram no sorteio de perguntas, não recebem bandeira própria e não alteram a resposta esperada: a resposta da França continua sendo Paris, e clicar na Guiana Francesa continua valendo como França. O registro serve para o mapa dizer o que está sob o cursor (`Guiana Francesa (França)`), para o Atlas exibir a ficha do território com um botão que o enquadra, e para a busca encontrar quem procura por "Guiana Francesa", "Caiena" ou "Longyearbyen".

O box é área de captação do cursor, não contorno: ele é consultado apenas **depois** que a geometria sob o ponteiro já resolveu o soberano, então um vizinho dentro do retângulo é inofensivo — clicar na Grande Diomedes continua respondendo Rússia, mesmo estando dentro do box do Alasca. O que os testes proíbem é um box engolir o ponto de rótulo ou o aglomerado principal do próprio soberano.

## Bandeiras

- Fonte: [flag-icons](https://github.com/lipis/flag-icons), versão 7.5.0, SVG 4:3.
- Licença da coleção: MIT, copyright (c) 2013 Panayiotis Lipiridis.
- Cobertura: 195/195 IDs ISO 3166-1 alfa-2 presentes no Atlas.
- Distribuição: URIs `data:image/svg+xml;base64` incorporadas ao HTML, sem requisições externas.

O pacote de origem, os hashes, a licença integral, o procedimento reproduzível e
a ressalva sobre regras locais aplicáveis a símbolos nacionais estão registrados
em [`data/flag-icons/README.md`](data/flag-icons/README.md). O gerador
`scripts/update-flags.cjs` fixa e valida todos esses dados antes de produzir
`data/flags.json`.

## Tipografia

As três famílias do Atlas são embutidas no artefato em base64, no subset latino
(`U+0000-00FF`), que é o suficiente para o português. Sem isso o CSS pediria
famílias que quase ninguém tem instaladas e o navegador cairia em Georgia e
system-ui — o desenho existiria só no código.

| Família | Uso | Faces |
| --- | --- | --- |
| Instrument Serif | títulos e nomes de país | regular e itálico |
| IBM Plex Sans | texto corrente | variável, 100–700 |
| IBM Plex Mono | rótulos, placar e coordenadas | 400 e 500 |

Ambas estão sob a **SIL Open Font License 1.1**, que exige distribuir a licença
junto da fonte: os dois textos viajam dentro do próprio `atlas-195.html`.
`data/fonts/fonts.json` registra a URL de origem e o SHA-256 de cada arquivo, e
o build recusa qualquer face que não confira com o hash registrado.

São 118 KB de fonte para 5 MB de artefato, e nenhuma requisição de rede: a CSP
autoriza `font-src data:` e nenhuma origem externa.

### Precisão das coordenadas

As coordenadas projetadas usam **duas casas decimais**. O `viewBox` tem 1018
unidades de largura e o zoom máximo é 60×, o que dá cerca de 0,014 unidade por
pixel: o arredondamento desloca um vértice em no máximo 0,005 unidade, ou
**0,35 pixel na ampliação máxima** — abaixo de um pixel em qualquer situação de
uso. Em troca, a geometria comprimida cai de 1.094 KB para 830 KB em gzip, que é
o que o navegador realmente baixa.

Os limites (`b` e `pb`) são medidos na geometria de origem **unida aos anéis
efetivamente emitidos**. A distinção importa para os micro-países: quando o anel
degenera na quantização, o gerador o substitui por um símbolo sintético criado
depois da medição, e sem essa união o Vaticano ficaria com um retângulo de
largura zero — desenhado na tela, mas invisível para o enquadramento.

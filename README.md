# Atlas 195

Aplicação educacional offline para praticar bandeiras, capitais e localização de 193 Estados-membros da ONU, da Santa Sé e do Estado da Palestina.

O treino combina sete direções independentes (bandeira ↔ país, capital ↔ país, mapa ↔ país e país → região), escolha ou digitação, tempo por pergunta opcional, revisão espaçada e reforço das habilidades mais fracas. O Atlas é navegável por teclado, aceita pular questões visuais sem penalidade e mantém o progresso somente no dispositivo.

## Treino

- **Modos**: misto, bandeiras, capitais, localização e regiões. A área de estudo vai do mundo inteiro a um continente ou a uma subregião — América do Norte, América Central e Caribe aparecem indentadas sob o balde que o modo região cobra. A direção país → região é sempre por escolha — digitar "América do Norte, Central e Caribe" cobraria grafia, não geografia —, e escolher esse modo com a resposta em "Digitar" mantém o assunto em vez de trocar o treino.
- **Tempo**: livre, 30 s ou 15 s por pergunta. A barra fica vermelha nos últimos cinco segundos e o estouro entra como erro pelo mesmo caminho de uma resposta errada, sem tratamento especial no progresso.
- **Prova**: séries fechadas de 10, 20 ou 30 perguntas, iniciadas na aba Progresso, com nota, tempo médio e a lista de erros no fim. Respeita o modo e a área de estudo selecionados, e os erros alimentam o mesmo baralho de revisão.
- **Baralho de erros**: a aba Progresso resume a sessão (perguntas, precisão, tempo médio, estouros) e enfileira os erros ainda não corrigidos numa sequência de revisão. Uma habilidade acertada depois sai do baralho.
- **Backup**: exportar gera um arquivo com o envelope validado do progresso; importar funde com o que já existe no aparelho, sem apagar nada. O arquivo é o mesmo formato lido pelo `AtlasCore`, então um progresso corrompido é recusado sem efeito colateral.
- **Tema**: o botão na barra do topo cicla automático → claro → escuro. Automático é o padrão e segue o sistema; escolher claro ou escuro fixa a paleta mesmo que o sistema diga o contrário, e a escolha fica salva com as demais preferências. Um script no `<head>` aplica o tema salvo antes da primeira pintura, para a página não nascer com a paleta errada e piscar.

## Desenvolvimento

Requer Node.js 18 ou superior. O código-fonte vive em `src/`; `atlas-195.html` é um artefato autocontido gerado.

```sh
npm test
npm run build
npm run serve
```

Abra `http://127.0.0.1:8743/atlas-195.html`.

## Estrutura

- `src/index.template.html`: estrutura semântica da interface.
- `src/styles.css`: identidade visual e responsividade.
- `src/core.js`: regras puras, validação, revisão adaptativa e a geometria de exibição (projeção Robinson, zoom, enquadramento e resolução de território).
- `src/app.js`: mapa, controles e renderização. Não guarda cópia própria dessas regras: consome o núcleo, que é testado sem DOM.
- `src/theme-boot.js`: aplica o tema salvo antes da primeira pintura. Só isso — a lógica de tema mora em `app.js`.
- `src/countries.base.json`: conteúdo educacional e bandeiras.
- `src/territories.json`: territórios que a cartografia entrega dentro de outro país, com rótulo, capital regional e notas.
- `data/map-geometry.json`: geometria projetada gerada a partir do Natural Earth.
- `data/flags.json`: bandeiras SVG 4:3 geradas do flag-icons, com licença documentada.
- `scripts/`: build, servidor local e atualização cartográfica.
- `tests/`: invariantes do núcleo, conteúdo e mapa.

`npm run check` executa todos os testes e recria o HTML final. Os dados fixados também podem ser auditados com `node scripts/update-map.cjs --check` e `node scripts/update-flags.cjs --check` (o segundo baixa o arquivo de origem fixado para comparar os hashes).

## Dados cartográficos

Os contornos usam Natural Earth 1:10m, uma base cartográfica pública. A camada interativa preserva 6.222 componentes dos 195 países, incluindo 2.596 ilhas menores; outras 63 feições Admin-0 completam, de forma neutra e não interativa, a Groenlândia, a Antártida, dependências e áreas disputadas. O enquadramento Robinson contém o mundo inteiro e os alvos ampliados são calculados a partir de componentes territoriais reais, sem substituir a geometria visível.

A projeção Robinson preserva a leitura global, mas, como toda projeção plana, distorce áreas e distâncias. Fronteiras disputadas seguem a convenção de facto da versão registrada em `DATA_SOURCES.md`.

O zoom vai de 1× a 60× e é ancorado no ponto apontado: nos dois extremos a janela para de mudar em vez de deslizar, e os botões `+` e `−` desabilitam quando o limite é alcançado.

Cada país guarda também os limites do seu **aglomerado principal** (`pb`): o componente que contém o ponto de rótulo mais tudo que estiver a menos de seis unidades projetadas dele. É esse retângulo que o Atlas enquadra. O bounding box completo abria o mundo inteiro em 29 países — o dos Estados Unidos vai de Guam a Porto Rico, o da França vai do Caribe ao Índico —, enquanto o aglomerado mantém arquipélagos inteiros (as duas ilhas da Nova Zelândia, a Indonésia) e deixa de fora o que está a um oceano de distância.

Vaticano, Mônaco, Tuvalu, Nauru e San Marino ocupam frações de pixel nessa escala mesmo no zoom máximo; a partir de 6× eles recebem um anel de tamanho fixo em pixels, que não intercepta o ponteiro — a resolução de cliques continua sendo a geometria real mais as âncoras de toque.

Territórios que chegam dentro do polígono de outro país, como a Guiana Francesa, o Alasca ou as Canárias, são identificados pelo nome próprio no mapa e ganham ficha no Atlas, sem virar resposta de pergunta — ver `DATA_SOURCES.md`.

As bandeiras usam a coleção flag-icons 7.5.0 sob licença MIT. O progresso possui validação, migração, revisão independente por habilidade e sincronização segura entre abas, inclusive após um reset.

## O que sai do aparelho

**Sem conta, nada sai.** Sem entrar, o Atlas não faz nenhuma requisição de rede — nem para o backend, nem para qualquer outro lugar. É verificável: a política de segurança do artefato autoriza exatamente uma origem em `connect-src`, a do backend de contas, e nada dispara pedido sem sessão iniciada. Todo o resto (mapa, bandeiras, fontes) vem embutido no próprio arquivo.

**Com conta, saem duas coisas:** o e-mail usado para entrar e o seu progresso — países, níveis, datas de revisão e recorde. Isso é derivado das suas respostas. Não há anúncio, rastreio, analytics nem terceiro envolvido; a conta existe só para levar o progresso a outro aparelho.

A conta é sempre opcional e nunca aparece na frente de quem quer treinar: ela vive num cartão da aba Progresso. Aberto direto do disco, o cartão nem existe. O aparelho continua sendo o dono do progresso — a conta é uma cópia que sincroniza, e o que decide conflito é o mesmo `Core.mergeProgress` que já reconcilia duas abas abertas, fundindo os dois lados em vez de escolher um. Se a rede cair ou o serviço sair do ar, aparece um aviso discreto e o treino continua igual.

O backup por arquivo continua existindo para quem prefere não criar conta nenhuma.

O servidor local negocia `Accept-Encoding` e responde comprimido: os 4,9 MB do artefato viram cerca de 1,6 MB na primeira resposta e 1,1 MB nas seguintes, quando o brotli de qualidade máxima termina em segundo plano e substitui o cache. Nenhuma dependência é usada para isso.

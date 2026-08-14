# Atlas 195

Aplicação educacional offline para praticar bandeiras, capitais e localização de 193 Estados-membros da ONU, da Santa Sé e do Estado da Palestina.

O treino combina seis direções independentes (bandeira ↔ país, capital ↔ país e mapa ↔ país), escolha ou digitação, revisão espaçada e reforço das habilidades mais fracas. O Atlas é navegável por teclado, aceita pular questões visuais sem penalidade e mantém o progresso somente no dispositivo.

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
- `src/core.js`: regras puras, validação e revisão adaptativa.
- `src/app.js`: mapa, controles e renderização.
- `src/countries.base.json`: conteúdo educacional e bandeiras.
- `data/map-geometry.json`: geometria projetada gerada a partir do Natural Earth.
- `data/flags.json`: bandeiras SVG 4:3 geradas do flag-icons, com licença documentada.
- `scripts/`: build, servidor local e atualização cartográfica.
- `tests/`: invariantes do núcleo, conteúdo e mapa.

`npm run check` executa todos os testes e recria o HTML final. Os dados fixados também podem ser auditados com `node scripts/update-map.cjs --check` e `node scripts/update-flags.cjs --check` (o segundo baixa o arquivo de origem fixado para comparar os hashes).

## Dados cartográficos

Os contornos usam Natural Earth 1:10m, uma base cartográfica pública. A camada interativa preserva 6.222 componentes dos 195 países, incluindo 2.596 ilhas menores; outras 63 feições Admin-0 completam, de forma neutra e não interativa, a Groenlândia, a Antártida, dependências e áreas disputadas. O enquadramento Robinson contém o mundo inteiro e os alvos ampliados são calculados a partir de componentes territoriais reais, sem substituir a geometria visível.

A projeção Robinson preserva a leitura global, mas, como toda projeção plana, distorce áreas e distâncias. Fronteiras disputadas seguem a convenção de facto da versão registrada em `DATA_SOURCES.md`.

As bandeiras usam a coleção flag-icons 7.5.0 sob licença MIT. O progresso possui validação, migração, revisão independente por habilidade e sincronização segura entre abas, inclusive após um reset. A aplicação não envia respostas ou dados pessoais para servidores.

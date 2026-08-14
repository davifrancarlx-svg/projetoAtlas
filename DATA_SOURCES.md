# Fontes e política editorial

## Geometria do mapa

- Fonte: Natural Earth, Admin 0 — Countries, escala 1:10m.
- Complemento: Natural Earth Minor Islands 1:10m quando aplicável.
- Datum de origem: WGS84.
- Projeção de exibição: Robinson.
- Licença: domínio público.
- Convenção: fronteiras de facto do dataset global padrão. Linhas disputadas devem ser apresentadas como convenção cartográfica, não como afirmação política definitiva.

A saída contém 195 países interativos (6.222 componentes, dos quais 2.596 vêm da camada de ilhas menores) e uma camada contextual neutra com as outras 63 feições Admin-0. Juntas, elas preservam 7.045 polígonos e 7.064 anéis. A camada contextual não recebe IDs, foco ou elegibilidade para perguntas.

O script de atualização registra a versão e a URL exatas no próprio arquivo de geometria. O produto exibe essa procedência na interface.

## Países e capitais

O conteúdo anterior foi preservado como base e passa por validações automáticas de IDs, aliases e colisões de resposta. Sedes administrativas e nomes coloquiais não devem ser tratados como sinônimos da capital ou do país; devem aparecer apenas em notas explicativas.

Decisões editoriais sensíveis são explícitas em `src/content-policy.json`. Entre elas estão a capital da Guiné Equatorial conforme o Decreto-Lei 1/2026, a classificação M49 do Chipre na Ásia Ocidental e a distinção entre capitais, sedes de governo e nomes históricos.

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

# Bandeiras do Atlas 195

As bandeiras autocontidas em `../flags.json` são derivadas de
[flag-icons](https://github.com/lipis/flag-icons), versão **7.5.0**, no formato
SVG 4:3. O projeto distribui a coleção sob a licença **MIT**; uma cópia integral
da licença da versão fixada está em [LICENSE](LICENSE).

## Procedência reproduzível

- Release: <https://github.com/lipis/flag-icons/releases/tag/v7.5.0>
- Pacote oficial: <https://registry.npmjs.org/flag-icons/-/flag-icons-7.5.0.tgz>
- SHA-256 do pacote: `c0b80bf0e08006a60f56621d6bc49f8c7131f4d1fef6737a165a673431f4b518`
- SHA-256 do conteúdo canônico dos 195 SVGs: `07442d17336c7cf44e25366f09d949ebc0a00c78674181c13d055f5a6ce788d7`
- SHA-256 de `data/flags.json`: `66c223b6167101fdda8d6c7d595a4ddca14717d4c48d00bff5ae4f3c1f322149`
- Cobertura validada: **195/195** IDs ISO 3166-1 alfa-2 usados pelo Atlas.

O arquivo derivado é determinístico: não contém data de geração. Cada valor de
`flags` já é uma URI `data:image/svg+xml;base64,...`, própria para um HTML sem
dependências de rede.

## Atualização e auditoria

O gerador usa somente módulos nativos do Node.js e verifica o hash do pacote,
os checksums do TAR, nome/versão/licença do pacote, cobertura dos IDs e uma
política conservadora contra conteúdo SVG ativo ou externo.

```powershell
node scripts/update-flags.cjs
node scripts/update-flags.cjs --archive C:\caminho\flag-icons-7.5.0.tgz --check
```

Uma atualização de versão deve ser deliberada: revise as mudanças upstream e
atualize conjuntamente a versão, a URL, o hash fixado e estes registros.

## Integração

Durante o build, leia `data/flags.json` e substitua o campo de bandeira de cada
país pelo valor `flags[country.id]`. O renderizador deve aceitar diretamente a
URI `data:` armazenada, sem prefixar `data:image/png;base64,`. A validação do
build deve falhar se qualquer um dos 195 IDs estiver ausente.

## Observação jurídica

A licença MIT documenta a redistribuição desta coleção. Bandeiras são também
símbolos nacionais e podem estar sujeitas a leis específicas de uso, respeito,
marca ou representação em certas jurisdições, independentemente de direitos
autorais. Este registro de procedência não substitui análise jurídica para usos
sensíveis.


# Validação ampliada

As dependências desta pasta são exclusivas de desenvolvimento e não entram no
HTML publicado. As versões e o lockfile estão fixados.

```sh
npm ci --prefix qa --ignore-scripts
npm --prefix qa run test:database
npx --prefix qa playwright install --with-deps firefox webkit
npm run build
npm --prefix qa run test:browsers
npm --prefix qa run test:performance
```

`database.cjs` usa [PGlite](https://pglite.dev/docs/), PostgreSQL em WASM,
com banco em memória. Cria apenas substitutos locais de `auth.users`,
`auth.uid()` e dos papéis do Supabase; aplica duas vezes as migrações reais e
confere RLS, permissões, limites e bloqueio de regressão de versão. Não usa
credenciais, URL ou dados do backend remoto. Não valida autenticação por e-mail,
JWT, PostgREST ou implantação no Supabase.

`browsers.cjs` abre o artefato servido em loopback em perfis descartáveis de
Firefox e WebKit, com larguras de 1280 e 360 px, dois temas e três abas.
Verifica resposta/avanço, busca/seleção, foco móvel, transbordamento, erros JS e
regras WCAG A/AA do axe-core. O relatório completo, incluindo verificações
inconclusivas que exigem avaliação humana, fica em `reports/compatibility/`.

[Os navegadores de teste do Playwright](https://playwright.dev/docs/browsers)
não substituem a validação em Safari/iPhone e Android físicos. Firefox recebe
viewport estreito e toque; WebKit também recebe emulação móvel. Teclado virtual,
VoiceOver/TalkBack e usabilidade real continuam exigindo aparelhos e pessoas.

No Windows, omita `--with-deps` na instalação dos navegadores. Para usar um
diretório temporário, defina `PLAYWRIGHT_BROWSERS_PATH` antes de instalar e testar.

`performance.cjs` requer Google Chrome instalado. Usa perfil descartável, CPU
reduzida quatro vezes, viewport 360×640 e histórico fictício com 1.000 respostas,
200 sessões e 1.000 confusões. Registra carregamento e cinco aberturas de Progresso,
confere ausência de listas recolhidas no DOM e testa expansão e seleção pelo teclado.
O relatório fica em `reports/performance.json`; não equivale a INP nem a desempenho
medido num celular físico. Os testes de acessibilidade também cobrem a grade aberta.

O benchmark também registra heap JavaScript e intervalos de quadros durante 30 movimentos de arraste do mapa. Heap não representa toda a memória do navegador; os quadros medidos variam conforme a carga do computador.

`npm --prefix qa run test:guidance` usa Chrome instalado, perfis descartáveis e cliques reais em 360/1280 px para verificar recomendação, erro de capital e fontes da ficha. Capturas em reports/guidance/. O cenário também foi acrescentado ao CI, cuja execução remota ainda depende de enviar as alterações.

O cenário guidance também confere o aviso de arquivo histórico e o conteúdo UTF-8 baixado pela exportação de ficha, nas duas larguras.

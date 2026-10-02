# Backend da conta opcional

`migrations/` registra a tabela e as políticas RLS das quais depende a promessa
de privacidade do Atlas. As migrações podem ser aplicadas em ordem pelo painel SQL
ou pela CLI do Supabase no projeto indicado em `src/cloud.json`; todas podem ser
reaplicadas sem efeito colateral.

Depois de aplicar, confirme com dois usuários de teste que cada um consegue criar,
ler, atualizar e excluir apenas a própria linha. Uma requisição com a chave `anon`
sem sessão deve ser recusada por falta de permissão, nunca respondida com dados.

As duas migrações estão aplicadas no projeto do Lovable desde 28/09/2026. A
conferência foi feita trocando de papel dentro de um bloco que termina em erro,
para nada ficar gravado: a dona lê e grava a própria linha, outra conta não lê
nem grava a linha alheia, o `anon` recebe permissão negada, nenhum dos dois
papéis tem `TRUNCATE`, e os dois limites do envelope recusam lista e excesso de
2 MB.

Não coloque chaves `service_role`, senhas ou tokens neste repositório. A única
chave versionada é a chave pública declarada em `src/cloud.json`.

## Proteção entre versões — esquema 3

Antes de publicar o cliente com histórico de estudo, aplique
`202610010001_impede_regressao_esquema.sql`. O trigger permite atualizar uma
linha v2 para v3, mas rejeita uma tentativa de rebaixá-la para v2. Isso evita
que um cliente antigo, incapaz de ler o novo histórico, o sobrescreva.
Não muda RLS nem permissões de leitura. A migração é reaplicável e foi
preparada localmente em 01/10/2026; ainda não foi aplicada ao projeto remoto.

Valide em um banco de teste: criar v2, atualizar para v3, recusar v3 → v2 e
aceitar v3 → v3; depois reverta os registros de teste. Os testes locais de
conta verificam que envelopes remotos futuros ou inválidos não provocam
envio de um progresso substituto.

O cliente atual usa esquema 4 para acertos por habilidade em cada sessão e migra
v3 preservando todo o histórico anterior. O mesmo trigger compara números e
também bloqueia v4 → v3, sem necessidade de outra migração. Essa proteção foi
verificada no banco local descartável; a implantação remota segue pendente.

## Verificação de 02/10/2026

Não foi localizada uma configuração separada de teste nem acesso administrativo
ao projeto nesta sessão. O backend configurado respondeu HTTP 200 em
`/auth/v1/settings` e HTTP 401 a uma consulta anônima com `limit=0` na tabela de
progresso. Não foram consultadas linhas de jogadores, criadas contas ou aplicadas
migrações remotamente. Isso não confirma a existência de duas contas de teste.

`npm --prefix qa run test:database` executa as migrações duas vezes em PostgreSQL
WASM descartável, com 19 verificações de permissões, isolamento, limites e versões.
Requer antes `npm ci --prefix qa --ignore-scripts`. Os substitutos locais de
identidade não validam JWT, e-mail ou a configuração ativa do Supabase. Consulte
`qa/README.md` e `docs/validacao-com-jogadores.md` para reprodução e teste remoto.

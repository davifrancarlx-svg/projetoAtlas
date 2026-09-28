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

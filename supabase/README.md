# Backend da conta opcional

`migrations/` registra a tabela e as políticas RLS das quais depende a promessa
de privacidade do Atlas. A migração pode ser aplicada pelo painel SQL ou pela CLI
do Supabase no projeto indicado em `src/cloud.json`.

Depois de aplicar, confirme com dois usuários de teste que cada um consegue criar,
ler, atualizar e excluir apenas a própria linha. Uma requisição com a chave `anon`
sem sessão deve receber uma lista vazia e nunca dados de outro usuário.

Não coloque chaves `service_role`, senhas ou tokens neste repositório. A única
chave versionada é a chave pública declarada em `src/cloud.json`.

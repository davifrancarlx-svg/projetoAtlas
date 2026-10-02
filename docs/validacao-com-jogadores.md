# Roteiro de validação com jogadores

Preparado em 02/10/2026. Nenhuma sessão com participantes foi realizada nesta
etapa; este arquivo é o roteiro, não um relatório de resultados.

## Sessão de 15–20 minutos

Convide de três a cinco pessoas que ainda não conhecem o Atlas, incluindo alguém
que use recursos de acessibilidade. Use os próprios aparelhos quando possível.
Explique que estamos avaliando o site, que podem parar a qualquer momento e que
não precisam fornecer e-mail ou entrar em conta. Não grave sem consentimento.

Peça que realizem estas tarefas, sem indicar os botões:

1. Começar um treino de capitais e responder cinco perguntas.
2. Entender um erro e encontrar como estudar aquele país.
3. Procurar Portugal no Atlas, consultar uma fonte e voltar à busca.
4. Mostrar um país no mapa, ampliar o mapa e voltar ao treino.
5. Descobrir o que precisa revisar e como retomar amanhã.

Na versão atual, acrescentar duas observações: a pessoa encontra e entende a
recomendação em Progresso? Depois de confundir duas capitais ou bandeiras,
consegue explicar com as próprias palavras o que distingue as duas respostas?
Não induzir uma resposta errada: registrar erros naturais ou mostrar um exemplo
preparado, identificando-o como tal. Na consulta de fontes, perguntar qual trecho
a fonte comprova e o que significa a data de conferência.

Depois de cada tarefa, pergunte o que esperavam que acontecesse. Anote sucesso
sem ajuda, ajuda necessária, tempo aproximado e pontos de hesitação. Não converta
uma amostra pequena em estimativa estatística de todos os usuários.

| Aparelho/navegador | Tarefa | Concluiu sem ajuda? | Obstáculo observado | Gravidade | Possível ajuste |
| --- | --- | --- | --- | --- | --- |
| A preencher | | | | | |

Priorize obstáculos que impedem concluir uma tarefa, depois os recorrentes.
Só acrescente uma introdução se a dificuldade inicial for observada; se necessária,
deve ser curta, dispensável e reapresentável pela ajuda.

## Aparelhos e acessibilidade

Em Safari/iPhone e Chrome/Android: abrir e fechar o teclado na busca e no e-mail;
girar o aparelho; ampliar texto; verificar controles acima do teclado; usar zoom e
arraste do mapa sem registrar respostas. Com VoiceOver/TalkBack: percorrer abas,
ouvir enunciado e resultado, responder, avançar, pesquisar e retornar à lista.
Registrar anúncio duplicado, falta de nome, foco perdido ou ordem confusa.

## Contas reais — apenas no ambiente de teste confirmado

O código aponta para um único backend. Em 02/10/2026, uma consulta pública de
configuração de autenticação retornou HTTP 200 e a consulta anônima de progresso
com `limit=0` retornou HTTP 401. Não foi encontrado acesso administrativo nem
configuração separada que permita confirmar contas de teste. A existência dessas
contas e a aplicação remota da terceira migração continuam sem confirmação.

Ao obter acesso ao painel Supabase/Lovable, identificar primeiro o projeto de
teste. Usar duas contas próprias de teste e dois perfis de navegador separados;
nunca inserir senhas, tokens ou links de autenticação em relatórios ou no Git.

1. Entrar na conta A nos dois perfis. Estudar países diferentes e sincronizar;
   confirmar que ambos os progressos e históricos sobrevivem nos dois lados.
2. Entrar na conta B em outro perfil; verificar que não recebe o progresso de A.
   O mesmo aparelho conserva seu progresso local ao sair: isso é comportamento
   documentado do produto e não um teste de isolamento entre contas.
3. Com sessão expirada, sincronizar e salvar apelido; observar renovação única.
4. Interromper a rede durante a sincronização; voltar à rede e tentar novamente.
5. Sair enquanto há pedido pendente; confirmar que não ocorre reconexão tardia.
6. Aplicar as migrações em ordem no ambiente de teste e conferir proteção v3→v2.
   Validar depois a implantação no projeto de produção antes de publicar o cliente.

Os testes locais usam usuários fictícios e rede simulada. Eles não comprovam
entrega de e-mails, configuração de redirecionamento ou políticas ativas no remoto.

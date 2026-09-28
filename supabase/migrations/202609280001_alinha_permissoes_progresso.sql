-- Alinha o projeto Lovable existente à migração 202608200001.
--
-- Conferido em 28/09/2026: o banco no ar tinha RLS ligado, mas não tinha o
-- FORCE nem os dois limites do envelope, e as quatro políticas eram outras, com
-- nomes próprios e valendo para o papel public. Elas restringiam a linha do
-- mesmo jeito (auth.uid() = usuario), mas anon e authenticated mantinham todos
-- os privilégios padrão da tabela, TRUNCATE incluído, e TRUNCATE não passa por
-- política de linha. A 202608200001 já revogava o anon; esta remove as
-- políticas antigas e deixa o authenticated só com as quatro operações que o
-- app usa.
--
-- Idempotente: num backend novo os drops não acham nada e o resto repete o
-- estado que a 202608200001 já deixou.

drop policy if exists "le o proprio progresso" on public.progresso_atlas;
drop policy if exists "cria o proprio progresso" on public.progresso_atlas;
drop policy if exists "atualiza o proprio progresso" on public.progresso_atlas;
drop policy if exists "apaga o proprio progresso" on public.progresso_atlas;

revoke all on table public.progresso_atlas from anon;
revoke all on table public.progresso_atlas from authenticated;
grant select, insert, update, delete on table public.progresso_atlas to authenticated;

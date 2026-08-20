-- Infraestrutura reproduzível da conta opcional do Atlas 195.
-- A chave pública embarcada no app só pode operar sobre a linha do usuário
-- autenticado; estas políticas são a barreira que sustenta essa promessa.

create table if not exists public.progresso_atlas (
  usuario uuid primary key references auth.users (id) on delete cascade,
  envelope jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- `create table if not exists` não acrescenta constraints numa tabela já
-- provisionada. Os blocos abaixo tornam a migração segura tanto num backend
-- novo quanto no projeto Lovable existente.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'progresso_atlas_envelope_objeto'
      and conrelid = 'public.progresso_atlas'::regclass
  ) then
    alter table public.progresso_atlas
      add constraint progresso_atlas_envelope_objeto check (jsonb_typeof(envelope) = 'object');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'progresso_atlas_envelope_limite'
      and conrelid = 'public.progresso_atlas'::regclass
  ) then
    alter table public.progresso_atlas
      add constraint progresso_atlas_envelope_limite check (octet_length(envelope::text) <= 2097152);
  end if;
end $$;

alter table public.progresso_atlas enable row level security;
alter table public.progresso_atlas force row level security;

drop policy if exists "atlas_ler_proprio_progresso" on public.progresso_atlas;
drop policy if exists "atlas_criar_proprio_progresso" on public.progresso_atlas;
drop policy if exists "atlas_atualizar_proprio_progresso" on public.progresso_atlas;
drop policy if exists "atlas_excluir_proprio_progresso" on public.progresso_atlas;

create policy "atlas_ler_proprio_progresso"
  on public.progresso_atlas for select
  to authenticated
  using ((select auth.uid()) = usuario);

create policy "atlas_criar_proprio_progresso"
  on public.progresso_atlas for insert
  to authenticated
  with check ((select auth.uid()) = usuario);

create policy "atlas_atualizar_proprio_progresso"
  on public.progresso_atlas for update
  to authenticated
  using ((select auth.uid()) = usuario)
  with check ((select auth.uid()) = usuario);

create policy "atlas_excluir_proprio_progresso"
  on public.progresso_atlas for delete
  to authenticated
  using ((select auth.uid()) = usuario);

revoke all on table public.progresso_atlas from anon;
grant select, insert, update, delete on table public.progresso_atlas to authenticated;

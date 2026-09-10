-- Preparada para revisão. Aplicar antes de publicar o app com conquistas.
-- Separada do progresso: clientes antigos não escrevem nesta tabela.
create table if not exists public.conquistas_atlas (
  usuario uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null check (generation >= 0 and generation <= 9007199254740991),
  epoch text not null check (length(epoch) <= 100),
  unlocked text[] not null default '{}' check (cardinality(unlocked) <= 25)
);
alter table public.conquistas_atlas enable row level security;
alter table public.conquistas_atlas force row level security;
revoke all on public.conquistas_atlas from anon;
grant select, insert, update, delete on public.conquistas_atlas to authenticated;
drop policy if exists conquistas_proprias on public.conquistas_atlas;
create policy conquistas_proprias on public.conquistas_atlas for all to authenticated
  using ((select auth.uid()) = usuario) with check ((select auth.uid()) = usuario);

-- A união ocorre dentro de uma única gravação do banco: dois aparelhos não
-- sobrescrevem troféus um do outro. Uma geração/época posterior vence a antiga.
create or replace function public.atlas_merge_conquistas(p_generation bigint, p_epoch text, p_unlocked text[])
returns table (generation bigint, epoch text, unlocked text[])
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Conta necessária'; end if;
  if p_generation is null or p_generation < 0 or p_generation > 9007199254740991
    or p_epoch is null or length(p_epoch) > 100 or p_unlocked is null
    or cardinality(p_unlocked) > 25 or array_position(p_unlocked, null) is not null
    or not p_unlocked <@ array['first','countries25','countries195','master1','master10','region','world',
      'flags','capitals','maps','regions','typed10','streak25','last5','exam10','exam30','examDone',
      'review','six','debt','loupe','micro5','theme','backup','cloud']::text[]
  then raise exception 'Conquistas inválidas'; end if;
  return query
  insert into public.conquistas_atlas as current (usuario, generation, epoch, unlocked)
  values (auth.uid(), p_generation, p_epoch, array(select distinct x from unnest(p_unlocked) x order by x))
  on conflict (usuario) do update set
    generation = case when (excluded.generation, excluded.epoch collate "C") > (current.generation, current.epoch collate "C") then excluded.generation else current.generation end,
    epoch = case when (excluded.generation, excluded.epoch collate "C") > (current.generation, current.epoch collate "C") then excluded.epoch else current.epoch end,
    unlocked = case
      when (excluded.generation, excluded.epoch collate "C") > (current.generation, current.epoch collate "C") then excluded.unlocked
      when (excluded.generation, excluded.epoch) = (current.generation, current.epoch)
        then array(select distinct x from unnest(current.unlocked || excluded.unlocked) x order by x)
      else current.unlocked end
  returning current.generation, current.epoch, current.unlocked;
end;
$$;
revoke all on function public.atlas_merge_conquistas(bigint, text, text[]) from public, anon;
grant execute on function public.atlas_merge_conquistas(bigint, text, text[]) to authenticated;

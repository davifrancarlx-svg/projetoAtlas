-- Aplicar antes de publicar o cliente com esquema 3.
-- Clientes antigos não reconhecem históricos novos e podem tentar substituir
-- o envelope por uma cópia v2. A barreira impede perda de dados entre versões.
create or replace function public.atlas_impede_regressao_esquema()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if jsonb_typeof(old.envelope -> 'schemaVersion') = 'number' then
    if jsonb_typeof(new.envelope -> 'schemaVersion') is distinct from 'number'
       or (new.envelope ->> 'schemaVersion')::numeric < (old.envelope ->> 'schemaVersion')::numeric then
      raise exception 'Atualize o Atlas antes de sincronizar este progresso.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_impede_regressao_esquema on public.progresso_atlas;
create trigger atlas_impede_regressao_esquema
before update of envelope on public.progresso_atlas
for each row execute function public.atlas_impede_regressao_esquema();

-- Fix auth signup/profile provisioning on projects where pgcrypto's
-- gen_random_bytes(integer) is unavailable.
-- Preserve the existing aura.tg:// vault-id format and uniqueness guarantee.
create or replace function public.make_vault_id()
returns text
language plpgsql
set search_path to 'public'
as $function$
declare
  v_id text;
begin
  loop
    v_id := 'aura.tg://' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (
      select 1 from public.profiles where vault_id = v_id
    );
  end loop;
  return v_id;
end;
$function$;

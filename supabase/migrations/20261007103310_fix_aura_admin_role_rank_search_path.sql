create or replace function public.aura_admin_role_rank(p_role text)
returns integer
language sql
immutable
set search_path=public
as $$
  select case lower(coalesce(p_role,''))
    when 'owner' then 100
    when 'finance' then 80
    when 'operator' then 50
    when 'moderator' then 20
    else 0
  end;
$$;
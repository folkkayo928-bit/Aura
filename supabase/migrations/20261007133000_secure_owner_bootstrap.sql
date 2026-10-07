create table if not exists public.aura_owner_bootstrap (
  id boolean primary key default true check (id = true),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.aura_owner_bootstrap enable row level security;

create or replace function public.aura_owner_bootstrap_available()
returns boolean
language sql
stable
security definer
set search_path to public
as $function$
  select auth.uid() is not null
    and not exists (select 1 from public.aura_admins where active = true)
    and exists (
      select 1
      from public.aura_owner_bootstrap
      where id = true
        and used_at is null
        and expires_at > now()
    );
$function$;

create or replace function public.claim_aura_owner(p_token text)
returns boolean
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_boot public.aura_owner_bootstrap;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (select 1 from public.aura_admins where active = true) then raise exception 'OWNER_ALREADY_CLAIMED'; end if;

  select * into v_boot
  from public.aura_owner_bootstrap
  where id = true
    and used_at is null
    and expires_at > now()
  for update;

  if not found then raise exception 'BOOTSTRAP_UNAVAILABLE'; end if;
  if encode(digest(trim(coalesce(p_token,'')), 'sha256'), 'hex') <> v_boot.token_hash then
    raise exception 'INVALID_BOOTSTRAP_TOKEN';
  end if;

  insert into public.aura_admins(user_id, role, active, granted_by)
  values (v_user, 'owner', true, null);

  update public.aura_owner_bootstrap
  set used_at = now()
  where id = true;

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (
    v_user,
    'owner_bootstrap_claimed',
    'aura_admin',
    v_user,
    jsonb_build_object('method','one_time_bootstrap_token')
  );

  return true;
end;
$function$;

revoke execute on function public.aura_owner_bootstrap_available() from public, anon;
grant execute on function public.aura_owner_bootstrap_available() to authenticated;
revoke execute on function public.claim_aura_owner(text) from public, anon;
grant execute on function public.claim_aura_owner(text) to authenticated;

insert into public.aura_owner_bootstrap(id, token_hash, expires_at)
values (true, '637b4ccfff49f513b2fcecc5c92f98af31913feaf0f3bff653fb5fdfc93c2ed8', now() + interval '30 days')
on conflict (id) do nothing;

alter table public.profiles
  add column if not exists telegram_user_id text;

create unique index if not exists profiles_telegram_user_id_key
  on public.profiles (telegram_user_id)
  where telegram_user_id is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_name text;
  v_handle text;
  v_base_handle text;
  v_counter integer := 0;
  v_telegram_user_id text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(new.email,''),'@',1), ''),
    'AURA Collector'
  );

  v_base_handle := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '', 'g'));
  if v_base_handle = '' then v_base_handle := 'collector'; end if;

  v_handle := '@' || left(v_base_handle, 24);
  while exists(select 1 from public.profiles p where p.handle = v_handle) loop
    v_counter := v_counter + 1;
    v_handle := '@' || left(
      v_base_handle,
      greatest(1, 24 - length(v_counter::text))
    ) || v_counter::text;
  end loop;

  v_telegram_user_id := coalesce(
    nullif(trim(new.raw_user_meta_data->>'telegram_id'), ''),
    case
      when coalesce(new.raw_app_meta_data->>'provider', '') = 'custom:telegram'
        then nullif(trim(new.raw_user_meta_data->>'sub'), '')
      else null
    end
  );

  insert into public.profiles (
    id,
    handle,
    display_name,
    bio,
    vault_id,
    telegram_user_id
  )
  values (
    new.id,
    v_handle,
    v_name,
    coalesce(new.raw_user_meta_data->>'bio', ''),
    public.make_vault_id(),
    v_telegram_user_id
  );

  insert into public.wallet_accounts (user_id) values (new.id);
  return new;
end;
$function$;

create or replace function public.set_my_telegram_identity(p_telegram_id text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_telegram_id is null or p_telegram_id !~ '^[0-9]{1,20}$' then
    raise exception 'INVALID_TELEGRAM_ID';
  end if;

  if exists (
    select 1
    from public.profiles
    where telegram_user_id = p_telegram_id
      and id <> auth.uid()
  ) then
    raise exception 'TELEGRAM_ID_ALREADY_LINKED';
  end if;

  update public.profiles
  set telegram_user_id = p_telegram_id,
      updated_at = now()
  where id = auth.uid();
end;
$function$;

revoke all on function public.set_my_telegram_identity(text) from public;
grant execute on function public.set_my_telegram_identity(text) to authenticated;

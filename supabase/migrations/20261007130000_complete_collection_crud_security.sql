drop policy if exists collections_owner_insert on public.collections;
create policy collections_owner_insert
  on public.collections
  for insert
  to public
  with check ((select auth.uid()) = creator_id and verified = false);

drop policy if exists collections_owner_update on public.collections;
create policy collections_owner_update
  on public.collections
  for update
  to public
  using ((select auth.uid()) = creator_id and verified = false)
  with check ((select auth.uid()) = creator_id and verified = false);

drop policy if exists collections_owner_delete on public.collections;
create policy collections_owner_delete
  on public.collections
  for delete
  to public
  using ((select auth.uid()) = creator_id and verified = false);

create or replace function public.create_my_collection(
  p_name text,
  p_slug text default null,
  p_avatar_url text default null,
  p_banner_url text default null,
  p_description text default '',
  p_category text default 'generative',
  p_website_url text default null,
  p_telegram_url text default null,
  p_discord_url text default null
)
returns public.collections
language plpgsql
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := trim(lower(coalesce(p_slug, '')));
  v_collection public.collections;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'INVALID_COLLECTION_NAME'; end if;

  if v_slug = '' then
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  else
    v_slug := lower(regexp_replace(v_slug, '[^a-zA-Z0-9-]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  end if;

  if v_slug = '' or char_length(v_slug) > 140 then raise exception 'INVALID_COLLECTION_SLUG'; end if;
  if exists (select 1 from public.collections where slug = v_slug) then raise exception 'COLLECTION_SLUG_TAKEN'; end if;

  insert into public.collections(
    creator_id, name, slug, avatar_url, banner_url, verified, description, category,
    website_url, telegram_url, discord_url
  )
  values(
    v_user, v_name, v_slug,
    nullif(trim(coalesce(p_avatar_url,'')), ''),
    nullif(trim(coalesce(p_banner_url,'')), ''),
    false,
    left(trim(coalesce(p_description,'')), 2000),
    case when p_category in ('generative','sculpture','minimalist','kinetic','botanical','cyber','anime_pfp','brand_streetwear','ui_design','gif_animation')
      then p_category else 'generative' end,
    nullif(trim(coalesce(p_website_url,'')), ''),
    nullif(trim(coalesce(p_telegram_url,'')), ''),
    nullif(trim(coalesce(p_discord_url,'')), '')
  )
  returning * into v_collection;

  return v_collection;
end;
$function$;

create or replace function public.update_my_collection(
  p_collection_id uuid,
  p_name text,
  p_slug text,
  p_avatar_url text default null,
  p_banner_url text default null,
  p_description text default '',
  p_category text default 'generative',
  p_website_url text default null,
  p_telegram_url text default null,
  p_discord_url text default null
)
returns public.collections
language plpgsql
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := trim(lower(coalesce(p_slug, '')));
  v_collection public.collections;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'INVALID_COLLECTION_NAME'; end if;
  v_slug := lower(regexp_replace(v_slug, '[^a-zA-Z0-9-]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  if v_slug = '' or char_length(v_slug) > 140 then raise exception 'INVALID_COLLECTION_SLUG'; end if;

  if exists (
    select 1 from public.collections
    where slug = v_slug and id <> p_collection_id
  ) then
    raise exception 'COLLECTION_SLUG_TAKEN';
  end if;

  update public.collections
  set name = v_name,
      slug = v_slug,
      avatar_url = nullif(trim(coalesce(p_avatar_url,'')), ''),
      banner_url = nullif(trim(coalesce(p_banner_url,'')), ''),
      description = left(trim(coalesce(p_description,'')), 2000),
      category = case when p_category in ('generative','sculpture','minimalist','kinetic','botanical','cyber','anime_pfp','brand_streetwear','ui_design','gif_animation')
        then p_category else 'generative' end,
      website_url = nullif(trim(coalesce(p_website_url,'')), ''),
      telegram_url = nullif(trim(coalesce(p_telegram_url,'')), ''),
      discord_url = nullif(trim(coalesce(p_discord_url,'')), ''),
      updated_at = now()
  where id = p_collection_id
    and creator_id = v_user
    and verified = false
  returning * into v_collection;

  if not found then raise exception 'COLLECTION_NOT_EDITABLE'; end if;
  return v_collection;
end;
$function$;

create or replace function public.delete_my_collection(p_collection_id uuid)
returns boolean
language plpgsql
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  delete from public.collections
  where id = p_collection_id
    and creator_id = v_user
    and verified = false;

  if not found then raise exception 'COLLECTION_NOT_DELETABLE'; end if;
  return true;
end;
$function$;

revoke execute on function public.create_my_collection(text,text,text,text,text,text,text,text,text) from anon;
revoke execute on function public.update_my_collection(uuid,text,text,text,text,text,text,text,text,text) from anon;
revoke execute on function public.delete_my_collection(uuid) from anon;

grant execute on function public.create_my_collection(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.update_my_collection(uuid,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.delete_my_collection(uuid) to authenticated;

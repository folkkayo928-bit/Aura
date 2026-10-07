create or replace function public.ensure_my_collection(
  p_name text,
  p_category text default 'generative',
  p_description text default '',
  p_avatar_url text default null,
  p_banner_url text default null
)
returns public.collections
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_collection public.collections;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'INVALID_COLLECTION_NAME';
  end if;

  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  if v_slug = '' then
    raise exception 'INVALID_COLLECTION_NAME';
  end if;

  insert into public.collections (
    creator_id, name, slug, avatar_url, banner_url, description, category
  )
  values (
    auth.uid(),
    v_name,
    v_slug,
    nullif(trim(coalesce(p_avatar_url, '')), ''),
    nullif(trim(coalesce(p_banner_url, '')), ''),
    left(trim(coalesce(p_description, '')), 2000),
    case
      when p_category in ('generative','sculpture','minimalist','kinetic','botanical','cyber','anime_pfp','brand_streetwear','ui_design','gif_animation')
        then p_category
      else 'generative'
    end
  )
  on conflict (slug) do nothing;

  select * into v_collection
    from public.collections
   where slug = v_slug
   limit 1;

  if v_collection.id is null then
    raise exception 'COLLECTION_CREATE_FAILED';
  end if;

  return v_collection;
end;
$$;

revoke execute on function public.ensure_my_collection(text,text,text,text,text) from public;
revoke execute on function public.ensure_my_collection(text,text,text,text,text) from anon;
grant execute on function public.ensure_my_collection(text,text,text,text,text) to authenticated;

create table if not exists public.artwork_offers (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  offer_amount_usdt numeric not null check (offer_amount_usdt > 0),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artwork_offers_artwork_created_idx on public.artwork_offers(artwork_id, created_at desc);
create index if not exists artwork_offers_buyer_created_idx on public.artwork_offers(buyer_id, created_at desc);
create index if not exists artwork_offers_seller_created_idx on public.artwork_offers(seller_id, created_at desc);

alter table public.artwork_offers enable row level security;

drop policy if exists "artwork offers participants can read" on public.artwork_offers;
create policy "artwork offers participants can read"
on public.artwork_offers for select to authenticated
using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);

drop policy if exists "users can create own artwork offers" on public.artwork_offers;
create policy "users can create own artwork offers"
on public.artwork_offers for insert to authenticated
with check ((select auth.uid()) = buyer_id);

create or replace function public.create_artwork_offer(p_artwork_id uuid, p_offer_amount_usdt numeric)
returns public.artwork_offers
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_art public.artworks;
  v_offer public.artwork_offers;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_offer_amount_usdt is null or p_offer_amount_usdt <= 0 then raise exception 'INVALID_OFFER_AMOUNT'; end if;

  select * into v_art from public.artworks where id = p_artwork_id and published = true;
  if not found then raise exception 'ARTWORK_NOT_FOUND'; end if;

  if exists (
    select 1 from public.artwork_ownership
    where artwork_id = p_artwork_id and owner_id = v_user
  ) then
    raise exception 'ALREADY_OWNER';
  end if;

  insert into public.artwork_offers(artwork_id,buyer_id,seller_id,offer_amount_usdt)
  values(p_artwork_id,v_user,v_art.creator_id,p_offer_amount_usdt)
  returning * into v_offer;

  return v_offer;
end
$$;

revoke execute on function public.create_artwork_offer(uuid,numeric) from public, anon;
grant execute on function public.create_artwork_offer(uuid,numeric) to authenticated;
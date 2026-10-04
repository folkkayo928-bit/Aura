-- AURA additive trust layer: on-chain wallet registry, deposits/withdrawals, user payment methods, P2P payment evidence, and community valuation mode.
create table if not exists public.onchain_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null check (chain in ('ethereum','polygon','arbitrum','solana','ton')),
  address text not null,
  address_type text not null default 'external' check (address_type in ('external','embedded')),
  provider text not null default 'external_provider',
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain, address)
);
create unique index if not exists onchain_wallets_one_primary_per_chain on public.onchain_wallets(user_id, chain) where is_primary;
alter table public.onchain_wallets enable row level security;
drop policy if exists "onchain_wallets_self_read" on public.onchain_wallets;
create policy "onchain_wallets_self_read" on public.onchain_wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists "onchain_wallets_self_insert" on public.onchain_wallets;
create policy "onchain_wallets_self_insert" on public.onchain_wallets for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "onchain_wallets_self_update" on public.onchain_wallets;
create policy "onchain_wallets_self_update" on public.onchain_wallets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.wallet_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null,
  token_symbol text not null default 'USDT',
  token_contract text,
  destination_address text not null,
  tx_hash text not null,
  amount numeric not null check (amount > 0),
  confirmations integer not null default 0 check (confirmations >= 0),
  required_confirmations integer not null default 12 check (required_confirmations > 0),
  status text not null default 'detected' check (status in ('detected','confirming','confirmed','credited','rejected')),
  detected_at timestamptz, confirmed_at timestamptz, credited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (chain, tx_hash, token_contract)
);
alter table public.wallet_deposits enable row level security;
drop policy if exists "wallet_deposits_self_read" on public.wallet_deposits;
create policy "wallet_deposits_self_read" on public.wallet_deposits for select to authenticated using (user_id = auth.uid());

create table if not exists public.wallet_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null,
  token_symbol text not null default 'USDT',
  token_contract text,
  destination_address text not null,
  amount numeric not null check (amount > 0),
  network_fee numeric not null default 0 check (network_fee >= 0),
  status text not null default 'pending_email_confirmation'
    check (status in ('pending_email_confirmation','confirmed','queued','broadcast','confirmed_onchain','rejected','cancelled')),
  email_confirmed_at timestamptz, tx_hash text, rejection_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  broadcast_at timestamptz, confirmed_onchain_at timestamptz
);
alter table public.wallet_withdrawals enable row level security;
drop policy if exists "wallet_withdrawals_self_read" on public.wallet_withdrawals;
create policy "wallet_withdrawals_self_read" on public.wallet_withdrawals for select to authenticated using (user_id = auth.uid());
drop policy if exists "wallet_withdrawals_self_insert" on public.wallet_withdrawals;
create policy "wallet_withdrawals_self_insert" on public.wallet_withdrawals for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.p2p_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null, label text not null, account_holder_name text not null,
  account_identifier text not null, instructions text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.p2p_payment_methods enable row level security;
drop policy if exists "p2p_payment_methods_self_all" on public.p2p_payment_methods;
create policy "p2p_payment_methods_self_all" on public.p2p_payment_methods for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.p2p_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.p2p_orders(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null, file_name text not null, mime_type text not null, note text,
  created_at timestamptz not null default now()
);
alter table public.p2p_payment_proofs enable row level security;
drop policy if exists "p2p_payment_proofs_participant_read" on public.p2p_payment_proofs;
create policy "p2p_payment_proofs_participant_read" on public.p2p_payment_proofs for select to authenticated using (
  exists (select 1 from public.p2p_orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()))
);
drop policy if exists "p2p_payment_proofs_buyer_insert" on public.p2p_payment_proofs;
create policy "p2p_payment_proofs_buyer_insert" on public.p2p_payment_proofs for insert to authenticated with check (
  uploader_id = auth.uid() and exists (
    select 1 from public.p2p_orders o where o.id = order_id and o.buyer_id = auth.uid() and o.status in ('escrow_locked','payment_marked','in_dispute')
  )
);

alter table public.artwork_interactions add column if not exists disliked boolean not null default false;
alter table public.artworks add column if not exists valuation_mode text not null default 'market' check (valuation_mode in ('market','community'));
alter table public.artworks add column if not exists dislikes integer not null default 0 check (dislikes >= 0);
alter table public.artworks add column if not exists community_value_usdt numeric not null default 0 check (community_value_usdt >= 0);
alter table public.artworks add column if not exists community_value_updated_at timestamptz;

create or replace function public.sync_artwork_interaction_counts()
returns trigger language plpgsql set search_path = public as $function$
declare v_artwork uuid; v_likes integer; v_dislikes integer; v_loves integer; v_saves integer; v_eligible integer;
begin
  v_artwork := coalesce(new.artwork_id, old.artwork_id);
  select count(*) filter (where liked), count(*) filter (where disliked), count(*) filter (where loved), count(*) filter (where saved)
  into v_likes, v_dislikes, v_loves, v_saves from public.artwork_interactions where artwork_id = v_artwork;
  v_eligible := greatest(0, (v_likes + v_saves) + (2 * v_loves) + (select count(*) * 3 from public.artwork_comments c where c.artwork_id = v_artwork));
  update public.artworks a set
    likes=v_likes, dislikes=v_dislikes, loves=v_loves, saves=v_saves, eligible_interactions=v_eligible,
    community_value_usdt=case when a.original_price_usdt > 0 and v_likes >= 500 then round((a.original_price_usdt * greatest(0.25,1 + (floor(v_likes/500.0)*0.05) - (floor(v_dislikes/500.0)*0.05)))::numeric,6) else coalesce(a.community_value_usdt,a.original_price_usdt) end,
    current_value_usdt=case when a.valuation_mode='community' and v_likes >= 500 then round((a.original_price_usdt * greatest(0.25,1 + (floor(v_likes/500.0)*0.05) - (floor(v_dislikes/500.0)*0.05)))::numeric,6) else a.current_value_usdt end,
    community_value_updated_at=case when v_likes >= 500 then now() else a.community_value_updated_at end
  where a.id=v_artwork;
  return coalesce(new,old);
end;
$function$;

create or replace function public.toggle_artwork_interaction(p_artwork_id uuid,p_kind text)
returns public.artwork_interactions language plpgsql security definer set search_path=public as $function$
declare v_user uuid:=auth.uid(); v_row public.artwork_interactions;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind not in ('liked','disliked','loved','saved','watched') then raise exception 'INVALID_INTERACTION'; end if;
  insert into public.artwork_interactions(artwork_id,user_id) values(p_artwork_id,v_user) on conflict do nothing;
  if p_kind='liked' then update public.artwork_interactions set liked=not liked,disliked=false,updated_at=now() where artwork_id=p_artwork_id and user_id=v_user;
  elsif p_kind='disliked' then update public.artwork_interactions set disliked=not disliked,liked=false,updated_at=now() where artwork_id=p_artwork_id and user_id=v_user;
  elsif p_kind='loved' then update public.artwork_interactions set loved=not loved,updated_at=now() where artwork_id=p_artwork_id and user_id=v_user;
  elsif p_kind='saved' then update public.artwork_interactions set saved=not saved,updated_at=now() where artwork_id=p_artwork_id and user_id=v_user;
  else update public.artwork_interactions set watched=not watched,updated_at=now() where artwork_id=p_artwork_id and user_id=v_user; end if;
  select * into v_row from public.artwork_interactions where artwork_id=p_artwork_id and user_id=v_user; return v_row;
end;
$function$;
revoke execute on function public.toggle_artwork_interaction(uuid,text) from anon;
grant execute on function public.toggle_artwork_interaction(uuid,text) to authenticated;
create index if not exists p2p_payment_proofs_order_idx on public.p2p_payment_proofs(order_id,created_at);
create index if not exists wallet_deposits_user_idx on public.wallet_deposits(user_id,created_at desc);
create index if not exists wallet_withdrawals_user_idx on public.wallet_withdrawals(user_id,created_at desc);

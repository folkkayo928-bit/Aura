-- AURA TON Connect ownership verification.
-- Existing wallet rows are preserved; uniqueness is scoped to network so one
-- address can be linked separately across the account's supported networks.
alter table public.external_wallet_challenges
  drop constraint if exists external_wallet_challenges_provider_check;
alter table public.external_wallet_challenges
  add constraint external_wallet_challenges_provider_check
  check (provider in ('MetaMask', 'Phantom'));

alter table public.external_wallet_challenges
  drop constraint if exists external_wallet_challenges_network_check;
alter table public.external_wallet_challenges
  add constraint external_wallet_challenges_network_check
  check (network in ('ethereum', 'polygon', 'arbitrum', 'bsc', 'solana'));

alter table public.external_wallets
  drop constraint if exists external_wallets_provider_check;
alter table public.external_wallets
  add constraint external_wallets_provider_check
  check (provider in ('Tonkeeper', 'TON Connect', 'MetaMask', 'Phantom', 'Trust Wallet'));

do $$
begin
  if exists (
    select 1
    from public.external_wallets
    group by user_id, provider, network, address
    having count(*) > 1
  ) then
    raise exception 'Duplicate network-scoped external wallet rows prevent safe uniqueness migration';
  end if;
end $$;

alter table public.external_wallets
  drop constraint if exists external_wallets_user_id_provider_address_key;
alter table public.external_wallets
  drop constraint if exists external_wallets_user_provider_network_address_key;
alter table public.external_wallets
  add constraint external_wallets_user_provider_network_address_key
  unique (user_id, provider, network, address);

create table if not exists public.external_wallet_ton_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payload text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.external_wallet_ton_challenges enable row level security;
revoke all on public.external_wallet_ton_challenges from anon, authenticated;
grant all on public.external_wallet_ton_challenges to service_role;
create index if not exists external_wallet_ton_challenges_user_idx
  on public.external_wallet_ton_challenges(user_id, created_at desc);
create index if not exists external_wallet_ton_challenges_expiry_idx
  on public.external_wallet_ton_challenges(expires_at);

-- The TON proof backend stores only public account addresses and one-time payloads.
-- It never requests wallet keys and does not credit P2P/internal balances.

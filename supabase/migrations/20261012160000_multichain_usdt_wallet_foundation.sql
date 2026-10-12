-- AURA multichain wallet foundation.
-- Additive only: this migration does not drop or rewrite existing wallet, P2P,
-- Telegram, NFT, deposit, withdrawal, or ledger objects.
-- Network/token rows remain disabled until the matching adapter passes live
-- integration tests and an explicit operational enablement review.

create table if not exists public.wallet_network_registry (
  network_key text primary key,
  family text not null check (family in ('evm', 'solana', 'ton')),
  display_name text not null,
  chain_id bigint,
  native_symbol text not null,
  enabled_for_receive boolean not null default false,
  enabled_for_send boolean not null default false,
  finality_mode text not null check (finality_mode in ('confirmations', 'finalized', 'ton_finalized')),
  min_confirmations integer not null default 1 check (min_confirmations >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (family = 'evm' and chain_id is not null) or
    (family in ('solana', 'ton') and chain_id is null)
  )
);

create table if not exists public.wallet_asset_registry (
  asset_key text primary key,
  network_key text not null references public.wallet_network_registry(network_key),
  symbol text not null,
  display_name text not null,
  token_standard text not null,
  token_address text not null,
  decimals smallint not null check (decimals between 0 and 30),
  enabled boolean not null default false,
  issuer_reference text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_key, token_address)
);

create table if not exists public.wallet_chain_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  network_key text not null references public.wallet_network_registry(network_key),
  address text not null check (length(address) between 8 and 160),
  address_kind text not null check (address_kind in ('receive', 'external_connected')),
  custody_model text not null check (custody_model in ('self_custody', 'embedded_non_custodial', 'external_wallet')),
  verification_method text not null check (verification_method in ('signed_challenge', 'wallet_created_locally', 'provider_attestation')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, network_key, address)
);

create unique index if not exists wallet_chain_addresses_network_address_uq
  on public.wallet_chain_addresses (
    network_key,
    (case when network_key in ('ethereum', 'bsc') then lower(address) else address end)
  );

create index if not exists wallet_chain_addresses_user_network_idx
  on public.wallet_chain_addresses (user_id, network_key);

create table if not exists public.wallet_chain_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  network_key text not null references public.wallet_network_registry(network_key),
  asset_key text not null references public.wallet_asset_registry(asset_key),
  tx_hash text not null check (length(tx_hash) between 16 and 160),
  event_index integer not null default 0 check (event_index >= 0),
  direction text not null check (direction in ('deposit', 'withdrawal')),
  status text not null check (status in ('observed', 'confirming', 'confirmed', 'submitted', 'failed', 'reverted', 'replaced')),
  amount_raw numeric(78, 0) not null check (amount_raw >= 0),
  decimals smallint not null check (decimals between 0 and 30),
  from_address text,
  to_address text,
  block_number numeric(78, 0),
  confirmations integer not null default 0 check (confirmations >= 0),
  idempotency_key text not null,
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists wallet_chain_events_user_observed_idx
  on public.wallet_chain_events (user_id, observed_at desc);

create unique index if not exists wallet_chain_events_network_tx_event_uq
  on public.wallet_chain_events (
    network_key,
    (case when network_key in ('ethereum', 'bsc') then lower(tx_hash) else tx_hash end),
    event_index
  );

create index if not exists wallet_chain_events_network_status_idx
  on public.wallet_chain_events (network_key, status, observed_at);

alter table public.wallet_network_registry enable row level security;
alter table public.wallet_asset_registry enable row level security;
alter table public.wallet_chain_addresses enable row level security;
alter table public.wallet_chain_events enable row level security;

revoke all on public.wallet_network_registry from public, anon, authenticated;
revoke all on public.wallet_asset_registry from public, anon, authenticated;
revoke all on public.wallet_chain_addresses from public, anon, authenticated;
revoke all on public.wallet_chain_events from public, anon, authenticated;

grant select on public.wallet_network_registry to anon, authenticated;
grant select on public.wallet_asset_registry to anon, authenticated;
grant select on public.wallet_chain_addresses to authenticated;
grant select on public.wallet_chain_events to authenticated;

create policy wallet_network_registry_enabled_read
  on public.wallet_network_registry
  for select to anon, authenticated
  using (enabled_for_receive or enabled_for_send);

create policy wallet_asset_registry_enabled_read
  on public.wallet_asset_registry
  for select to anon, authenticated
  using (enabled);

create policy wallet_chain_addresses_owner_read
  on public.wallet_chain_addresses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy wallet_chain_events_owner_read
  on public.wallet_chain_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- The four target networks are registered but deliberately not enabled until
-- their receive/send adapters, fee paths, and transaction-state tests pass.
insert into public.wallet_network_registry
  (network_key, family, display_name, chain_id, native_symbol, enabled_for_receive, enabled_for_send, finality_mode, min_confirmations)
values
  ('ethereum', 'evm', 'Ethereum', 1, 'ETH', false, false, 'confirmations', 12),
  ('bsc', 'evm', 'BNB Smart Chain', 56, 'BNB', false, false, 'confirmations', 15),
  ('solana', 'solana', 'Solana', null, 'SOL', false, false, 'finalized', 1),
  ('ton', 'ton', 'TON', null, 'TON', false, false, 'ton_finalized', 1)
on conflict (network_key) do nothing;

-- Candidate token identifiers. The BSC address inherited from AURA's existing config
-- is Binance-Peg BSC-USD, not issuer-native Tether USDt; label it honestly and verify
-- provenance/decimals on-chain before enabling. All assets remain disabled pending adapter tests.
insert into public.wallet_asset_registry
  (asset_key, network_key, symbol, display_name, token_standard, token_address, decimals, enabled, issuer_reference)
values
  ('usdt_ethereum', 'ethereum', 'USDT', 'Tether USD', 'ERC-20', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, false, 'https://tether.to/en/supported-protocols/'),
  ('usdt_bsc', 'bsc', 'BSC-USD', 'Binance-Peg BSC-USD (bridged USDT representation)', 'BEP-20', '0x55d398326f99059fF775485246999027B3197955', 18, false, 'https://bscscan.com/token/0x55d398326f99059fF775485246999027B3197955'),
  ('usdt_solana', 'solana', 'USDT', 'Tether USD', 'SPL Token', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 6, false, 'https://tether.to/en/supported-protocols/'),
  ('usdt_ton', 'ton', 'USDT', 'Tether USD', 'Jetton', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 6, false, 'https://tether.to/en/supported-protocols/')
on conflict (asset_key) do nothing;

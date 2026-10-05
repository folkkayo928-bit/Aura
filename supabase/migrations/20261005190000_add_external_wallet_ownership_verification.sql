create table if not exists public.external_wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('MetaMask','Phantom')),
  network text not null check (network in ('ethereum','polygon','arbitrum','solana')),
  address text not null,
  nonce text not null unique,
  message text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.external_wallet_challenges enable row level security;
alter table public.external_wallets add column if not exists verified_at timestamptz;

create index if not exists external_wallet_challenges_user_idx on public.external_wallet_challenges(user_id, created_at desc);
create index if not exists external_wallet_challenges_expiry_idx on public.external_wallet_challenges(expires_at);

revoke all on public.external_wallet_challenges from anon, authenticated;
grant all on public.external_wallet_challenges to service_role;
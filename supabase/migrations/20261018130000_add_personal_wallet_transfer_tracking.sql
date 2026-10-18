-- Personal non-custodial wallet history is separate from custodial deposit crediting.
-- Tracking is opt-in. This table stores public addresses only, never seed phrases or private keys.
create table if not exists public.personal_wallet_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  unique (user_id, address)
);

alter table public.personal_wallet_addresses enable row level security;
drop policy if exists "Users can view their personal wallet tracking" on public.personal_wallet_addresses;
create policy "Users can view their personal wallet tracking"
  on public.personal_wallet_addresses for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can enable their own personal wallet tracking" on public.personal_wallet_addresses;
create policy "Users can enable their own personal wallet tracking"
  on public.personal_wallet_addresses for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can disable their own personal wallet tracking" on public.personal_wallet_addresses;
create policy "Users can disable their own personal wallet tracking"
  on public.personal_wallet_addresses for delete to authenticated
  using (auth.uid() = user_id);
revoke all on public.personal_wallet_addresses from anon;
grant select, insert, delete on public.personal_wallet_addresses to authenticated;
grant all on public.personal_wallet_addresses to service_role;

create table if not exists public.personal_wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),
  network text not null check (network in ('ethereum','polygon','arbitrum','bsc')),
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index bigint not null check (log_index >= 0),
  block_number bigint not null check (block_number >= 0),
  from_address text not null check (from_address ~ '^0x[0-9a-f]{40}$'),
  to_address text not null check (to_address ~ '^0x[0-9a-f]{40}$'),
  amount numeric(78,36) not null check (amount > 0),
  token_symbol text not null check (token_symbol in ('USDT','USDT0')),
  token_contract text not null check (token_contract ~ '^0x[0-9a-f]{40}$'),
  confirmations integer not null default 0 check (confirmations >= 0),
  required_confirmations integer not null check (required_confirmations > 0),
  status text not null default 'detected' check (status in ('detected','confirmed','failed')),
  detected_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (network, tx_hash, log_index, address)
);

alter table public.personal_wallet_transfers enable row level security;
drop policy if exists "Users can view their personal wallet transfers" on public.personal_wallet_transfers;
create policy "Users can view their personal wallet transfers"
  on public.personal_wallet_transfers for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.personal_wallet_transfers from anon, authenticated;
grant select on public.personal_wallet_transfers to authenticated;
grant all on public.personal_wallet_transfers to service_role;

create index if not exists personal_wallet_transfers_user_recent_idx
  on public.personal_wallet_transfers(user_id, network, block_number desc);
create index if not exists personal_wallet_transfers_pending_idx
  on public.personal_wallet_transfers(network, status, block_number);

create table if not exists public.personal_wallet_scan_cursors (
  network text primary key check (network in ('ethereum','polygon','arbitrum','bsc')),
  last_scanned_block bigint not null check (last_scanned_block >= 0),
  updated_at timestamptz not null default now()
);
alter table public.personal_wallet_scan_cursors enable row level security;
revoke all on public.personal_wallet_scan_cursors from anon, authenticated;
grant all on public.personal_wallet_scan_cursors to service_role;

-- Run separately from the legacy custodial deposit indexer. It records incoming
-- transfers for opted-in personal addresses and never credits wallet_ledger.
select cron.unschedule(jobid)
from cron.job
where jobname = 'aura-personal-wallet-indexer';

select cron.schedule(
  'aura-personal-wallet-indexer',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='aura_project_url') || '/functions/v1/personal-wallet-indexer',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey',(select decrypted_secret from vault.decrypted_secrets where name='aura_publishable_key'),
        'x-aura-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='aura_worker_secret')
      ),
      body := jsonb_build_object('source','supabase-cron'),
      timeout_milliseconds := 60000
    ) as request_id;
  $job$
);

-- Durable, additive scan checkpoints so delayed BSC scans do not skip blocks.
create table if not exists public.wallet_deposit_scan_cursors (
  chain text primary key check (chain in ('ethereum','polygon','arbitrum','bsc')),
  last_scanned_block bigint not null check (last_scanned_block >= 0),
  updated_at timestamptz not null default now()
);

alter table public.wallet_deposit_scan_cursors enable row level security;
revoke all on public.wallet_deposit_scan_cursors from public, anon, authenticated;
grant select, insert, update, delete on public.wallet_deposit_scan_cursors to service_role;

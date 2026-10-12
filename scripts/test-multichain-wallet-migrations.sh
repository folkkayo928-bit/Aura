#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pgcrypto;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261012160000_multichain_usdt_wallet_foundation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261012170000_wallet_chain_atomic_scan_commit.sql

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
update public.wallet_network_registry set enabled_for_receive = true where network_key = 'ethereum';
update public.wallet_asset_registry set enabled = true where asset_key = 'usdt_ethereum';
insert into public.wallet_chain_addresses(
  user_id, network_key, address, address_kind, custody_model, verification_method, verified_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'ethereum',
  '0x2222222222222222222222222222222222222222',
  'receive',
  'external_wallet',
  'provider_attestation',
  now()
);

select public.commit_wallet_chain_scan_range(
  'ethereum', null, 100, 101, 105,
  '[{
    "user_id":"11111111-1111-4111-8111-111111111111",
    "asset_key":"usdt_ethereum",
    "tx_hash":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "event_index":"0",
    "amount_raw":"1234567",
    "decimals":"6",
    "from_address":"0x1111111111111111111111111111111111111111",
    "to_address":"0x2222222222222222222222222222222222222222",
    "block_number":"100"
  }]'::jsonb
);

do $$
declare
  v_cursor numeric;
  v_count integer;
  v_status text;
begin
  select last_scanned_block into v_cursor
    from public.wallet_chain_scan_cursors where network_key = 'ethereum';
  select count(*), min(status) into v_count, v_status
    from public.wallet_chain_events where network_key = 'ethereum';
  if v_cursor <> 101 then raise exception 'ASSERT_CURSOR_ADVANCEMENT_FAILED'; end if;
  if v_count <> 1 or v_status <> 'observed' then raise exception 'ASSERT_EVENT_PERSISTENCE_FAILED'; end if;
end $$;

-- A malformed event must abort the transaction and leave the cursor unchanged.
do $$
begin
  begin
    perform public.commit_wallet_chain_scan_range(
      'ethereum', 101, 102, 102, 105,
      '[{
        "user_id":"11111111-1111-4111-8111-111111111111",
        "asset_key":"usdt_ethereum",
        "tx_hash":"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "event_index":"0",
        "amount_raw":"1.5",
        "decimals":"6",
        "from_address":"0x1111111111111111111111111111111111111111",
        "to_address":"0x2222222222222222222222222222222222222222",
        "block_number":"102"
      }]'::jsonb
    );
    raise exception 'ASSERT_MALFORMED_EVENT_WAS_ACCEPTED';
  exception when others then
    if sqlerrm = 'ASSERT_MALFORMED_EVENT_WAS_ACCEPTED' then raise; end if;
  end;
end $$;

do $$
declare
  v_cursor numeric;
  v_count integer;
begin
  select last_scanned_block into v_cursor
    from public.wallet_chain_scan_cursors where network_key = 'ethereum';
  select count(*) into v_count from public.wallet_chain_events where network_key = 'ethereum';
  if v_cursor <> 101 then raise exception 'ASSERT_FAILED_RANGE_ADVANCED_CURSOR'; end if;
  if v_count <> 1 then raise exception 'ASSERT_FAILED_RANGE_INSERTED_EVENT'; end if;
end $$;

select 'multichain migration integration checks passed' as result;
SQL

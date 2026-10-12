-- Durable, idempotent scan-range commit for AURA's additive multichain event ledger.
-- Additive only. Existing deposit cursors, ledger, P2P, and withdrawal flows are untouched.
-- This RPC is deliberately unavailable until the network and asset are explicitly enabled.

create table if not exists public.wallet_chain_scan_cursors (
  network_key text primary key references public.wallet_network_registry(network_key),
  last_scanned_block numeric(78, 0) check (last_scanned_block is null or last_scanned_block >= 0),
  updated_at timestamptz not null default now()
);

alter table public.wallet_chain_scan_cursors enable row level security;
revoke all on public.wallet_chain_scan_cursors from public, anon, authenticated;

create or replace function public.commit_wallet_chain_scan_range(
  p_network_key text,
  p_expected_previous_block numeric,
  p_from_block numeric,
  p_to_block numeric,
  p_finalized_head numeric,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cursor numeric(78, 0);
  v_inserted integer := 0;
  v_event jsonb;
  v_user_id uuid;
  v_asset_key text;
  v_tx_hash text;
  v_event_index integer;
  v_amount_raw numeric(78, 0);
  v_decimals smallint;
  v_from_address text;
  v_to_address text;
  v_event_block numeric(78, 0);
  v_family text;
  v_expected_decimals smallint;
  v_asset_enabled boolean;
  v_network_enabled boolean;
  v_idempotency_key text;
begin
  if p_network_key not in ('ethereum', 'bsc', 'solana', 'ton')
     or p_from_block is null or p_to_block is null or p_finalized_head is null
     or p_from_block < 0 or p_to_block < p_from_block
     or p_to_block > p_finalized_head
     or p_events is null or jsonb_typeof(p_events) is distinct from 'array' then
    raise exception 'INVALID_SCAN_RANGE_OR_EVENTS';
  end if;

  if p_to_block - p_from_block > 100000 then
    raise exception 'SCAN_RANGE_TOO_LARGE';
  end if;
  if jsonb_array_length(p_events) > 10000 then
    raise exception 'TOO_MANY_SCAN_EVENTS';
  end if;

  select n.family, n.enabled_for_receive
    into v_family, v_network_enabled
    from public.wallet_network_registry n
    where n.network_key = p_network_key;
  if not found then raise exception 'UNKNOWN_NETWORK'; end if;
  if not v_network_enabled then raise exception 'NETWORK_RECEIVE_DISABLED'; end if;

  insert into public.wallet_chain_scan_cursors(network_key, last_scanned_block)
    values (p_network_key, null)
    on conflict (network_key) do nothing;

  select c.last_scanned_block into v_cursor
    from public.wallet_chain_scan_cursors c
    where c.network_key = p_network_key
    for update;
  -- A NULL cursor means this network has never committed a range. The first
  -- range may start at a configured historical height; subsequent ranges must
  -- compare-and-set the exact cursor and remain contiguous.
  if p_expected_previous_block is null then
    if v_cursor is not null then
      raise exception 'SCAN_CURSOR_CHANGED';
    end if;
  else
    if v_cursor is distinct from p_expected_previous_block then
      raise exception 'SCAN_CURSOR_CHANGED';
    end if;
    if p_from_block <> p_expected_previous_block + 1 then
      raise exception 'NON_CONTIGUOUS_SCAN_RANGE';
    end if;
  end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    begin
      v_user_id := (v_event->>'user_id')::uuid;
      v_asset_key := v_event->>'asset_key';
      v_tx_hash := v_event->>'tx_hash';
      v_event_index := (v_event->>'event_index')::integer;
      v_amount_raw := (v_event->>'amount_raw')::numeric;
      v_decimals := (v_event->>'decimals')::smallint;
      v_from_address := nullif(v_event->>'from_address', '');
      v_to_address := nullif(v_event->>'to_address', '');
      v_event_block := (v_event->>'block_number')::numeric;
    exception when others then
      raise exception 'INVALID_EVENT_SHAPE';
    end;

    if v_user_id is null or v_asset_key is null or v_tx_hash is null
       or length(v_tx_hash) < 16 or length(v_tx_hash) > 160
       or v_event_index is null or v_event_index < 0
       or v_amount_raw is null or v_amount_raw < 0
       or v_decimals is null or v_event_block is null
       or v_event_block < p_from_block or v_event_block > p_to_block
       or v_to_address is null then
      raise exception 'INVALID_EVENT_FIELDS';
    end if;

    if v_family = 'evm' then
      if v_tx_hash !~* '^0x[0-9a-f]{64}$'
         or v_to_address !~* '^0x[0-9a-f]{40}$'
         or (v_from_address is not null and v_from_address !~* '^0x[0-9a-f]{40}$') then
        raise exception 'INVALID_EVM_EVENT_FORMAT';
      end if;
    elsif v_family = 'solana' then
      if v_tx_hash !~ '^[A-Za-z0-9_+/=-]{16,160}$' then
        raise exception 'INVALID_SOLANA_SIGNATURE';
      end if;
    elsif v_family = 'ton' then
      if v_tx_hash !~ '^[A-Za-z0-9_+/=-]{16,160}$' then
        raise exception 'INVALID_TON_TRANSACTION_HASH';
      end if;
    end if;

    select a.decimals, a.enabled into v_expected_decimals, v_asset_enabled
      from public.wallet_asset_registry a
      where a.asset_key = v_asset_key and a.network_key = p_network_key;
    if not found then raise exception 'ASSET_NETWORK_MISMATCH'; end if;
    if not v_asset_enabled then raise exception 'ASSET_DISABLED'; end if;
    if v_decimals <> v_expected_decimals then raise exception 'ASSET_DECIMALS_MISMATCH'; end if;

    -- Never accept an arbitrary user ID as the recipient: it must match a
    -- verified receive address already registered to that user/network.
    if not exists (
      select 1 from public.wallet_chain_addresses a
      where a.user_id = v_user_id
        and a.network_key = p_network_key
        and a.address_kind = 'receive'
        and a.verified_at is not null
        and (
          (v_family = 'evm' and lower(a.address) = lower(v_to_address))
          or (v_family <> 'evm' and a.address = v_to_address)
        )
    ) then
      raise exception 'UNVERIFIED_RECIPIENT_ADDRESS';
    end if;

    v_idempotency_key := p_network_key || ':' || v_asset_key || ':' ||
      case when v_family = 'evm' then lower(v_tx_hash) else v_tx_hash end ||
      ':' || v_event_index::text;

    insert into public.wallet_chain_events (
      user_id, network_key, asset_key, tx_hash, event_index, direction, status,
      amount_raw, decimals, from_address, to_address, block_number,
      confirmations, idempotency_key
    ) values (
      v_user_id, p_network_key, v_asset_key,
      case when v_family = 'evm' then lower(v_tx_hash) else v_tx_hash end,
      v_event_index, 'deposit', 'observed', v_amount_raw, v_decimals,
      v_from_address, v_to_address, v_event_block, 0, v_idempotency_key
    )
    on conflict do nothing;

    if found then v_inserted := v_inserted + 1; end if;
  end loop;

  update public.wallet_chain_scan_cursors
    set last_scanned_block = p_to_block, updated_at = now()
    where network_key = p_network_key;

  return jsonb_build_object(
    'ok', true,
    'network_key', p_network_key,
    'from_block', p_from_block::text,
    'to_block', p_to_block::text,
    'inserted_events', v_inserted
  );
end;
$function$;

revoke all on function public.commit_wallet_chain_scan_range(text, numeric, numeric, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.commit_wallet_chain_scan_range(text, numeric, numeric, numeric, numeric, jsonb) to service_role;

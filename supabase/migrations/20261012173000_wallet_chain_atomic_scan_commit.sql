-- Durable, duplicate-safe scan checkpoints for the AURA multichain foundation.
-- Additive only. Does not alter the existing production deposit indexer or ledger.
create table if not exists public.wallet_chain_scan_checkpoints (
  network_key text primary key references public.wallet_network_registry(network_key),
  last_scanned_block numeric(78, 0),
  updated_at timestamptz not null default now()
);

alter table public.wallet_chain_scan_checkpoints enable row level security;
revoke all on public.wallet_chain_scan_checkpoints from public, anon, authenticated;
grant select on public.wallet_chain_scan_checkpoints to service_role;

create or replace function public.commit_wallet_chain_scan_range(
  p_network_key text,
  p_expected_cursor text,
  p_from_block text,
  p_to_block text,
  p_finalized_head text,
  p_provider_response_complete boolean,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cursor numeric(78,0);
  v_from numeric(78,0);
  v_to numeric(78,0);
  v_finalized numeric(78,0);
  v_event jsonb;
  v_asset_key text;
  v_tx_hash text;
  v_event_index integer;
  v_amount numeric(78,0);
  v_decimals smallint;
  v_block numeric(78,0);
  v_to_address text;
  v_from_address text;
  v_user_id uuid;
  v_idempotency_key text;
  v_inserted_id uuid;
  v_existing_user uuid;
  v_existing_key text;
  v_inserted integer := 0;
  v_duplicates integer := 0;
begin
  if p_network_key not in ('ethereum','bsc','solana','ton') then
    raise exception 'UNSUPPORTED_NETWORK';
  end if;
  if p_provider_response_complete is distinct from true then
    raise exception 'PROVIDER_RESPONSE_INCOMPLETE';
  end if;
  if jsonb_typeof(p_events) is distinct from 'array' then
    raise exception 'INVALID_EVENTS_ARRAY';
  end if;
  if p_from_block is null or p_to_block is null or p_finalized_head is null
     or p_from_block !~ '^(0|[1-9][0-9]*)$'
     or p_to_block !~ '^(0|[1-9][0-9]*)$'
     or p_finalized_head !~ '^(0|[1-9][0-9]*)$'
     or length(p_from_block) > 78 or length(p_to_block) > 78 or length(p_finalized_head) > 78 then
    raise exception 'INVALID_SCAN_HEIGHT';
  end if;
  v_from := p_from_block::numeric;
  v_to := p_to_block::numeric;
  v_finalized := p_finalized_head::numeric;
  if v_to < v_from or v_to > v_finalized then
    raise exception 'INVALID_FINALIZED_RANGE';
  end if;
  if p_expected_cursor is not null and (
    p_expected_cursor !~ '^(0|[1-9][0-9]*)$' or length(p_expected_cursor) > 78
  ) then raise exception 'INVALID_EXPECTED_CURSOR'; end if;

  -- A per-network row lock serializes workers and makes the cursor CAS atomic.
  insert into public.wallet_chain_scan_checkpoints(network_key, last_scanned_block)
  values (p_network_key, null)
  on conflict (network_key) do nothing;
  select last_scanned_block into v_cursor
  from public.wallet_chain_scan_checkpoints
  where network_key = p_network_key
  for update;

  if v_cursor is distinct from p_expected_cursor::numeric then
    -- NULL expected cursor is valid for a first scan.
    if not (v_cursor is null and p_expected_cursor is null) then
      raise exception 'SCAN_CURSOR_CHANGED';
    end if;
  end if;
  if v_cursor is not null and v_from <> v_cursor + 1 then
    raise exception 'NON_CONTIGUOUS_SCAN_RANGE';
  end if;

  if not exists (
    select 1 from public.wallet_network_registry n
    where n.network_key = p_network_key and n.enabled_for_receive = true
  ) then raise exception 'NETWORK_RECEIVE_DISABLED'; end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if jsonb_typeof(v_event) is distinct from 'object' then
      raise exception 'INVALID_EVENT_OBJECT';
    end if;
    v_asset_key := v_event->>'asset_key';
    v_tx_hash := v_event->>'tx_hash';
    v_to_address := v_event->>'to_address';
    v_from_address := nullif(v_event->>'from_address','');
    v_idempotency_key := v_event->>'idempotency_key';

    if v_tx_hash is null or length(v_tx_hash) < 16 or length(v_tx_hash) > 160
       or v_to_address is null or length(v_to_address) < 8 or length(v_to_address) > 160
       or v_idempotency_key is null or length(v_idempotency_key) < 1 or length(v_idempotency_key) > 512
       or coalesce(v_event->>'event_index','') !~ '^(0|[1-9][0-9]*)$'
       or length(v_event->>'event_index') > 10
       or coalesce(v_event->>'amount_raw','') !~ '^(0|[1-9][0-9]*)$'
       or length(v_event->>'amount_raw') > 78
       or coalesce(v_event->>'decimals','') !~ '^(0|[1-9][0-9]*)$'
       or coalesce(v_event->>'block_number','') !~ '^(0|[1-9][0-9]*)$'
       or length(v_event->>'block_number') > 78 then
      raise exception 'INVALID_EVENT_FIELDS';
    end if;
    v_event_index := (v_event->>'event_index')::integer;
    v_amount := (v_event->>'amount_raw')::numeric;
    v_decimals := (v_event->>'decimals')::smallint;
    v_block := (v_event->>'block_number')::numeric;
    if v_event_index < 0 or v_amount < 0 or v_block < v_from or v_block > v_to then
      raise exception 'EVENT_OUTSIDE_SCAN_RANGE';
    end if;
    if not exists (
      select 1 from public.wallet_asset_registry a
      where a.asset_key = v_asset_key and a.network_key = p_network_key
        and a.enabled = true and a.decimals = v_decimals
    ) then raise exception 'ASSET_DISABLED_OR_MISMATCHED'; end if;

    select a.user_id into v_user_id
    from public.wallet_chain_addresses a
    where a.network_key = p_network_key
      and a.address_kind = 'receive'
      and a.verified_at is not null
      and (
        case when p_network_key in ('ethereum','bsc') then lower(a.address) = lower(v_to_address)
        else a.address = v_to_address end
      )
    limit 1;
    if v_user_id is null then raise exception 'DESTINATION_NOT_VERIFIED'; end if;

    insert into public.wallet_chain_events(
      user_id, network_key, asset_key, tx_hash, event_index, direction, status,
      amount_raw, decimals, from_address, to_address, block_number, confirmations,
      idempotency_key, confirmed_at
    ) values (
      v_user_id, p_network_key, v_asset_key, v_tx_hash, v_event_index, 'deposit',
      case when coalesce((v_event->>'finalized')::boolean, false) then 'confirmed' else 'observed' end,
      v_amount, v_decimals, v_from_address, v_to_address, v_block,
      greatest(0, coalesce((v_event->>'confirmations')::integer, 0)),
      v_idempotency_key,
      case when coalesce((v_event->>'finalized')::boolean, false) then now() else null end
    )
    on conflict do nothing
    returning id into v_inserted_id;

    if v_inserted_id is not null then
      v_inserted := v_inserted + 1;
    else
      select user_id, idempotency_key into v_existing_user, v_existing_key
      from public.wallet_chain_events
      where network_key = p_network_key
        and (case when p_network_key in ('ethereum','bsc') then lower(tx_hash) = lower(v_tx_hash) else tx_hash = v_tx_hash end)
        and event_index = v_event_index;
      if v_existing_user is distinct from v_user_id or v_existing_key is distinct from v_idempotency_key then
        raise exception 'CHAIN_EVENT_IDENTITY_CONFLICT';
      end if;
      v_duplicates := v_duplicates + 1;
    end if;
  end loop;

  update public.wallet_chain_scan_checkpoints
  set last_scanned_block = v_to, updated_at = now()
  where network_key = p_network_key;

  return jsonb_build_object(
    'ok', true, 'network_key', p_network_key,
    'from_block', v_from::text, 'to_block', v_to::text,
    'inserted_events', v_inserted, 'duplicate_events', v_duplicates,
    'checkpoint', v_to::text
  );
end;
$$;

revoke all on function public.commit_wallet_chain_scan_range(text,text,text,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.commit_wallet_chain_scan_range(text,text,text,text,text,boolean,jsonb) to service_role;

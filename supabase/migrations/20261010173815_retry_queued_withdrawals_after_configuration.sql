-- Pause queued withdrawals when infrastructure configuration is missing without losing
-- the durable withdrawal record, and allow the worker to requeue them automatically later.
-- A withdrawal with any broadcast marker or thirdweb transaction ID is never auto-requeued.

CREATE OR REPLACE FUNCTION public.aura_worker_pause_withdrawal(
  p_withdrawal_id uuid,
  p_msg_id bigint,
  p_error text,
  p_delay_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq', 'pg_temp'
AS $function$
declare
  v_withdrawal public.wallet_withdrawals%rowtype;
  v_deleted boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'WORKER_ONLY';
  end if;
  if p_withdrawal_id is null or p_msg_id is null then
    raise exception 'WITHDRAWAL_AND_QUEUE_IDS_REQUIRED';
  end if;

  select * into v_withdrawal
  from public.wallet_withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then return false; end if;
  if v_withdrawal.status <> 'queued'
     or v_withdrawal.tx_hash is not null
     or v_withdrawal.broadcast_at is not null
     or v_withdrawal.confirmed_onchain_at is not null
     or v_withdrawal.provider_transaction_id is not null
     or v_withdrawal.submission_started_at is not null then
    return false;
  end if;

  select pgmq.delete('aura_withdrawals', p_msg_id) into v_deleted;
  if not coalesce(v_deleted, false) then return false; end if;

  update public.wallet_withdrawals
  set queue_message_id = null,
      next_attempt_at = now() + make_interval(secs => greatest(300, least(coalesce(p_delay_seconds,900), 86400))),
      last_worker_error = left(coalesce(p_error, 'Withdrawal is paused pending backend configuration.'), 1500),
      confirmation_attempts = confirmation_attempts + 1,
      updated_at = now()
  where id = p_withdrawal_id and status = 'queued';

  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.aura_worker_enqueue_idle_withdrawals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq', 'pg_temp'
AS $function$
declare
  v_row record;
  v_msg_id bigint;
  v_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'WORKER_ONLY';
  end if;

  for v_row in
    select id
    from public.wallet_withdrawals
    where status = 'queued'
      and queue_message_id is null
      and next_attempt_at is not null
      and next_attempt_at <= now()
      and tx_hash is null
      and broadcast_at is null
      and confirmed_onchain_at is null
      and provider_transaction_id is null
      and submission_started_at is null
    order by next_attempt_at, created_at
    for update skip locked
    limit 20
  loop
    select pgmq.send('aura_withdrawals', jsonb_build_object('withdrawal_id', v_row.id::text))
    into v_msg_id;

    update public.wallet_withdrawals
    set queue_message_id = v_msg_id, updated_at = now()
    where id = v_row.id
      and status = 'queued'
      and queue_message_id is null
      and tx_hash is null
      and provider_transaction_id is null
      and submission_started_at is null;

    if found then
      v_count := v_count + 1;
    else
      perform pgmq.delete('aura_withdrawals', v_msg_id);
    end if;
  end loop;
  return v_count;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.aura_worker_pause_withdrawal(uuid,bigint,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aura_worker_pause_withdrawal(uuid,bigint,text,integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.aura_worker_enqueue_idle_withdrawals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aura_worker_enqueue_idle_withdrawals() TO service_role;

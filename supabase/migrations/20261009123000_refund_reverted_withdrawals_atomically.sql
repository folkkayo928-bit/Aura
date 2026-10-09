create or replace function public.refund_reverted_wallet_withdrawal(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_withdrawal public.wallet_withdrawals%rowtype;
  v_wallet public.wallet_accounts%rowtype;
  v_refund numeric;
  v_existing_refund boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'WORKER_ONLY';
  end if;
  if p_withdrawal_id is null then raise exception 'WITHDRAWAL_ID_REQUIRED'; end if;

  select * into v_withdrawal
  from public.wallet_withdrawals
  where id = p_withdrawal_id
  for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;

  select exists(
    select 1 from public.wallet_ledger
    where user_id = v_withdrawal.user_id
      and kind = 'withdrawal_refund'
      and reference_id = v_withdrawal.id::text
      and direction = 'credit'
  ) into v_existing_refund;
  if v_existing_refund then
    return jsonb_build_object('ok', true, 'already_refunded', true, 'withdrawal_id', v_withdrawal.id);
  end if;

  if v_withdrawal.status <> 'broadcast' then
    raise exception 'WITHDRAWAL_NOT_REFUNDABLE';
  end if;
  if v_withdrawal.tx_hash is null then
    raise exception 'WITHDRAWAL_TX_HASH_REQUIRED';
  end if;

  v_refund := v_withdrawal.amount + v_withdrawal.network_fee;
  select * into v_wallet
  from public.wallet_accounts
  where user_id = v_withdrawal.user_id
  for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;

  update public.wallet_accounts
  set balance_usdt = balance_usdt + v_refund, updated_at = now()
  where id = v_wallet.id;

  insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
  values(v_wallet.id,v_withdrawal.user_id,'credit',v_refund,'withdrawal_refund',
    v_withdrawal.id::text,'Refund for reverted on-chain withdrawal transaction');

  update public.wallet_withdrawals
  set status = 'rejected',
      rejection_reason = 'ONCHAIN_TRANSACTION_REVERTED',
      last_worker_error = 'The broadcast transaction was mined and reverted. Reserved funds were refunded to the AURA wallet.',
      updated_at = now(),
      security_note = 'On-chain transaction reverted; withdrawal reservation was refunded atomically.'
  where id = v_withdrawal.id;

  return jsonb_build_object('ok', true, 'already_refunded', false,
    'withdrawal_id', v_withdrawal.id, 'refund_amount_usdt', v_refund);
end;
$function$;

revoke all on function public.refund_reverted_wallet_withdrawal(uuid) from public, anon, authenticated;
grant execute on function public.refund_reverted_wallet_withdrawal(uuid) to service_role;
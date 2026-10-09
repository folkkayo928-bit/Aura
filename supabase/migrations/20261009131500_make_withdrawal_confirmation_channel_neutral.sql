-- Keep withdrawal confirmation semantics accurate for Telegram-first users.
-- The token is the authorization factor regardless of delivery channel.
create or replace function public.confirm_wallet_withdrawal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_hash text;
  v_confirmation public.wallet_withdrawal_email_confirmations;
  v_withdrawal public.wallet_withdrawals;
  v_message_id bigint;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'INVALID_WITHDRAWAL_CONFIRMATION';
  end if;
  v_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');
  select * into v_confirmation
  from public.wallet_withdrawal_email_confirmations
  where token_hash = v_hash
  for update;
  if not found or v_confirmation.consumed_at is not null or v_confirmation.expires_at <= now() then
    raise exception 'INVALID_OR_EXPIRED_WITHDRAWAL_CONFIRMATION';
  end if;
  select * into v_withdrawal
  from public.wallet_withdrawals
  where id = v_confirmation.withdrawal_id
  for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_withdrawal.status <> 'pending_email_confirmation' then
    raise exception 'WITHDRAWAL_NOT_CONFIRMABLE';
  end if;

  update public.wallet_withdrawal_email_confirmations
  set consumed_at = now()
  where id = v_confirmation.id;

  select pgmq.send('aura_withdrawals', jsonb_build_object('withdrawal_id', v_withdrawal.id::text))
  into v_message_id;

  update public.wallet_withdrawals
  set status = 'queued',
      email_confirmed_at = now(),
      queue_message_id = v_message_id,
      updated_at = now(),
      security_note = 'User confirmed through the secure one-time withdrawal confirmation token; withdrawal queued for server-side blockchain broadcast.'
  where id = v_withdrawal.id
  returning * into v_withdrawal;

  return jsonb_build_object(
    'withdrawal_id', v_withdrawal.id,
    'status', v_withdrawal.status,
    'queued_at', v_withdrawal.updated_at
  );
end;
$$;

revoke all on function public.confirm_wallet_withdrawal(text) from public, anon, authenticated;
grant execute on function public.confirm_wallet_withdrawal(text) to service_role;

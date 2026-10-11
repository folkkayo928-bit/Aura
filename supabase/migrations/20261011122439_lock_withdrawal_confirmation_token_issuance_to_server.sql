create or replace function public.issue_wallet_withdrawal_confirmation_internal(
  p_withdrawal_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_withdrawal public.wallet_withdrawals;
  v_token text;
  v_hash text;
  v_expires timestamptz := now() + interval '30 minutes';
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'WORKER_ONLY';
  end if;
  if p_withdrawal_id is null or p_user_id is null then
    raise exception 'WITHDRAWAL_AND_USER_REQUIRED';
  end if;

  select * into v_withdrawal
    from public.wallet_withdrawals
   where id = p_withdrawal_id
     and user_id = p_user_id
   for update;

  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_withdrawal.status <> 'pending_email_confirmation' then
    raise exception 'WITHDRAWAL_CONFIRMATION_NOT_ALLOWED';
  end if;

  delete from public.wallet_withdrawal_email_confirmations
   where withdrawal_id = v_withdrawal.id
     and consumed_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.wallet_withdrawal_email_confirmations(
    withdrawal_id, user_id, token_hash, expires_at
  ) values (
    v_withdrawal.id, p_user_id, v_hash, v_expires
  );

  return jsonb_build_object(
    'withdrawal_id', v_withdrawal.id,
    'token', v_token,
    'expires_at', v_expires
  );
end;
$function$;

revoke all on function public.issue_wallet_withdrawal_confirmation_internal(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_wallet_withdrawal_confirmation_internal(uuid, uuid)
  to service_role;

-- The old RPC returned the raw confirmation token to the caller's own session.
-- Keep the function for compatibility, but make it unavailable to all client roles.
revoke execute on function public.issue_wallet_withdrawal_email_confirmation(uuid)
  from public, anon, authenticated;

-- Additive idempotency and trusted credit path for verified on-chain USDT deposits.
-- No wallet/deposit tables are replaced or removed.

create unique index if not exists wallet_ledger_onchain_deposit_ref_idx
  on public.wallet_ledger (reference_id)
  where kind = 'onchain_deposit';

create or replace function public.credit_confirmed_wallet_deposit(p_deposit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_deposit public.wallet_deposits%rowtype;
  v_wallet public.wallet_accounts%rowtype;
  v_existing boolean;
begin
  if p_deposit_id is null then
    raise exception 'INVALID_DEPOSIT_ID';
  end if;

  select * into v_deposit
  from public.wallet_deposits
  where id = p_deposit_id
  for update;

  if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
  if v_deposit.amount <= 0 then raise exception 'INVALID_DEPOSIT_AMOUNT'; end if;
  if v_deposit.status not in ('confirmed','credited') then raise exception 'DEPOSIT_NOT_CONFIRMED'; end if;

  if v_deposit.credited_at is not null or v_deposit.status = 'credited' then
    return jsonb_build_object('ok',true,'already_credited',true,'deposit_id',v_deposit.id,'amount_usdt',v_deposit.amount);
  end if;

  select exists(
    select 1 from public.wallet_ledger
    where kind='onchain_deposit'
      and reference_id=v_deposit.id::text
      and direction='credit'
  ) into v_existing;

  if v_existing then
    update public.wallet_deposits
      set status='credited', credited_at=coalesce(credited_at,now())
    where id=v_deposit.id;
    return jsonb_build_object('ok',true,'already_credited',true,'deposit_id',v_deposit.id,'amount_usdt',v_deposit.amount);
  end if;

  select * into v_wallet
  from public.wallet_accounts
  where user_id=v_deposit.user_id
  for update;

  if not found then raise exception 'WALLET_ACCOUNT_NOT_FOUND'; end if;
  if v_wallet.status <> 'active' then raise exception 'WALLET_NOT_ACTIVE'; end if;

  update public.wallet_accounts
    set balance_usdt=balance_usdt+v_deposit.amount, updated_at=now()
  where id=v_wallet.id;

  insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
  values(
    v_wallet.id,v_deposit.user_id,'credit',v_deposit.amount,'onchain_deposit',
    v_deposit.id::text,
    format('Confirmed USDT deposit %s on %s',v_deposit.tx_hash,v_deposit.chain)
  );

  update public.wallet_deposits
    set status='credited', credited_at=now()
  where id=v_deposit.id;

  return jsonb_build_object('ok',true,'already_credited',false,'deposit_id',v_deposit.id,'amount_usdt',v_deposit.amount,'wallet_id',v_wallet.id);
end;
$function$;

revoke all on function public.credit_confirmed_wallet_deposit(uuid) from public;
revoke all on function public.credit_confirmed_wallet_deposit(uuid) from anon;
revoke all on function public.credit_confirmed_wallet_deposit(uuid) from authenticated;
grant execute on function public.credit_confirmed_wallet_deposit(uuid) to service_role;

-- Enable verified USDT deposits and withdrawals on Base, Optimism and Avalanche C-Chain.
-- Purely additive: the four existing networks, every existing wallet balance, ledger entry,
-- deposit, withdrawal and deposit address are left untouched.
--
-- Token contracts and decimals (verified against the official contracts before enabling):
--   Base        8453   0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2  6 decimals
--   Optimism    10     0x94b008aA00579c1307B0EF2c499aD98a8ce58e58  6 decimals
--   Avalanche   43114  0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7  6 decimals
--
-- A chain only becomes usable once the matching treasury signer and (optional) RPC are
-- configured for the deployed Edge Functions. Until then a withdrawal request fails closed
-- and reserves nothing, and no transaction is broadcast.

-- 1. Withdrawal reservation allowlist. Mirrors the BSC rollout pattern: only the accepted
--    chain set changes, the reservation/ledger semantics stay identical.
create or replace function public.request_wallet_withdrawal(
 p_chain text,
 p_token_symbol text,
 p_destination_address text,
 p_amount numeric,
 p_network_fee numeric default 0,
 p_idempotency_key text default null
)
returns public.wallet_withdrawals
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
 v_user uuid := auth.uid();
 v_wallet public.wallet_accounts;
 v_existing public.wallet_withdrawals;
 v_withdrawal public.wallet_withdrawals;
 v_total numeric;
 v_ledger_id uuid;
 v_chain text := lower(trim(coalesce(p_chain,'')));
 v_token text := upper(trim(coalesce(p_token_symbol,'')));
 v_address text := trim(coalesce(p_destination_address,''));
 v_aal text := coalesce(auth.jwt()->>'aal','aal1');
 v_precision integer;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if v_chain not in ('ethereum','polygon','arbitrum','bsc','base','optimism','avalanche') then raise exception 'UNSUPPORTED_REAL_WITHDRAWAL_CHAIN'; end if;
 if v_token <> 'USDT' then raise exception 'UNSUPPORTED_TOKEN'; end if;
 v_precision := case when v_chain = 'bsc' then 8 else 6 end;
 if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
 if p_amount <> round(p_amount,v_precision) then raise exception 'INVALID_AMOUNT_PRECISION'; end if;
 if p_network_fee is null or p_network_fee < 0 then raise exception 'INVALID_NETWORK_FEE'; end if;
 if p_network_fee <> round(p_network_fee,v_precision) then raise exception 'INVALID_NETWORK_FEE_PRECISION'; end if;
 if v_address !~ '^0x[0-9a-fA-F]{40}$' then raise exception 'INVALID_DESTINATION_ADDRESS'; end if;
 if v_aal <> 'aal2' and exists(select 1 from auth.mfa_factors f where f.user_id=v_user and f.factor_type='totp' and f.status='verified') then
   raise exception 'MFA_REQUIRED_FOR_WITHDRAWAL';
 end if;
 if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
   select * into v_existing from public.wallet_withdrawals
   where user_id=v_user and idempotency_key=trim(p_idempotency_key) limit 1;
   if found then return v_existing; end if;
 end if;
 v_total := p_amount + p_network_fee;
 select * into v_wallet from public.wallet_accounts where user_id=v_user and status='active' for update;
 if not found then raise exception 'WALLET_NOT_FOUND'; end if;
 if v_wallet.balance_usdt < v_total then raise exception 'INSUFFICIENT_FUNDS'; end if;
 update public.wallet_accounts set balance_usdt=balance_usdt-v_total, updated_at=now() where id=v_wallet.id;
 insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
 values(v_wallet.id,v_user,'debit',v_total,'withdrawal_reserve',
   coalesce(trim(p_idempotency_key),gen_random_uuid()::text),
   'Withdrawal funds reserved pending secure confirmation')
 returning id into v_ledger_id;
 insert into public.wallet_withdrawals(user_id,chain,token_symbol,destination_address,amount,network_fee,status,idempotency_key,reserved_ledger_id,security_note)
 values(v_user,v_chain,v_token,v_address,p_amount,p_network_fee,'pending_email_confirmation',
   nullif(trim(p_idempotency_key),''),v_ledger_id,
   case when v_aal='aal2'
     then 'Funds reserved after authenticator step-up and secure confirmation; no blockchain broadcast has occurred.'
     else 'Funds reserved atomically; no blockchain broadcast has occurred.' end)
 returning * into v_withdrawal;
 return v_withdrawal;
end;
$function$;

-- 2. Custodial deposit addresses may be provisioned on the new EVM chains.
alter table public.onchain_wallets drop constraint if exists onchain_wallets_chain_check;
alter table public.onchain_wallets add constraint onchain_wallets_chain_check
  check (chain = any (array['ethereum'::text,'polygon'::text,'arbitrum'::text,'bsc'::text,'base'::text,'optimism'::text,'avalanche'::text,'solana'::text,'ton'::text]));

-- 3. The deposit indexer keeps a durable scan cursor per chain, so the new chains need one too.
alter table public.wallet_deposit_scan_cursors drop constraint if exists wallet_deposit_scan_cursors_chain_check;
alter table public.wallet_deposit_scan_cursors add constraint wallet_deposit_scan_cursors_chain_check
  check (chain = any (array['ethereum'::text,'polygon'::text,'arbitrum'::text,'bsc'::text,'base'::text,'optimism'::text,'avalanche'::text]));

-- 4. MetaMask ownership verification uses the same EVM network set as the wallet flow.
alter table public.external_wallet_challenges drop constraint if exists external_wallet_challenges_network_check;
alter table public.external_wallet_challenges add constraint external_wallet_challenges_network_check
  check (network = any (array['ethereum'::text,'polygon'::text,'arbitrum'::text,'bsc'::text,'base'::text,'optimism'::text,'avalanche'::text,'solana'::text]));

alter table public.external_wallets drop constraint if exists external_wallets_network_check;
alter table public.external_wallets add constraint external_wallets_network_check
  check (network = any (array['ton'::text,'ethereum'::text,'polygon'::text,'arbitrum'::text,'bsc'::text,'base'::text,'optimism'::text,'avalanche'::text,'solana'::text]));

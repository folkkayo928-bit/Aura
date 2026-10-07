-- Mirror of the live security changes: dispute resolution audit fields and withdrawal MFA step-up.
create or replace function public.admin_resolve_p2p_dispute(
 p_order_id uuid,p_resolution text,p_reason text
) returns public.p2p_orders language plpgsql security definer set search_path=public as $$
declare
 v_admin uuid:=auth.uid(); v_order public.p2p_orders; v_wallet public.wallet_accounts; v_amount numeric;
begin
 if v_admin is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.aura_can('operator') then raise exception 'ADMIN_ROLE_REQUIRED'; end if;
 if p_resolution not in ('release_to_buyer','refund_seller') then raise exception 'INVALID_RESOLUTION'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'REASON_REQUIRED'; end if;
 select * into v_order from public.p2p_orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if v_order.status<>'in_dispute' then raise exception 'ORDER_NOT_IN_DISPUTE'; end if;
 v_amount:=v_order.crypto_amount;
 if v_order.artwork_id is null then
   if p_resolution='release_to_buyer' then
     select * into v_wallet from public.wallet_accounts where user_id=v_order.buyer_id and status='active' for update;
     if not found then raise exception 'BUYER_WALLET_NOT_FOUND'; end if;
     update public.wallet_accounts set balance_usdt=balance_usdt+v_amount,updated_at=now() where id=v_wallet.id;
     insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
     values(v_wallet.id,v_order.buyer_id,'credit',v_amount,'p2p_dispute_release',v_order.id::text,'P2P dispute resolved: released to buyer');
   else
     select * into v_wallet from public.wallet_accounts where user_id=v_order.seller_id and status='active' for update;
     if not found then raise exception 'SELLER_WALLET_NOT_FOUND'; end if;
     update public.wallet_accounts set balance_usdt=balance_usdt+v_amount,updated_at=now() where id=v_wallet.id;
     insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
     values(v_wallet.id,v_order.seller_id,'credit',v_amount,'p2p_dispute_refund',v_order.id::text,'P2P dispute resolved: refunded to seller');
     update public.p2p_offers set available_crypto=available_crypto+v_amount,is_active=true,updated_at=now() where id=v_order.offer_id;
   end if;
 else
   if p_resolution='release_to_buyer' then
     if exists(select 1 from public.artwork_ownership where artwork_id=v_order.artwork_id and owner_id=v_order.buyer_id) then raise exception 'BUYER_ALREADY_OWNS_ARTWORK'; end if;
     if not exists(select 1 from public.artwork_ownership where artwork_id=v_order.artwork_id and owner_id=v_order.seller_id) then raise exception 'SELLER_NO_LONGER_OWNS_ARTWORK'; end if;
     delete from public.artwork_ownership where artwork_id=v_order.artwork_id and owner_id=v_order.seller_id;
     insert into public.artwork_ownership(artwork_id,owner_id,acquired_at,purchase_price_usdt) values(v_order.artwork_id,v_order.buyer_id,now(),v_amount);
     update public.artworks set is_listed_on_p2p=false,updated_at=now() where id=v_order.artwork_id;
     update public.p2p_offers set available_crypto=0,is_active=false,updated_at=now() where id=v_order.offer_id;
   else
     update public.p2p_offers set available_crypto=greatest(available_crypto,0)+1,is_active=true,updated_at=now() where id=v_order.offer_id;
     update public.artworks set is_listed_on_p2p=true,updated_at=now() where id=v_order.artwork_id;
   end if;
 end if;
 update public.p2p_orders set status=case when p_resolution='release_to_buyer' then 'completed' else 'cancelled' end,
   resolved_at=now(),resolved_by=v_admin,updated_at=now() where id=v_order.id returning * into v_order;
 insert into public.admin_audit_log(admin_user_id,action,entity_type,entity_id,metadata)
 values(v_admin,case when p_resolution='release_to_buyer' then 'p2p_dispute_release' else 'p2p_dispute_refund' end,
 'p2p_order',v_order.id::text,jsonb_build_object('resolution',p_resolution,'reason',left(trim(p_reason),2000),'amount',v_order.crypto_amount));
 perform public.refresh_p2p_trader_stats(v_order.buyer_id);
 perform public.refresh_p2p_trader_stats(v_order.seller_id);
 return v_order;
end $$;

revoke all on function public.admin_resolve_p2p_dispute(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_resolve_p2p_dispute(uuid,text,text) to authenticated;

create or replace function public.request_wallet_withdrawal(
 p_chain text,p_token_symbol text,p_destination_address text,p_amount numeric,p_network_fee numeric default 0,p_idempotency_key text default null
) returns public.wallet_withdrawals language plpgsql security definer set search_path=public,extensions as $$
declare
 v_user uuid:=auth.uid(); v_wallet public.wallet_accounts; v_existing public.wallet_withdrawals; v_withdrawal public.wallet_withdrawals;
 v_total numeric; v_ledger_id uuid; v_aal text:=coalesce(auth.jwt()->>'aal','aal1');
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if lower(trim(coalesce(p_chain,''))) not in ('ethereum','polygon','arbitrum') then raise exception 'UNSUPPORTED_REAL_WITHDRAWAL_CHAIN'; end if;
 if upper(trim(coalesce(p_token_symbol,'')))<>'USDT' then raise exception 'UNSUPPORTED_TOKEN'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
 if p_network_fee is null or p_network_fee<0 then raise exception 'INVALID_NETWORK_FEE'; end if;
 if trim(coalesce(p_destination_address,'')) !~ '^0x[0-9a-fA-F]{40}$' then raise exception 'INVALID_DESTINATION_ADDRESS'; end if;
 if v_aal<>'aal2' and exists(select 1 from auth.mfa_factors where user_id=v_user and factor_type='totp' and status='verified') then raise exception 'MFA_REQUIRED_FOR_WITHDRAWAL'; end if;
 if p_idempotency_key is not null and trim(p_idempotency_key)<>'' then
   select * into v_existing from public.wallet_withdrawals where user_id=v_user and idempotency_key=trim(p_idempotency_key) limit 1;
   if found then return v_existing; end if;
 end if;
 v_total:=p_amount+p_network_fee;
 select * into v_wallet from public.wallet_accounts where user_id=v_user and status='active' for update;
 if not found then raise exception 'WALLET_NOT_FOUND'; end if;
 if v_wallet.balance_usdt<v_total then raise exception 'INSUFFICIENT_FUNDS'; end if;
 update public.wallet_accounts set balance_usdt=balance_usdt-v_total,updated_at=now() where id=v_wallet.id;
 insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
 values(v_wallet.id,v_user,'debit',v_total,'withdrawal_reserve',coalesce(trim(p_idempotency_key),gen_random_uuid()::text),'Withdrawal funds reserved pending email confirmation')
 returning id into v_ledger_id;
 insert into public.wallet_withdrawals(user_id,chain,token_symbol,destination_address,amount,network_fee,status,idempotency_key,reserved_ledger_id,security_note)
 values(v_user,lower(trim(p_chain)),upper(trim(p_token_symbol)),trim(p_destination_address),p_amount,p_network_fee,'pending_email_confirmation',nullif(trim(p_idempotency_key),''),v_ledger_id,
 case when v_aal='aal2' then 'Funds reserved after authenticator step-up and email confirmation; no blockchain broadcast has occurred.' else 'Funds reserved atomically; no blockchain broadcast has occurred.' end)
 returning * into v_withdrawal;
 return v_withdrawal;
end $$;

revoke execute on function public.request_wallet_withdrawal(text,text,text,numeric,numeric,text) from public,anon;
grant execute on function public.request_wallet_withdrawal(text,text,text,numeric,numeric,text) to authenticated;

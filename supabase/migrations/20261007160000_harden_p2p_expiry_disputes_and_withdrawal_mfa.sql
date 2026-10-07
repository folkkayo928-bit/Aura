-- Production hardening applied to Supabase: P2P expiry/dispute audit fields, service-side expiry refunds, and TOTP step-up for withdrawals.
-- This migration mirrors the live production hardening change and is intentionally additive.

alter table public.p2p_orders
  add column if not exists expires_at timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id);

update public.p2p_orders
set expires_at=coalesce(expires_at,created_at+interval '15 minutes')
where expires_at is null and status in ('escrow_locked','payment_marked','in_dispute');

create index if not exists p2p_orders_expiry_idx on public.p2p_orders(status,expires_at) where status in ('escrow_locked','payment_marked');
create index if not exists p2p_orders_dispute_idx on public.p2p_orders(status,disputed_at desc) where status='in_dispute';

create or replace function public.raise_p2p_dispute(p_order_id uuid,p_reason text default null)
returns public.p2p_orders language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_order public.p2p_orders; v_reason text:=nullif(left(trim(coalesce(p_reason,'')),2000),'');
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if v_reason is null then raise exception 'DISPUTE_REASON_REQUIRED'; end if;
 select * into v_order from public.p2p_orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if v_user<>v_order.buyer_id and v_user<>v_order.seller_id then raise exception 'NOT_PARTICIPANT'; end if;
 if v_order.status not in ('escrow_locked','payment_marked') then raise exception 'ORDER_NOT_DISPUTABLE'; end if;
 update public.p2p_orders set status='in_dispute',disputed_at=now(),dispute_reason=v_reason,updated_at=now() where id=p_order_id returning * into v_order;
 insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata) values(v_user,'p2p_dispute_opened','p2p_order',v_order.id::text,jsonb_build_object('reference_code',v_order.reference_code,'reason',v_reason));
 return v_order;
end $$;

revoke execute on function public.raise_p2p_dispute(uuid) from public,anon,authenticated;
grant execute on function public.raise_p2p_dispute(uuid,text) to authenticated;

create or replace function public.expire_p2p_orders()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_count integer:=0; v_wallet public.wallet_accounts;
begin
 if auth.uid() is not null then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 for r in select * from public.p2p_orders where status in ('escrow_locked','payment_marked') and expires_at is not null and expires_at<=now() for update skip locked loop
   if r.artwork_id is null then
     select * into v_wallet from public.wallet_accounts where user_id=r.seller_id and status='active' for update;
     if found then
       update public.wallet_accounts set balance_usdt=balance_usdt+r.crypto_amount,updated_at=now() where id=v_wallet.id;
       insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo) values(v_wallet.id,r.seller_id,'credit',r.crypto_amount,'p2p_escrow_expiry_refund',r.id::text,'P2P order expired; escrow returned');
     end if;
     update public.p2p_offers set available_crypto=available_crypto+r.crypto_amount,is_active=true,updated_at=now() where id=r.offer_id;
   else
     update public.p2p_offers set available_crypto=1,is_active=true,updated_at=now() where id=r.offer_id;
     update public.artworks set is_listed_on_p2p=true,updated_at=now() where id=r.artwork_id;
   end if;
   update public.p2p_orders set status='cancelled',resolved_at=now(),updated_at=now() where id=r.id;
   perform public.refresh_p2p_trader_stats(r.buyer_id); perform public.refresh_p2p_trader_stats(r.seller_id); v_count:=v_count+1;
 end loop;
 return v_count;
end $$;

revoke all on function public.expire_p2p_orders() from public,anon,authenticated;
grant execute on function public.expire_p2p_orders() to service_role;

do $$ begin
 if not exists(select 1 from cron.job where jobname='aura-p2p-expiry') then
   perform cron.schedule('aura-p2p-expiry','*/1 * * * *',$cron$select public.expire_p2p_orders();$cron$);
 end if;
end $$;

-- Withdrawal step-up is enforced in the live function: verified TOTP users must complete an AAL2 MFA challenge before funds can be reserved.

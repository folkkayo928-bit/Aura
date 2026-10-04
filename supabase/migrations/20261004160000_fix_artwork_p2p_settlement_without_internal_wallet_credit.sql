create or replace function public.complete_p2p_order(p_order_id uuid)
returns public.p2p_orders
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.p2p_orders;
  v_wallet public.wallet_accounts;
  v_art public.artworks;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_order
    from public.p2p_orders
   where id = p_order_id
   for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user <> v_order.seller_id then raise exception 'ONLY_SELLER_CAN_RELEASE'; end if;
  if v_order.status <> 'payment_marked' then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;

  if v_order.artwork_id is not null then
    select * into v_art
      from public.artworks
     where id = v_order.artwork_id
     for update;

    if not found then raise exception 'ARTWORK_NOT_FOUND'; end if;

    if not exists (
      select 1 from public.artwork_ownership
       where artwork_id = v_order.artwork_id
         and owner_id = v_order.seller_id
       for update
    ) then
      raise exception 'SELLER_NO_LONGER_OWNS_ARTWORK';
    end if;

    if exists (
      select 1 from public.artwork_ownership
       where artwork_id = v_order.artwork_id
         and owner_id = v_order.buyer_id
    ) then
      raise exception 'BUYER_ALREADY_OWNS_ARTWORK';
    end if;

    delete from public.artwork_ownership
     where artwork_id = v_order.artwork_id
       and owner_id = v_order.seller_id;

    insert into public.artwork_ownership(
      artwork_id, owner_id, purchase_price_usdt, acquired_at, updated_at
    ) values (
      v_order.artwork_id, v_order.buyer_id, v_order.fiat_amount, now(), now()
    );

    update public.artworks
       set is_listed_on_p2p = false
     where id = v_order.artwork_id;

    update public.p2p_offers
       set is_active = false, available_crypto = 0
     where id = v_order.offer_id;

    update public.p2p_orders
       set status = 'completed'
     where id = v_order.id
    returning * into v_order;

    insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata)
    values
      (v_order.seller_id,'artwork_p2p_sold','artwork',v_order.artwork_id::text,
       jsonb_build_object('order_id',v_order.id,'reference_code',v_order.reference_code,'fiat_amount',v_order.fiat_amount,'currency',v_order.fiat_currency)),
      (v_order.buyer_id,'artwork_p2p_collected','artwork',v_order.artwork_id::text,
       jsonb_build_object('order_id',v_order.id,'reference_code',v_order.reference_code,'fiat_amount',v_order.fiat_amount,'currency',v_order.fiat_currency));

    return v_order;
  end if;

  select * into v_wallet
    from public.wallet_accounts
   where user_id = v_order.buyer_id
     and status = 'active'
   for update;

  if not found then raise exception 'BUYER_WALLET_UNAVAILABLE'; end if;

  update public.wallet_accounts
     set balance_usdt = balance_usdt + v_order.crypto_amount
   where id = v_wallet.id;

  update public.p2p_orders
     set status = 'completed'
   where id = v_order.id
  returning * into v_order;

  insert into public.wallet_ledger(
    wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo
  ) values (
    v_wallet.id,v_order.buyer_id,'credit',v_order.crypto_amount,
    'p2p_release',v_order.id::text,'P2P escrow released'
  );

  insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata)
  values
    (v_order.seller_id,'p2p_trade_completed','p2p_order',v_order.id::text,
     jsonb_build_object('reference_code',v_order.reference_code,'role','seller')),
    (v_order.buyer_id,'p2p_trade_completed','p2p_order',v_order.id::text,
     jsonb_build_object('reference_code',v_order.reference_code,'role','buyer'));

  return v_order;
end;
$function$;

revoke execute on function public.complete_p2p_order(uuid) from anon;
grant execute on function public.complete_p2p_order(uuid) to authenticated;

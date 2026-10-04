
create or replace function public.create_p2p_offer(
  p_type text,
  p_price_per_unit numeric,
  p_fiat_currency text,
  p_available_crypto numeric,
  p_min_limit_fiat numeric,
  p_max_limit_fiat numeric,
  p_payment_methods jsonb,
  p_payment_instructions text default null,
  p_artwork_id uuid default null
)
returns public.p2p_offers
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_offer public.p2p_offers;
  v_balance numeric;
  v_art public.artworks;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('buy','sell') then raise exception 'INVALID_OFFER_TYPE'; end if;
  if p_price_per_unit is null or p_price_per_unit <= 0 then raise exception 'INVALID_PRICE'; end if;
  if p_available_crypto is null or p_available_crypto <= 0 then raise exception 'INVALID_LIQUIDITY'; end if;
  if p_min_limit_fiat is null or p_min_limit_fiat < 0 or p_max_limit_fiat < p_min_limit_fiat then raise exception 'INVALID_LIMITS'; end if;
  if p_fiat_currency not in ('USD','EUR','GBP') then raise exception 'INVALID_FIAT_CURRENCY'; end if;

  if p_artwork_id is not null then
    if p_type <> 'sell' then raise exception 'ARTWORK_OFFERS_MUST_BE_SELL'; end if;
    if p_available_crypto <> 1 then raise exception 'ARTWORK_OFFER_QUANTITY_MUST_BE_ONE'; end if;

    select * into v_art
      from public.artworks
     where id = p_artwork_id and published = true
     for update;

    if not found then raise exception 'ARTWORK_NOT_FOUND'; end if;

    if not exists (
      select 1 from public.artwork_ownership
       where artwork_id = p_artwork_id and owner_id = v_user
    ) then
      raise exception 'NOT_ARTWORK_OWNER';
    end if;

    if v_art.is_listed_on_p2p then raise exception 'ARTWORK_ALREADY_LISTED'; end if;
  elsif p_type = 'sell' then
    select balance_usdt into v_balance
      from public.wallet_accounts
     where user_id = v_user and status = 'active';

    if coalesce(v_balance,0) < p_available_crypto then raise exception 'INSUFFICIENT_FUNDS'; end if;
  end if;

  insert into public.p2p_offers(
    merchant_id,type,artwork_id,price_per_unit,fiat_currency,
    available_crypto,min_limit_fiat,max_limit_fiat,payment_methods,
    payment_instructions,is_active
  )
  values(
    v_user,p_type,p_artwork_id,p_price_per_unit,p_fiat_currency,
    p_available_crypto,p_min_limit_fiat,p_max_limit_fiat,
    coalesce(p_payment_methods,'[]'::jsonb),
    nullif(trim(p_payment_instructions),''),
    true
  )
  returning * into v_offer;

  if p_artwork_id is not null then
    update public.artworks
       set is_listed_on_p2p = true,
           p2p_price_fiat = p_price_per_unit,
           p2p_currency = p_fiat_currency,
           p2p_payment_methods = coalesce(p_payment_methods,'[]'::jsonb)
     where id = p_artwork_id;
  end if;

  return v_offer;
end;
$function$;

create or replace function public.create_p2p_order(
  p_offer_id uuid,
  p_crypto_amount numeric,
  p_payment_method text,
  p_payment_details jsonb
)
returns public.p2p_orders
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_offer public.p2p_offers;
  v_buyer uuid;
  v_seller uuid;
  v_order public.p2p_orders;
  v_ref text;
  v_payment_details jsonb;
  v_account_number text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_crypto_amount is null or p_crypto_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_payment_method is null or trim(p_payment_method) = '' then raise exception 'INVALID_PAYMENT_METHOD'; end if;

  select * into v_offer
    from public.p2p_offers
   where id = p_offer_id and is_active = true
   for update;

  if not found then raise exception 'OFFER_NOT_FOUND'; end if;

  if jsonb_array_length(coalesce(v_offer.payment_methods, '[]'::jsonb)) > 0
     and not exists (
       select 1 from jsonb_array_elements_text(v_offer.payment_methods) method
        where method = trim(p_payment_method)
     )
  then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_crypto_amount * v_offer.price_per_unit < v_offer.min_limit_fiat
     or p_crypto_amount * v_offer.price_per_unit > v_offer.max_limit_fiat
  then
    raise exception 'OUTSIDE_TRADE_LIMITS';
  end if;

  if p_crypto_amount > v_offer.available_crypto then raise exception 'INSUFFICIENT_OFFER_LIQUIDITY'; end if;

  if v_offer.artwork_id is not null then
    if v_offer.type <> 'sell' or p_crypto_amount <> 1 then raise exception 'INVALID_ARTWORK_ORDER'; end if;
    if not exists (
      select 1 from public.artwork_ownership
       where artwork_id = v_offer.artwork_id and owner_id = v_offer.merchant_id
    ) then raise exception 'ARTWORK_NOT_AVAILABLE'; end if;
    if v_user = v_offer.merchant_id then raise exception 'SELF_TRADE_NOT_ALLOWED'; end if;

    v_buyer := v_user;
    v_seller := v_offer.merchant_id;
    v_payment_details := jsonb_build_object(
      'accountName', coalesce(
        (select display_name from public.profiles where id = v_seller),
        'AURA Seller'
      ),
      'accountNumberOrId', coalesce(
        v_offer.payment_instructions,
        'Use the payment method shown in this offer.'
      )
    );
  else
    if v_offer.type = 'sell' then
      v_buyer := v_user;
      v_seller := v_offer.merchant_id;
      v_payment_details := jsonb_build_object(
        'accountName', coalesce(
          (select display_name from public.profiles where id = v_offer.merchant_id),
          'AURA P2P Counterparty'
        ),
        'accountNumberOrId', coalesce(
          v_offer.payment_instructions,
          'Use the payment method shown in this offer.'
        )
      );
    else
      v_buyer := v_offer.merchant_id;
      v_seller := v_user;
      v_account_number := trim(coalesce(p_payment_details->>'accountNumberOrId', ''));
      if v_account_number = '' then raise exception 'SELLER_PAYMENT_ACCOUNT_REQUIRED'; end if;

      v_payment_details := jsonb_build_object(
        'accountName', coalesce(
          nullif(trim(p_payment_details->>'accountName'), ''),
          (select display_name from public.profiles where id = v_user),
          'AURA Seller'
        ),
        'accountNumberOrId', v_account_number
      );
    end if;

    if v_buyer = v_seller then raise exception 'SELF_TRADE_NOT_ALLOWED'; end if;

    update public.wallet_accounts
       set balance_usdt = balance_usdt - p_crypto_amount
     where user_id = v_seller and status = 'active' and balance_usdt >= p_crypto_amount;

    if not found then raise exception 'INSUFFICIENT_SELLER_FUNDS'; end if;
  end if;

  loop
    v_ref := 'AURA-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
    exit when not exists(select 1 from public.p2p_orders where reference_code = v_ref);
  end loop;

  v_payment_details := v_payment_details || jsonb_build_object('referenceCode', v_ref);

  insert into public.p2p_orders(
    offer_id,buyer_id,seller_id,type,crypto_amount,fiat_amount,fiat_currency,
    payment_method,status,reference_code,payment_details,escrow_reference,artwork_id
  )
  values(
    v_offer.id,v_buyer,v_seller,v_offer.type,p_crypto_amount,
    p_crypto_amount * v_offer.price_per_unit,v_offer.fiat_currency,
    trim(p_payment_method),'escrow_locked',v_ref,v_payment_details,v_ref,v_offer.artwork_id
  )
  returning * into v_order;

  update public.p2p_offers
     set available_crypto = available_crypto - p_crypto_amount,
         is_active = case when available_crypto - p_crypto_amount <= 0 then false else is_active end
   where id = v_offer.id;

  if v_offer.artwork_id is null then
    insert into public.wallet_ledger(
      wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo
    )
    select id,v_seller,'debit',p_crypto_amount,'p2p_escrow_lock',v_order.id::text,'P2P funds locked'
      from public.wallet_accounts
     where user_id = v_seller;
  end if;

  return v_order;
end;
$function$;

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

  select * into v_order from public.p2p_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user <> v_order.seller_id then raise exception 'ONLY_SELLER_CAN_RELEASE'; end if;
  if v_order.status <> 'payment_marked' then raise exception 'PAYMENT_NOT_MARKED'; end if;

  if v_order.artwork_id is not null then
    select * into v_art from public.artworks where id = v_order.artwork_id for update;
    if not found then raise exception 'ARTWORK_NOT_FOUND'; end if;

    if not exists (
      select 1 from public.artwork_ownership
       where artwork_id = v_order.artwork_id and owner_id = v_order.seller_id
    ) then
      raise exception 'SELLER_NO_LONGER_OWNS_ARTWORK';
    end if;

    if exists (
      select 1 from public.artwork_ownership
       where artwork_id = v_order.artwork_id and owner_id = v_order.buyer_id
    ) then
      raise exception 'BUYER_ALREADY_OWNS_ARTWORK';
    end if;

    delete from public.artwork_ownership
     where artwork_id = v_order.artwork_id and owner_id = v_order.seller_id;

    insert into public.artwork_ownership(artwork_id,owner_id,purchase_price_usdt)
    values(v_order.artwork_id,v_order.buyer_id,v_art.current_value_usdt);

    update public.artworks set is_listed_on_p2p = false where id = v_order.artwork_id;

    update public.p2p_orders
       set status = 'completed'
     where id = v_order.id
    returning * into v_order;

    update public.p2p_offers
       set is_active = false, available_crypto = 0
     where id = v_order.offer_id;

    insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata)
    values
      (v_order.seller_id,'artwork_p2p_sold','artwork',v_order.artwork_id::text,
       jsonb_build_object('fiat_amount',v_order.fiat_amount,'currency',v_order.fiat_currency,'order_id',v_order.id)),
      (v_order.buyer_id,'artwork_p2p_collected','artwork',v_order.artwork_id::text,
       jsonb_build_object('fiat_amount',v_order.fiat_amount,'currency',v_order.fiat_currency,'order_id',v_order.id));

    return v_order;
  end if;

  select * into v_wallet from public.wallet_accounts where user_id = v_order.buyer_id for update;
  if not found then raise exception 'BUYER_WALLET_UNAVAILABLE'; end if;

  update public.wallet_accounts set balance_usdt = balance_usdt + v_order.crypto_amount where id = v_wallet.id;

  update public.p2p_orders
     set status = 'completed'
   where id = v_order.id
  returning * into v_order;

  insert into public.wallet_ledger(
    wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo
  )
  values(
    v_wallet.id,v_order.buyer_id,'credit',v_order.crypto_amount,
    'p2p_escrow_release',v_order.id::text,'P2P escrow release'
  );

  return v_order;
end;
$function$;

create or replace function public.cancel_p2p_order(p_order_id uuid)
returns public.p2p_orders
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.p2p_orders;
  v_wallet public.wallet_accounts;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_order from public.p2p_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user <> v_order.buyer_id and v_user <> v_order.seller_id then raise exception 'NOT_PARTICIPANT'; end if;
  if v_order.status <> 'escrow_locked' then raise exception 'ORDER_NOT_CANCELLABLE'; end if;

  if v_order.artwork_id is not null then
    update public.p2p_orders
       set status = 'cancelled'
     where id = v_order.id
    returning * into v_order;

    update public.p2p_offers
       set available_crypto = 1, is_active = true
     where id = v_order.offer_id;

    insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata)
    values(
      v_user,'artwork_p2p_cancelled','artwork',v_order.artwork_id::text,
      jsonb_build_object('order_id',v_order.id)
    );

    return v_order;
  end if;

  select * into v_wallet
    from public.wallet_accounts
   where user_id = v_order.seller_id
   for update;

  if not found then raise exception 'SELLER_WALLET_UNAVAILABLE'; end if;

  update public.wallet_accounts set balance_usdt = balance_usdt + v_order.crypto_amount where id = v_wallet.id;

  update public.p2p_orders
     set status = 'cancelled'
   where id = v_order.id
  returning * into v_order;

  update public.p2p_offers
     set available_crypto = available_crypto + v_order.crypto_amount,
         is_active = true
   where id = v_order.offer_id;

  insert into public.wallet_ledger(
    wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo
  )
  values(
    v_wallet.id,v_order.seller_id,'credit',v_order.crypto_amount,
    'p2p_escrow_refund',v_order.id::text,'P2P escrow refund'
  );

  return v_order;
end;
$function$;

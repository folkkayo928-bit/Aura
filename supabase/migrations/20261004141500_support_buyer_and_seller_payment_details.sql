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

  select *
    into v_offer
    from public.p2p_offers
   where id = p_offer_id
     and is_active = true
   for update;

  if not found then raise exception 'OFFER_NOT_FOUND'; end if;

  if jsonb_array_length(coalesce(v_offer.payment_methods, '[]'::jsonb)) > 0
     and not exists (
       select 1
         from jsonb_array_elements_text(v_offer.payment_methods) method
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

  if p_crypto_amount > v_offer.available_crypto then
    raise exception 'INSUFFICIENT_OFFER_LIQUIDITY';
  end if;

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
    if v_account_number = '' then
      raise exception 'SELLER_PAYMENT_ACCOUNT_REQUIRED';
    end if;

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
   where user_id = v_seller
     and status = 'active'
     and balance_usdt >= p_crypto_amount;

  if not found then raise exception 'INSUFFICIENT_SELLER_FUNDS'; end if;

  loop
    v_ref := 'AURA-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
    exit when not exists (select 1 from public.p2p_orders where reference_code = v_ref);
  end loop;

  v_payment_details := v_payment_details || jsonb_build_object('referenceCode', v_ref);

  insert into public.p2p_orders(
    offer_id, buyer_id, seller_id, type, crypto_amount, fiat_amount,
    fiat_currency, payment_method, status, reference_code, payment_details,
    escrow_reference, artwork_id
  )
  values(
    v_offer.id, v_buyer, v_seller, v_offer.type, p_crypto_amount,
    p_crypto_amount * v_offer.price_per_unit, v_offer.fiat_currency,
    trim(p_payment_method), 'escrow_locked', v_ref, v_payment_details,
    v_ref, v_offer.artwork_id
  )
  returning * into v_order;

  update public.p2p_offers
     set available_crypto = available_crypto - p_crypto_amount,
         is_active = case
           when available_crypto - p_crypto_amount <= 0 then false
           else is_active
         end
   where id = v_offer.id;

  insert into public.wallet_ledger(
    wallet_id, user_id, direction, amount_usdt, kind, reference_id, memo
  )
  select id, v_seller, 'debit', p_crypto_amount,
         'p2p_escrow_lock', v_order.id::text, 'P2P funds locked'
    from public.wallet_accounts
   where user_id = v_seller;

  return v_order;
end;
$function$;

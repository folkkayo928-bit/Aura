-- Keep legacy accepted sell orders cancellable only when their escrow debit is proven.
-- This preserves old valid trades without permitting an unbacked wallet credit.
CREATE OR REPLACE FUNCTION public.cancel_p2p_order(p_order_id uuid)
RETURNS public.p2p_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_order public.p2p_orders;
  v_wallet public.wallet_accounts;
  v_other uuid;
  v_offer_reserved boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_order
    FROM public.p2p_orders
   WHERE id = p_order_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_user <> v_order.buyer_id AND v_user <> v_order.seller_id THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT';
  END IF;
  IF v_order.status <> 'escrow_locked' THEN RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE'; END IF;

  v_other := CASE WHEN v_user = v_order.buyer_id THEN v_order.seller_id ELSE v_order.buyer_id END;

  IF v_order.artwork_id IS NULL AND v_order.type = 'buy' THEN
    -- A buy-offer order debits the user who is selling into that offer.
    SELECT * INTO v_wallet
      FROM public.wallet_accounts
     WHERE user_id = v_order.seller_id AND status = 'active'
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'SELLER_WALLET_UNAVAILABLE'; END IF;

    UPDATE public.wallet_accounts
       SET balance_usdt = balance_usdt + v_order.crypto_amount, updated_at = now()
     WHERE id = v_wallet.id;

    INSERT INTO public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
    VALUES(v_wallet.id,v_order.seller_id,'credit',v_order.crypto_amount,
           'p2p_escrow_refund',v_order.id::text,'P2P Buy-offer order cancelled; USDT returned');

    UPDATE public.p2p_offers
       SET available_crypto = available_crypto + v_order.crypto_amount,
           is_active = true, updated_at = now()
     WHERE id = v_order.offer_id;

    UPDATE public.p2p_orders
       SET status = 'cancelled', resolved_at = now(), updated_at = now()
     WHERE id = v_order.id
     RETURNING * INTO v_order;

  ELSIF v_order.accepted_at IS NULL THEN
    -- Before acceptance, sell-offer funds remain reserved by the offer itself.
    UPDATE public.p2p_orders
       SET status = 'cancelled', resolved_at = now(), updated_at = now()
     WHERE id = v_order.id
     RETURNING * INTO v_order;

    UPDATE public.p2p_offers
       SET available_crypto = available_crypto + v_order.crypto_amount,
           is_active = true, updated_at = now()
     WHERE id = v_order.offer_id AND funds_reserved = true;

  ELSIF v_order.artwork_id IS NOT NULL THEN
    UPDATE public.p2p_orders
       SET status = 'cancelled', resolved_at = now(), updated_at = now()
     WHERE id = v_order.id
     RETURNING * INTO v_order;

    UPDATE public.p2p_offers
       SET available_crypto = 1, is_active = true, updated_at = now()
     WHERE id = v_order.offer_id;

    UPDATE public.artworks
       SET is_listed_on_p2p = true, updated_at = now()
     WHERE id = v_order.artwork_id;

  ELSE
    SELECT funds_reserved INTO v_offer_reserved
      FROM public.p2p_offers
     WHERE id = v_order.offer_id
     FOR UPDATE;

    IF v_offer_reserved IS DISTINCT FROM true THEN
      -- The legacy acceptance path debited this exact order ID. Refund only if
      -- that debit exists; otherwise preserve the order for manual reconciliation.
      IF NOT EXISTS (
        SELECT 1
          FROM public.wallet_ledger
         WHERE user_id = v_order.seller_id
           AND kind = 'p2p_escrow_lock'
           AND direction = 'debit'
           AND reference_id = v_order.id::text
           AND amount_usdt = v_order.crypto_amount
      ) THEN
        RAISE EXCEPTION 'LEGACY_SELL_ORDER_REQUIRES_ADMIN_REVIEW';
      END IF;

      SELECT * INTO v_wallet
        FROM public.wallet_accounts
       WHERE user_id = v_order.seller_id AND status = 'active'
       FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'SELLER_WALLET_UNAVAILABLE'; END IF;

      UPDATE public.wallet_accounts
         SET balance_usdt = balance_usdt + v_order.crypto_amount, updated_at = now()
       WHERE id = v_wallet.id;

      INSERT INTO public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
      VALUES(v_wallet.id,v_order.seller_id,'credit',v_order.crypto_amount,
             'p2p_escrow_refund',v_order.id::text,'Legacy P2P sell-order cancellation; verified escrow debit returned');

      UPDATE public.p2p_orders
         SET status = 'cancelled', resolved_at = now(), updated_at = now()
       WHERE id = v_order.id
       RETURNING * INTO v_order;

      -- Legacy offers were not fully reserved at creation; do not reopen them.
      UPDATE public.p2p_offers
         SET available_crypto = available_crypto + v_order.crypto_amount,
             is_active = false, updated_at = now()
       WHERE id = v_order.offer_id;
    ELSE
      UPDATE public.p2p_orders
         SET status = 'cancelled', resolved_at = now(), updated_at = now()
       WHERE id = v_order.id
       RETURNING * INTO v_order;

      UPDATE public.p2p_offers
         SET available_crypto = available_crypto + v_order.crypto_amount,
             is_active = true, updated_at = now()
       WHERE id = v_order.offer_id AND funds_reserved = true;
    END IF;
  END IF;

  INSERT INTO public.notifications(user_id,title,message,type)
  VALUES(v_other,'❌ P2P order cancelled',
    'Order #' || v_order.reference_code ||
    ' was cancelled. Any held USDT was returned according to the trade state.','p2p');

  RETURN v_order;
END;
$function$;

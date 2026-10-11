-- Prevent P2P settlement from creating USDT when a legacy sell offer has no reserved funds.
-- This trigger is additive and leaves existing offers/orders untouched.
CREATE OR REPLACE FUNCTION public.require_reserved_p2p_sell_offer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
  v_reserved boolean;
  v_artwork_id uuid;
BEGIN
  SELECT type, funds_reserved, artwork_id
    INTO v_type, v_reserved, v_artwork_id
    FROM public.p2p_offers
   WHERE id = NEW.offer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFER_NOT_FOUND';
  END IF;

  IF v_type = 'sell'
     AND v_artwork_id IS NULL
     AND coalesce(v_reserved, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'SELL_OFFER_NOT_ESCROWED: This offer cannot create a trade until its USDT is safely reserved.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS require_reserved_p2p_sell_offer ON public.p2p_orders;
CREATE TRIGGER require_reserved_p2p_sell_offer
BEFORE INSERT ON public.p2p_orders
FOR EACH ROW
EXECUTE FUNCTION public.require_reserved_p2p_sell_offer();

-- Fix cancellation accounting: for current sell offers, funds were reserved when
-- the offer was posted. Cancelling an accepted order must restore offer liquidity,
-- not credit the seller's wallet a second time.
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
    -- A buyer's buy offer does not reserve the buyer's USDT. The order creator
    -- (seller) had their amount debited when the order was created.
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
      -- Legacy accepted orders without escrow must be reviewed manually; do not
      -- create a refund or silently cancel a potentially disputed fiat payment.
      RAISE EXCEPTION 'LEGACY_SELL_ORDER_REQUIRES_ADMIN_REVIEW';
    END IF;

    UPDATE public.p2p_orders
       SET status = 'cancelled', resolved_at = now(), updated_at = now()
     WHERE id = v_order.id
     RETURNING * INTO v_order;

    UPDATE public.p2p_offers
       SET available_crypto = available_crypto + v_order.crypto_amount,
           is_active = true, updated_at = now()
     WHERE id = v_order.offer_id AND funds_reserved = true;
  END IF;

  INSERT INTO public.notifications(user_id,title,message,type)
  VALUES(v_other,'❌ P2P order cancelled',
    'Order #' || v_order.reference_code ||
    ' was cancelled. Any held USDT was returned according to the trade state.','p2p');

  RETURN v_order;
END;
$function$;

REVOKE ALL ON FUNCTION public.require_reserved_p2p_sell_offer() FROM PUBLIC, anon, authenticated;

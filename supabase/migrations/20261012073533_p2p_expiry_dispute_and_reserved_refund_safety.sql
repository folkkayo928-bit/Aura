-- Protect AURA P2P escrow on timeouts and dispute refunds.
-- Additive function replacements only; do not mutate existing wallet balances or orders.
CREATE OR REPLACE FUNCTION public.expire_p2p_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count integer := 0;
  v_wallet public.wallet_accounts;
  v_offer public.p2p_offers;
  v_has_escrow_debit boolean;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  FOR r IN
    SELECT *
      FROM public.p2p_orders
     WHERE status IN ('escrow_locked', 'payment_marked')
       AND expires_at IS NOT NULL
       AND expires_at <= now()
     FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_offer
      FROM public.p2p_offers
     WHERE id = r.offer_id
     FOR UPDATE;

    IF NOT FOUND THEN
      UPDATE public.p2p_orders
         SET status = 'in_dispute',
             disputed_at = coalesce(disputed_at, now()),
             dispute_reason = coalesce(dispute_reason, 'Automatic review: P2P offer is missing during expiry processing.'),
             expires_at = NULL,
             updated_at = now()
       WHERE id = r.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    -- Payment evidence was submitted. Keep the held asset untouched and require
    -- a human review; a timer is not evidence that fiat was or was not paid.
    IF r.status = 'payment_marked' THEN
      UPDATE public.p2p_orders
         SET status = 'in_dispute',
             disputed_at = coalesce(disputed_at, now()),
             dispute_reason = coalesce(dispute_reason, 'Automatic review: payment proof was submitted but the seller release window expired. Verify the actual fiat payment before resolving.'),
             expires_at = NULL,
             updated_at = now()
       WHERE id = r.id;
      PERFORM public.refresh_p2p_trader_stats(r.buyer_id);
      PERFORM public.refresh_p2p_trader_stats(r.seller_id);
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    -- Artwork is never refunded as USDT. Restore exactly one listing slot.
    IF r.artwork_id IS NOT NULL THEN
      UPDATE public.p2p_offers
         SET available_crypto = 1,
             is_active = true,
             updated_at = now()
       WHERE id = r.offer_id;

      UPDATE public.artworks
         SET is_listed_on_p2p = true,
             updated_at = now()
       WHERE id = r.artwork_id;

    ELSIF r.type = 'buy' THEN
      -- The seller's USDT is debited when this buy-offer order is created.
      SELECT * INTO v_wallet
        FROM public.wallet_accounts
       WHERE user_id = r.seller_id
         AND status = 'active'
       FOR UPDATE;

      IF NOT FOUND THEN
        UPDATE public.p2p_orders
           SET status = 'in_dispute',
               disputed_at = coalesce(disputed_at, now()),
               dispute_reason = coalesce(dispute_reason, 'Automatic review: seller wallet is unavailable for safe escrow refund.'),
               expires_at = NULL,
               updated_at = now()
         WHERE id = r.id;
        PERFORM public.refresh_p2p_trader_stats(r.buyer_id);
        PERFORM public.refresh_p2p_trader_stats(r.seller_id);
        v_count := v_count + 1;
        CONTINUE;
      END IF;

      UPDATE public.wallet_accounts
         SET balance_usdt = balance_usdt + r.crypto_amount,
             updated_at = now()
       WHERE id = v_wallet.id;

      INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, amount_usdt, kind, reference_id, memo)
      VALUES (v_wallet.id, r.seller_id, 'credit', r.crypto_amount,
              'p2p_escrow_expiry_refund', r.id::text,
              'P2P buy-offer order expired before payment; seller escrow returned');

      UPDATE public.p2p_offers
         SET available_crypto = available_crypto + r.crypto_amount,
             is_active = true,
             updated_at = now()
       WHERE id = r.offer_id;

    ELSIF v_offer.funds_reserved IS TRUE THEN
      -- A current sell offer was already debited when it was posted. Its crypto
      -- remains reserved; only restore the quantity that the timed-out order used.
      UPDATE public.p2p_offers
         SET available_crypto = available_crypto + r.crypto_amount,
             is_active = (available_crypto + r.crypto_amount) > 0,
             updated_at = now()
       WHERE id = r.offer_id;

    ELSE
      -- Legacy sell offers are disabled for new orders. Refund only a proven,
      -- order-specific escrow debit; never manufacture funds for legacy data.
      SELECT EXISTS (
        SELECT 1
          FROM public.wallet_ledger
         WHERE user_id = r.seller_id
           AND kind = 'p2p_escrow_lock'
           AND direction = 'debit'
           AND reference_id = r.id::text
           AND amount_usdt = r.crypto_amount
      ) INTO v_has_escrow_debit;

      IF NOT v_has_escrow_debit THEN
        UPDATE public.p2p_orders
           SET status = 'in_dispute',
               disputed_at = coalesce(disputed_at, now()),
               dispute_reason = coalesce(dispute_reason, 'Automatic review: legacy sell order has no matching escrow debit; no automatic refund was issued.'),
               expires_at = NULL,
               updated_at = now()
         WHERE id = r.id;
        PERFORM public.refresh_p2p_trader_stats(r.buyer_id);
        PERFORM public.refresh_p2p_trader_stats(r.seller_id);
        v_count := v_count + 1;
        CONTINUE;
      END IF;

      SELECT * INTO v_wallet
        FROM public.wallet_accounts
       WHERE user_id = r.seller_id
         AND status = 'active'
       FOR UPDATE;

      IF NOT FOUND THEN
        UPDATE public.p2p_orders
           SET status = 'in_dispute',
               disputed_at = coalesce(disputed_at, now()),
               dispute_reason = coalesce(dispute_reason, 'Automatic review: legacy seller wallet is unavailable for safe escrow refund.'),
               expires_at = NULL,
               updated_at = now()
         WHERE id = r.id;
        PERFORM public.refresh_p2p_trader_stats(r.buyer_id);
        PERFORM public.refresh_p2p_trader_stats(r.seller_id);
        v_count := v_count + 1;
        CONTINUE;
      END IF;

      UPDATE public.wallet_accounts
         SET balance_usdt = balance_usdt + r.crypto_amount,
             updated_at = now()
       WHERE id = v_wallet.id;

      INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, amount_usdt, kind, reference_id, memo)
      VALUES (v_wallet.id, r.seller_id, 'credit', r.crypto_amount,
              'p2p_escrow_expiry_refund', r.id::text,
              'Legacy P2P sell escrow returned after verifying order-specific debit');

      -- Never reopen a legacy offer that wasn't reserved when it was posted.
      UPDATE public.p2p_offers
         SET available_crypto = available_crypto + r.crypto_amount,
             is_active = false,
             updated_at = now()
       WHERE id = r.offer_id;
    END IF;

    UPDATE public.p2p_orders
       SET status = 'cancelled',
           resolved_at = now(),
           updated_at = now()
     WHERE id = r.id;

    PERFORM public.refresh_p2p_trader_stats(r.buyer_id);
    PERFORM public.refresh_p2p_trader_stats(r.seller_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$

CREATE OR REPLACE FUNCTION public.admin_resolve_p2p_dispute(p_order_id uuid, p_resolution text, p_reason text)
 RETURNS p2p_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_order public.p2p_orders;
  v_art public.artworks;
  v_offer public.p2p_offers;
  v_buyer_wallet public.wallet_accounts;
  v_seller_wallet public.wallet_accounts;
  v_amount numeric;
  v_existing_credit numeric;
BEGIN
  IF v_admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.aura_can('operator') THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  IF p_resolution NOT IN ('release_to_buyer', 'refund_seller') THEN RAISE EXCEPTION 'INVALID_RESOLUTION'; END IF;
  IF nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;

  SELECT * INTO v_order
    FROM public.p2p_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.status <> 'in_dispute' THEN RAISE EXCEPTION 'ORDER_NOT_IN_DISPUTE'; END IF;

  v_amount := v_order.crypto_amount;

  SELECT * INTO v_offer
    FROM public.p2p_offers
   WHERE id = v_order.offer_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF;

  IF v_order.artwork_id IS NOT NULL THEN
    SELECT * INTO v_art
      FROM public.artworks
     WHERE id = v_order.artwork_id
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARTWORK_NOT_FOUND'; END IF;

    IF p_resolution = 'release_to_buyer' THEN
      IF EXISTS (
        SELECT 1 FROM public.artwork_ownership
         WHERE artwork_id = v_order.artwork_id
           AND owner_id = v_order.buyer_id
      ) THEN RAISE EXCEPTION 'BUYER_ALREADY_OWNS_ARTWORK'; END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.artwork_ownership
         WHERE artwork_id = v_order.artwork_id
           AND owner_id = v_order.seller_id
      ) THEN RAISE EXCEPTION 'SELLER_NO_LONGER_OWNS_ARTWORK'; END IF;

      DELETE FROM public.artwork_ownership
       WHERE artwork_id = v_order.artwork_id
         AND owner_id = v_order.seller_id;

      INSERT INTO public.artwork_ownership(artwork_id, owner_id, acquired_at, purchase_price_usdt)
      VALUES (v_order.artwork_id, v_order.buyer_id, now(), v_amount);

      UPDATE public.artworks
         SET is_listed_on_p2p = false,
             updated_at = now()
       WHERE id = v_order.artwork_id;

      UPDATE public.p2p_offers
         SET available_crypto = 0,
             is_active = false,
             updated_at = now()
       WHERE id = v_order.offer_id;
    ELSE
      UPDATE public.p2p_offers
         SET available_crypto = 1,
             is_active = true,
             updated_at = now()
       WHERE id = v_order.offer_id;

      UPDATE public.artworks
         SET is_listed_on_p2p = true,
             updated_at = now()
       WHERE id = v_order.artwork_id;
    END IF;
  ELSE
    IF p_resolution = 'release_to_buyer' THEN
      SELECT * INTO v_buyer_wallet
        FROM public.wallet_accounts
       WHERE user_id = v_order.buyer_id
         AND status = 'active'
       FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'BUYER_WALLET_NOT_FOUND'; END IF;

      SELECT amount_usdt INTO v_existing_credit
        FROM public.wallet_ledger
       WHERE user_id = v_order.buyer_id
         AND direction = 'credit'
         AND reference_id = v_order.id::text
         AND kind IN ('p2p_release', 'p2p_dispute_release')
       LIMIT 1;

      IF FOUND THEN
        IF v_existing_credit <> v_amount THEN RAISE EXCEPTION 'P2P_RELEASE_LEDGER_MISMATCH'; END IF;
      ELSE
        UPDATE public.wallet_accounts
           SET balance_usdt = balance_usdt + v_amount,
               updated_at = now()
         WHERE id = v_buyer_wallet.id;

        INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, amount_usdt, kind, reference_id, memo)
        VALUES (v_buyer_wallet.id, v_order.buyer_id, 'credit', v_amount,
                'p2p_dispute_release', v_order.id::text,
                'P2P dispute resolved: released to buyer');
      END IF;
    ELSE
      SELECT * INTO v_seller_wallet
        FROM public.wallet_accounts
       WHERE user_id = v_order.seller_id
         AND status = 'active'
       FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'SELLER_WALLET_NOT_FOUND'; END IF;

      SELECT amount_usdt INTO v_existing_credit
        FROM public.wallet_ledger
       WHERE user_id = v_order.seller_id
         AND direction = 'credit'
         AND reference_id = v_order.id::text
         AND kind IN ('p2p_dispute_refund', 'p2p_escrow_refund', 'p2p_escrow_expiry_refund')
       LIMIT 1;

      IF FOUND THEN
        IF v_existing_credit <> v_amount THEN RAISE EXCEPTION 'P2P_REFUND_LEDGER_MISMATCH'; END IF;
      ELSE
        UPDATE public.wallet_accounts
           SET balance_usdt = balance_usdt + v_amount,
               updated_at = now()
         WHERE id = v_seller_wallet.id;

        INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, amount_usdt, kind, reference_id, memo)
        VALUES (v_seller_wallet.id, v_order.seller_id, 'credit', v_amount,
                'p2p_dispute_refund', v_order.id::text,
                'P2P dispute resolved: refunded to seller');
      END IF;

      IF v_offer.type = 'sell' AND v_offer.funds_reserved IS TRUE THEN
        -- This USDT amount is now back in the seller wallet; do not re-list
        -- the same quantity from the offer's already-reserved balance.
        UPDATE public.p2p_offers
           SET is_active = (available_crypto > 0),
               updated_at = now()
         WHERE id = v_order.offer_id;
      ELSIF v_offer.type = 'sell' THEN
        -- Legacy sell offers weren't pre-reserved; keep them disabled after refund.
        UPDATE public.p2p_offers
           SET available_crypto = available_crypto + v_amount,
               is_active = false,
               updated_at = now()
         WHERE id = v_order.offer_id;
      ELSE
        -- A buy-offer's availability was reduced when the seller opened this order.
        UPDATE public.p2p_offers
           SET available_crypto = available_crypto + v_amount,
               is_active = true,
               updated_at = now()
         WHERE id = v_order.offer_id;
      END IF;
    END IF;
  END IF;

  UPDATE public.p2p_orders
     SET status = CASE WHEN p_resolution = 'release_to_buyer' THEN 'completed' ELSE 'cancelled' END,
         resolved_at = now(),
         resolved_by = v_admin,
         updated_at = now()
   WHERE id = v_order.id
  RETURNING * INTO v_order;

  INSERT INTO public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin,
    CASE WHEN p_resolution = 'release_to_buyer' THEN 'p2p_dispute_release' ELSE 'p2p_dispute_refund' END,
    'p2p_order',
    v_order.id::text,
    jsonb_build_object(
      'resolution', p_resolution,
      'reason', left(trim(p_reason), 2000),
      'buyer_id', v_order.buyer_id,
      'seller_id', v_order.seller_id,
      'amount', v_order.crypto_amount
    )
  );

  INSERT INTO public.activity_events(user_id, kind, entity_type, entity_id, metadata)
  VALUES
    (v_order.buyer_id, 'p2p_dispute_resolved', 'p2p_order', v_order.id::text,
      jsonb_build_object('resolution', p_resolution, 'reason', left(trim(p_reason), 2000))),
    (v_order.seller_id, 'p2p_dispute_resolved', 'p2p_order', v_order.id::text,
      jsonb_build_object('resolution', p_resolution, 'reason', left(trim(p_reason), 2000)));

  PERFORM public.refresh_p2p_trader_stats(v_order.buyer_id);
  PERFORM public.refresh_p2p_trader_stats(v_order.seller_id);
  RETURN v_order;
END;
$function$

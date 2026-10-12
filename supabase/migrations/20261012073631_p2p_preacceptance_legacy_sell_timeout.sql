-- Keep expired pre-acceptance legacy sell offers disabled without creating a false dispute.
-- No wallet refund is made because the legacy path has not debited the seller before acceptance.
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

    ELSIF r.accepted_at IS NULL AND v_offer.funds_reserved IS NOT TRUE THEN
      -- A legacy sell offer was never debited when the order was opened, and
      -- order creation did not consume its quantity. Cancel this unaccepted
      -- legacy request without a refund or capacity increase; keep the unsafe
      -- legacy offer disabled.
      UPDATE public.p2p_offers
         SET is_active = false,
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

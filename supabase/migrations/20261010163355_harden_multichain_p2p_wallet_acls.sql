-- Keep source migrations aligned with the production migration history.
-- Expands existing accepted P2P fiat currencies to cover the app's ETB/AED options.
ALTER TABLE public.p2p_offers
  DROP CONSTRAINT IF EXISTS p2p_offers_fiat_currency_check;
ALTER TABLE public.p2p_offers
  ADD CONSTRAINT p2p_offers_fiat_currency_check
  CHECK (fiat_currency = ANY (ARRAY['ETB','USD','EUR','GBP','AED']::text[]));

ALTER TABLE public.p2p_orders
  DROP CONSTRAINT IF EXISTS p2p_orders_fiat_currency_check;
ALTER TABLE public.p2p_orders
  ADD CONSTRAINT p2p_orders_fiat_currency_check
  CHECK (fiat_currency = ANY (ARRAY['ETB','USD','EUR','GBP','AED']::text[]));

-- Permit MetaMask ownership verification on all supported EVM networks.
ALTER TABLE public.external_wallet_challenges
  DROP CONSTRAINT IF EXISTS external_wallet_challenges_network_check;
ALTER TABLE public.external_wallet_challenges
  ADD CONSTRAINT external_wallet_challenges_network_check
  CHECK (network = ANY (ARRAY['ethereum','polygon','arbitrum','bsc','solana']::text[]));

ALTER TABLE public.external_wallets
  DROP CONSTRAINT IF EXISTS external_wallets_network_check;
ALTER TABLE public.external_wallets
  ADD CONSTRAINT external_wallets_network_check
  CHECK (network = ANY (ARRAY['ton','polygon','ethereum','arbitrum','bsc','solana']::text[]));

-- Keep user-facing privileged functions authenticated; cron retains its owner permissions.
REVOKE EXECUTE ON FUNCTION public.accept_p2p_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_p2p_order(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_p2p_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_p2p_offer(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_my_artwork_v2(
  text, text, numeric, text, text, text, text, text, jsonb, boolean,
  numeric, text, jsonb, text, timestamptz, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_artwork_v2(
  text, text, numeric, text, text, text, text, text, jsonb, boolean,
  numeric, text, jsonb, text, timestamptz, boolean
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.publish_due_artworks() FROM PUBLIC, anon, authenticated;

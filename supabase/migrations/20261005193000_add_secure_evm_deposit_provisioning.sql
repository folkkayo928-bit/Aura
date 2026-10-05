-- Secure, additive EVM deposit-address provisioning metadata.
-- This migration does not create addresses or move funds.
ALTER TABLE public.onchain_wallets
  ADD COLUMN IF NOT EXISTS derivation_index bigint;

CREATE UNIQUE INDEX IF NOT EXISTS onchain_wallets_provider_derivation_idx
  ON public.onchain_wallets(provider, derivation_index)
  WHERE derivation_index IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_evm_deposit_derivation_index()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aura-evm-deposit-derivation'));

  SELECT COALESCE(MAX(derivation_index), -1) + 1
    INTO v_next
    FROM public.onchain_wallets
   WHERE provider = 'aura_hd_wallet';

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_evm_deposit_derivation_index() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_evm_deposit_derivation_index() TO service_role;

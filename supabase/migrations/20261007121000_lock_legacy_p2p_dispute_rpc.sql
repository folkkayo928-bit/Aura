-- Keep the legacy one-argument dispute RPC unreachable from the API roles.
-- The production dispute flow requires an explicit reason.
REVOKE EXECUTE ON FUNCTION public.raise_p2p_dispute(uuid) FROM public, anon, authenticated;

-- Retire the legacy transfer overload that silently creates a fresh idempotency key.
-- Current clients must use the three-argument RPC with a stable request key so retries
-- cannot be interpreted as new transfers. Keep the old function definition for rollback
-- compatibility, but do not expose it to client roles.
REVOKE EXECUTE ON FUNCTION public.internal_transfer(text, numeric)
  FROM PUBLIC, anon, authenticated;

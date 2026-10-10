-- Add auditable, idempotency-oriented tracking for native and thirdweb withdrawal broadcasts.
-- Existing withdrawal rows retain their current state; this migration does not send,
-- cancel, reject, or refund any withdrawal.
ALTER TABLE public.wallet_withdrawals
  ADD COLUMN IF NOT EXISTS broadcast_provider text NOT NULL DEFAULT 'native',
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS submission_started_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_withdrawals_provider_transaction_id_uidx
  ON public.wallet_withdrawals(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_withdrawals_queued_next_attempt_idx
  ON public.wallet_withdrawals(status, next_attempt_at)
  WHERE status = 'queued';

COMMENT ON COLUMN public.wallet_withdrawals.broadcast_provider IS
  'Broadcast backend used for this withdrawal: native signer or thirdweb Server Wallet.';
COMMENT ON COLUMN public.wallet_withdrawals.provider_transaction_id IS
  'Thirdweb transaction ID used to recover broadcast status before a chain transaction hash is known.';
COMMENT ON COLUMN public.wallet_withdrawals.submission_started_at IS
  'Timestamp set before any external broadcast submission. Prevents blind resubmission when a response is lost.';

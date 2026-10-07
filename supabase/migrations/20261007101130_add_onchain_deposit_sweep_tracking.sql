ALTER TABLE public.wallet_deposits
  ADD COLUMN IF NOT EXISTS sweep_status text NOT NULL DEFAULT 'pending'
    CHECK (sweep_status IN ('pending','funding_gas','sweeping','swept','failed')),
  ADD COLUMN IF NOT EXISTS sweep_tx_hash text,
  ADD COLUMN IF NOT EXISTS sweep_gas_tx_hash text,
  ADD COLUMN IF NOT EXISTS sweep_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS swept_at timestamptz,
  ADD COLUMN IF NOT EXISTS sweep_error text;

CREATE INDEX IF NOT EXISTS wallet_deposits_sweep_status_idx
  ON public.wallet_deposits (sweep_status, created_at)
  WHERE sweep_status <> 'swept';

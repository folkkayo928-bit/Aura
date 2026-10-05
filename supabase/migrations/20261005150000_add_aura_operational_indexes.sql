-- Additive performance indexes for high-frequency AURA trade reads.
-- Safe to run against an existing database; no data or policies are changed.

create index if not exists p2p_orders_status_created_idx
  on public.p2p_orders (status, created_at desc);

create index if not exists p2p_messages_order_created_idx
  on public.p2p_messages (order_id, created_at asc);

create index if not exists p2p_payment_proofs_order_created_idx
  on public.p2p_payment_proofs (order_id, created_at asc);

create index if not exists wallet_ledger_user_created_idx
  on public.wallet_ledger (user_id, created_at desc);

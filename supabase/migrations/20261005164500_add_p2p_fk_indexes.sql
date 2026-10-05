-- Add covering indexes for P2P foreign keys without changing existing data or RLS.
create index if not exists p2p_payment_methods_user_id_idx on public.p2p_payment_methods(user_id);
create index if not exists p2p_payment_proofs_uploader_id_idx on public.p2p_payment_proofs(uploader_id);

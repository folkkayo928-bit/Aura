-- Add canonical block hashes used to detect/reconcile incoming transfer receipts.
-- Additive and safe for existing rows; older records may have a null block hash.
alter table public.personal_wallet_transfers
  add column if not exists block_hash text;

alter table public.personal_wallet_transfers
  drop constraint if exists personal_wallet_transfers_block_hash_format;

alter table public.personal_wallet_transfers
  add constraint personal_wallet_transfers_block_hash_format
  check (block_hash is null or block_hash ~ '^0x[0-9a-f]{64}$');

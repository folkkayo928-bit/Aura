-- Preserve canonical block identity for incoming personal-wallet transfer verification.
-- Additive only: existing transfer history is retained and populated as transfers are rechecked.
alter table public.personal_wallet_transfers
  add column if not exists block_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.personal_wallet_transfers'::regclass
      and conname = 'personal_wallet_transfers_block_hash_check'
  ) then
    alter table public.personal_wallet_transfers
      add constraint personal_wallet_transfers_block_hash_check
      check (block_hash is null or block_hash ~ '^0x[0-9a-f]{64}$');
  end if;
end $$;

-- Mirror of the live additive compatibility change for custodial EVM deposits.
-- Existing external/embedded address types and supported chains remain valid.
alter table public.onchain_wallets drop constraint if exists onchain_wallets_address_type_check;
alter table public.onchain_wallets add constraint onchain_wallets_address_type_check
  check (address_type = any (array['external'::text,'embedded'::text,'custodial_deposit'::text]));

alter table public.onchain_wallets drop constraint if exists onchain_wallets_chain_check;
alter table public.onchain_wallets add constraint onchain_wallets_chain_check
  check (chain = any (array['ethereum'::text,'polygon'::text,'arbitrum'::text,'bsc'::text,'solana'::text,'ton'::text]));

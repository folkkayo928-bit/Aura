-- Correct external-wallet verification constraints without deleting wallet records.
-- MetaMask ownership verification supports all four EVM networks; Phantom supports Solana.
-- The external_wallets key must include network so the same EVM address can be linked per chain.
alter table public.external_wallet_challenges
  drop constraint if exists external_wallet_challenges_provider_check;
alter table public.external_wallet_challenges
  add constraint external_wallet_challenges_provider_check
  check (provider in ('MetaMask', 'Phantom'));

alter table public.external_wallet_challenges
  drop constraint if exists external_wallet_challenges_network_check;
alter table public.external_wallet_challenges
  add constraint external_wallet_challenges_network_check
  check (network in ('ethereum', 'polygon', 'arbitrum', 'bsc', 'solana'));

do $$
begin
  if exists (
    select 1
    from public.external_wallets
    group by user_id, provider, network, address
    having count(*) > 1
  ) then
    raise exception 'Duplicate external wallet rows prevent safe network-specific uniqueness migration';
  end if;
end $$;

alter table public.external_wallets
  drop constraint if exists external_wallets_user_id_provider_address_key;

alter table public.external_wallets
  add constraint external_wallets_user_provider_network_address_key
  unique (user_id, provider, network, address);

-- Secure custody configuration bridge.
-- Values live in Supabase Vault; this migration never stores xpub/mnemonic/API-key material in source control.
create or replace function public.get_aura_evm_deposit_xpub()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'aura_evm_deposit_xpub'
  limit 1;
$$;

create or replace function public.get_aura_evm_deposit_xprv()
returns text
language sql
security definer
set search_path = public, vault
as $
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'aura_evm_deposit_xprv'
  limit 1;
$;

create or replace function public.get_aura_evm_deposit_mnemonic()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'aura_evm_deposit_mnemonic'
  limit 1;
$$;

create or replace function public.get_aura_alchemy_api_key()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'aura_alchemy_api_key'
  limit 1;
$$;

revoke all on function public.get_aura_evm_deposit_xpub() from public, anon, authenticated;
revoke all on function public.get_aura_evm_deposit_xprv() from public, anon, authenticated;
revoke all on function public.get_aura_evm_deposit_mnemonic() from public, anon, authenticated;
revoke all on function public.get_aura_alchemy_api_key() from public, anon, authenticated;
grant execute on function public.get_aura_evm_deposit_xpub() to service_role;
grant execute on function public.get_aura_evm_deposit_xprv() to service_role;
grant execute on function public.get_aura_evm_deposit_mnemonic() to service_role;
grant execute on function public.get_aura_alchemy_api_key() to service_role;

create or replace function public.admin_foundation_readiness()
returns jsonb
language sql
stable
security definer
set search_path to public
as $function$
  select jsonb_build_object(
    'ownerClaimed', exists(select 1 from public.aura_admins where active = true),
    'workerSecretConfigured', exists(select 1 from vault.decrypted_secrets where name = 'aura_worker_secret'),
    'projectVaultConfigured',
      exists(select 1 from vault.decrypted_secrets where name = 'aura_project_url')
      and exists(select 1 from vault.decrypted_secrets where name = 'aura_publishable_key'),
    'depositCustodyAddresses', (select count(*) from public.onchain_wallets where provider = 'aura_hd_wallet'),
    'depositSweepPending', (select count(*) from public.wallet_deposits where sweep_status in ('pending','funding_gas','sweeping')),
    'depositSweepFailed', (select count(*) from public.wallet_deposits where sweep_status = 'failed'),
    'dropReminders', (select count(*) from public.aura_drop_reminders),
    'dropNotificationQueueReady', exists(select 1 from cron.job where jobname = 'aura-drop-notifications' and active = true),
    'depositIndexerScheduleReady', exists(select 1 from cron.job where jobname = 'aura-deposit-indexer' and active = true),
    'depositSweepScheduleReady', exists(select 1 from cron.job where jobname = 'aura-deposit-sweep' and active = true)
  )
  where public.aura_can('operator');
$function$;

revoke execute on function public.admin_foundation_readiness() from public, anon;
grant execute on function public.admin_foundation_readiness() to authenticated;

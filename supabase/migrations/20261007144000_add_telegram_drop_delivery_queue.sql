alter table public.aura_drop_reminders
  add column if not exists telegram_prealert_sent_at timestamptz,
  add column if not exists telegram_live_sent_at timestamptz;

create index if not exists aura_drop_reminders_telegram_prealert_idx
  on public.aura_drop_reminders(drop_id, user_id)
  where telegram_prealert_sent_at is null;

create index if not exists aura_drop_reminders_telegram_live_idx
  on public.aura_drop_reminders(drop_id, user_id)
  where telegram_live_sent_at is null;

create or replace function public.get_aura_telegram_notify_secret()
returns text
language sql
security definer
set search_path to vault, public
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'aura_telegram_notify_secret'
  limit 1;
$function$;

revoke all on function public.get_aura_telegram_notify_secret() from public, anon, authenticated;
grant execute on function public.get_aura_telegram_notify_secret() to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'aura-telegram-drop-notifications') then
    perform cron.schedule(
      'aura-telegram-drop-notifications',
      '* * * * *',
      $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name='aura_project_url') || '/functions/v1/telegram-drop-notifications',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'apikey',(select decrypted_secret from vault.decrypted_secrets where name='aura_publishable_key'),
            'x-aura-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='aura_worker_secret')
          ),
          body := jsonb_build_object('source','supabase-cron')
        ) as request_id;
      $cron$
    );
  end if;
end
$$;

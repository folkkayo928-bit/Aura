-- Schedule the existing Aura worker pattern to scan/confirm on-chain USDT deposits.
-- Additive: does not modify or replace existing jobs.

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'aura-deposit-indexer') then
    perform cron.schedule(
      'aura-deposit-indexer',
      '* * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name='aura_project_url') || '/functions/v1/deposit-indexer',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'apikey',(select decrypted_secret from vault.decrypted_secrets where name='aura_publishable_key'),
            'x-aura-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='aura_worker_secret')
          ),
          body := jsonb_build_object('source','supabase-cron')
        ) as request_id;
      $job$
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'aura-deposit-sweep') then
    perform cron.schedule(
      'aura-deposit-sweep',
      '*/5 * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name='aura_project_url') || '/functions/v1/deposit-sweep',
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

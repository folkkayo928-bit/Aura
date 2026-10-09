-- Give the all-network deposit indexer enough time to finish its bounded RPC scan.
-- Resolve the job by its stable name; do not assume a generated job ID.
do $migration$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'aura-deposit-indexer'
    and active
  order by jobid
  limit 1;

  if v_job_id is not null then
    perform cron.alter_job(
      job_id := v_job_id,
      command := $command$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name='aura_project_url') || '/functions/v1/deposit-indexer',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'apikey',(select decrypted_secret from vault.decrypted_secrets where name='aura_publishable_key'),
            'x-aura-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='aura_worker_secret')
          ),
          body := jsonb_build_object('source','supabase-cron'),
          timeout_milliseconds := 60000
        ) as request_id;
      $command$
    );
  end if;
end
$migration$;
create or replace function public.queue_due_drop_notifications()
returns integer
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_count integer := 0;
begin
  insert into public.notifications(user_id,title,message,type)
  select
    r.user_id,
    case when d.status = 'live' then '✨ Drop is live' else '⏱ Drop starts soon' end,
    case
      when d.status = 'live' then d.title || ' is now live in AURA.'
      else d.title || ' is scheduled to start soon. Your reminder is on.'
    end,
    'drop_alert'
  from public.aura_drop_reminders r
  join public.aura_drops d on d.id = r.drop_id
  join public.profiles p on p.id = r.user_id
  where p.notifications_enabled = true
    and (
      d.status = 'live'
      or (
        d.status = 'scheduled'
        and d.scheduled_at is not null
        and d.scheduled_at > now()
        and d.scheduled_at <= now() + interval '15 minutes'
      )
    )
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = r.user_id
        and n.type = 'drop_alert'
        and n.title = case when d.status = 'live' then '✨ Drop is live' else '⏱ Drop starts soon' end
        and n.message = case
          when d.status = 'live' then d.title || ' is now live in AURA.'
          else d.title || ' is scheduled to start soon. Your reminder is on.'
        end
        and n.created_at >= now() - interval '24 hours'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke execute on function public.queue_due_drop_notifications() from public, anon, authenticated;
grant execute on function public.queue_due_drop_notifications() to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'aura-drop-notifications') then
    perform cron.schedule(
      'aura-drop-notifications',
      '* * * * *',
      $cron$select public.queue_due_drop_notifications();$cron$
    );
  end if;
end
$$;

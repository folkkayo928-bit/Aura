-- Add Telegram alerts for successful internal USDT transfers.
-- The ledger insert is part of the same atomic transfer transaction; this trigger only queues
-- a notification and never changes balances or transfer state.

create or replace function public.queue_internal_transfer_telegram_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_profile public.profiles;
  v_title text;
  v_message text;
begin
  if new.kind <> 'internal_transfer' then return new; end if;

  select * into v_profile
  from public.profiles
  where id = new.user_id;

  if not found
     or coalesce(v_profile.telegram_user_id, '') !~ '^[0-9]{1,20}
     or not coalesce(v_profile.telegram_bot_alerts, true) then
    return new;
  end if;

  if new.direction = 'credit' then
    v_title := 'USDT received';
    v_message := format('You received %s USDT in your AURA Vault. Reference: %s. Open AURA to review your wallet history.',
      new.amount_usdt, left(coalesce(new.reference_id, ''), 12));
  else
    v_title := 'USDT sent';
    v_message := format('%s USDT was sent from your AURA Vault. Reference: %s. Open AURA to review your wallet history.',
      new.amount_usdt, left(coalesce(new.reference_id, ''), 12));
  end if;

  insert into public.aura_telegram_notification_queue(user_id, event_type, title, message)
  values (new.user_id, 'internal_transfer', v_title, v_message);

  return new;
end;
$function$;

revoke all on function public.queue_internal_transfer_telegram_notification() from public, anon, authenticated;
drop trigger if exists wallet_ledger_queue_internal_transfer_telegram on public.wallet_ledger;
create trigger wallet_ledger_queue_internal_transfer_telegram
after insert on public.wallet_ledger
for each row when (new.kind = 'internal_transfer')
execute function public.queue_internal_transfer_telegram_notification();

     or not coalesce(v_profile.telegram_bot_alerts, true) then
    return new;
  end if;

  if new.direction = 'credit' then
    v_title := 'USDT received';
    v_message := format('You received %s USDT in your AURA Vault. Reference: %s. Open AURA to review your wallet history.',
      new.amount_usdt, left(coalesce(new.reference_id, ''), 12));
  else
    v_title := 'USDT sent';
    v_message := format('%s USDT was sent from your AURA Vault. Reference: %s. Open AURA to review your wallet history.',
      new.amount_usdt, left(coalesce(new.reference_id, ''), 12));
  end if;

  insert into public.aura_telegram_notification_queue(user_id, event_type, title, message)
  values (new.user_id, 'internal_transfer', v_title, v_message);

  return new;
end;
$function$;

revoke all on function public.queue_internal_transfer_telegram_notification() from public, anon, authenticated;
drop trigger if exists wallet_ledger_queue_internal_transfer_telegram on public.wallet_ledger;
create trigger wallet_ledger_queue_internal_transfer_telegram
after insert on public.wallet_ledger
for each row when (new.kind = 'internal_transfer')
execute function public.queue_internal_transfer_telegram_notification();

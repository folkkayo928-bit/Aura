-- Keep Telegram delivery best-effort: notification queue failures must never
-- roll back an otherwise valid P2P order or wallet transfer.

create or replace function public.queue_p2p_telegram_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_recipient record;
  v_trade text := left(new.id::text, 8);
  v_amount text := coalesce(new.crypto_amount::text, '0');
  v_status text := upper(replace(coalesce(new.status, 'updated'), '_', ' '));
begin
  begin
    if tg_op = 'INSERT' then
      for v_recipient in
        select p.id,
               case when p.id = new.seller_id then 'New P2P trade request' else 'P2P trade created' end as notification_title
        from public.profiles p
        where p.id in (new.buyer_id, new.seller_id)
          and p.telegram_user_id ~ '^[0-9]{1,20}$'
          and coalesce(p.telegram_bot_alerts, true)
      loop
        insert into public.aura_telegram_notification_queue(user_id, event_type, title, message)
        values (
          v_recipient.id,
          'p2p_order_created',
          v_recipient.notification_title,
          format('Trade #%s was created for %s USDT. Open AURA to review the trade and its current details.', v_trade, v_amount)
        );
      end loop;
    elsif new.status is distinct from old.status then
      for v_recipient in
        select p.id
        from public.profiles p
        where p.id in (new.buyer_id, new.seller_id)
          and p.telegram_user_id ~ '^[0-9]{1,20}$'
          and coalesce(p.telegram_bot_alerts, true)
      loop
        insert into public.aura_telegram_notification_queue(user_id, event_type, title, message)
        values (
          v_recipient.id,
          'p2p_order_status',
          'P2P trade status updated',
          format('Trade #%s status is now %s. Open AURA to review the latest trade details.', v_trade, v_status)
        );
      end loop;
    end if;
  exception when others then
    raise warning 'AURA P2P Telegram notification queue failed; trade state is preserved: %', SQLERRM;
  end;
  return new;
end;
$function$;

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

  select * into v_profile from public.profiles where id = new.user_id;
  if not found
     or coalesce(v_profile.telegram_user_id, '') !~ '^[0-9]{1,20}$'
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

  begin
    insert into public.aura_telegram_notification_queue(user_id, event_type, title, message)
    values (new.user_id, 'internal_transfer', v_title, v_message);
  exception when others then
    raise warning 'AURA internal transfer Telegram notification queue failed; ledger transaction is preserved: %', SQLERRM;
  end;

  return new;
end;
$function$;

-- Add persistent in-app notifications for P2P lifecycle events.
-- Additive only: preserves the existing escrow RPCs, notification policies,
-- and Telegram delivery queue. Notification insert failures are best-effort.
create or replace function public.queue_p2p_app_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_recipient record;
  v_trade text := left(coalesce(new.reference_code, new.id::text), 12);
  v_title text;
  v_message text;
begin
  begin
    if tg_op = 'INSERT' then
      for v_recipient in
        select p.id,
               case
                 when p.id = new.seller_id then 'New P2P trade request'
                 else 'P2P trade created'
               end as notification_title
        from public.profiles p
        where p.id in (new.buyer_id, new.seller_id)
      loop
        begin
          insert into public.notifications(user_id, title, message, type)
          values (
            v_recipient.id,
            v_recipient.notification_title,
            format('Trade %s was opened. Open My Trades to review its current status and details.', v_trade),
            'p2p'
          );
        exception when others then
          raise warning 'AURA in-app P2P notification failed for user %: %', v_recipient.id, SQLERRM;
        end;
      end loop;
    elsif new.status is distinct from old.status then
      if new.status = 'payment_marked' then
        v_title := 'P2P payment proof submitted';
        v_message := format('Payment was marked for trade %s. Open My Trades to review the current order status.', v_trade);
      elsif new.status = 'completed' then
        v_title := 'P2P trade completed';
        v_message := format('Trade %s was completed. Its final status is available in My Trades.', v_trade);
      elsif new.status = 'cancelled' then
        v_title := 'P2P trade cancelled';
        v_message := format('Trade %s was cancelled. Open My Trades to review the final status.', v_trade);
      elsif new.status = 'in_dispute' then
        v_title := 'P2P trade under review';
        v_message := format('Trade %s is under dispute review. Open My Trades for the latest status.', v_trade);
      else
        v_title := 'P2P trade status updated';
        v_message := format('Trade %s status changed to %s. Open My Trades to review the order.', v_trade, upper(replace(new.status, '_', ' ')));
      end if;

      for v_recipient in
        select p.id
        from public.profiles p
        where p.id in (new.buyer_id, new.seller_id)
      loop
        begin
          insert into public.notifications(user_id, title, message, type)
          values (v_recipient.id, v_title, v_message, 'p2p');
        exception when others then
          raise warning 'AURA in-app P2P notification failed for user %: %', v_recipient.id, SQLERRM;
        end;
      end loop;
    elsif new.accepted_at is distinct from old.accepted_at and new.accepted_at is not null then
      v_title := 'P2P trade accepted';
      v_message := format('The counterparty accepted trade %s. Open My Trades to continue.', v_trade);

      for v_recipient in
        select p.id
        from public.profiles p
        where p.id in (new.buyer_id, new.seller_id)
      loop
        begin
          insert into public.notifications(user_id, title, message, type)
          values (v_recipient.id, v_title, v_message, 'p2p');
        exception when others then
          raise warning 'AURA in-app P2P notification failed for user %: %', v_recipient.id, SQLERRM;
        end;
      end loop;
    end if;
  exception when others then
    -- A notification failure must never roll back an otherwise valid trade.
    raise warning 'AURA in-app P2P notification trigger failed; trade state is preserved: %', SQLERRM;
  end;

  return new;
end;
$function$;

revoke all on function public.queue_p2p_app_notifications() from public, anon, authenticated;

drop trigger if exists p2p_orders_queue_app_notifications on public.p2p_orders;
create trigger p2p_orders_queue_app_notifications
after insert or update of status, accepted_at on public.p2p_orders
for each row execute function public.queue_p2p_app_notifications();

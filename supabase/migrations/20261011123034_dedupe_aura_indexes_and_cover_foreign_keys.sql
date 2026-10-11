-- Remove duplicate indexes while retaining the canonical, actively used copies.
drop index if exists public.notification_user_idx;
drop index if exists public.profiles_telegram_user_id_key;

-- Cover frequently used foreign-key columns to avoid table scans on joins/cascades.
create index if not exists aura_telegram_notification_queue_user_id_idx
  on public.aura_telegram_notification_queue (user_id);
create index if not exists wallet_internal_transfer_requests_recipient_id_idx
  on public.wallet_internal_transfer_requests (recipient_id);
create index if not exists wallet_internal_transfer_requests_sender_id_idx
  on public.wallet_internal_transfer_requests (sender_id);

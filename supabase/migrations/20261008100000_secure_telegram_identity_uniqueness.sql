-- A Telegram numeric user ID is the immutable external identity for an AURA account.
-- Keep it unique while allowing normal email users to have NULL here.
create unique index if not exists profiles_telegram_user_id_unique
  on public.profiles (telegram_user_id)
  where telegram_user_id is not null;

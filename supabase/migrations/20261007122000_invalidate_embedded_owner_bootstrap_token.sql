-- Invalidate the repository-embedded bootstrap token before public production use.
-- A fresh one-time owner bootstrap credential must be provisioned through a secure operator channel.
update public.aura_owner_bootstrap
set used_at = coalesce(used_at, now()),
    expires_at = least(expires_at, now())
where id = true
  and used_at is null;

alter policy aura_drop_reminders_self_read
  on public.aura_drop_reminders
  using ((select auth.uid()) = user_id);

alter policy aura_drop_reminders_self_insert
  on public.aura_drop_reminders
  with check ((select auth.uid()) = user_id);

alter policy aura_drop_reminders_self_delete
  on public.aura_drop_reminders
  using ((select auth.uid()) = user_id);

create index if not exists admin_audit_log_admin_user_idx
  on public.admin_audit_log(admin_user_id);

create index if not exists aura_admins_granted_by_idx
  on public.aura_admins(granted_by);

create index if not exists aura_drops_created_by_idx
  on public.aura_drops(created_by);

drop policy if exists collections_owner_delete on public.collections;
create policy collections_owner_delete
  on public.collections
  for delete
  to public
  using ((select auth.uid()) = creator_id);

create or replace function public.admin_list_withdrawals(p_limit integer default 50)
returns setof public.wallet_withdrawals language sql stable security definer set search_path=public as $$
  select w.* from public.wallet_withdrawals w where public.is_aura_admin()
  order by w.created_at desc limit greatest(1,least(coalesce(p_limit,50),200));
$$;
create or replace function public.admin_list_deposits(p_limit integer default 50)
returns setof public.wallet_deposits language sql stable security definer set search_path=public as $$
  select d.* from public.wallet_deposits d where public.is_aura_admin()
  order by d.created_at desc limit greatest(1,least(coalesce(p_limit,50),200));
$$;
create or replace function public.admin_list_recent_audit(p_limit integer default 100)
returns setof public.admin_audit_log language sql stable security definer set search_path=public as $$
  select a.* from public.admin_audit_log a where public.is_aura_admin()
  order by a.created_at desc limit greatest(1,least(coalesce(p_limit,100),500));
$$;
revoke all on function public.admin_list_withdrawals(integer) from public;
revoke all on function public.admin_list_deposits(integer) from public;
revoke all on function public.admin_list_recent_audit(integer) from public;
grant execute on function public.admin_list_withdrawals(integer) to authenticated;
grant execute on function public.admin_list_deposits(integer) to authenticated;
grant execute on function public.admin_list_recent_audit(integer) to authenticated;

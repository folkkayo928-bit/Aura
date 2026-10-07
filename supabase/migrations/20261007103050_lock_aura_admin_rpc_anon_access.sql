-- Admin/browser boundary: admin RPCs are authenticated-only.
-- Anon must not be able to invoke privileged SECURITY DEFINER functions.
revoke execute on function public.is_aura_admin(uuid) from anon;
revoke execute on function public.toggle_aura_drop_reminder(uuid) from anon;
revoke execute on function public.admin_dashboard_snapshot() from anon;
revoke execute on function public.admin_create_drop(text,text,timestamptz,numeric,integer,uuid,uuid,text,text,boolean,jsonb) from anon;
revoke execute on function public.admin_set_drop_status(uuid,text) from anon;
revoke execute on function public.admin_set_wallet_status(uuid,text,text) from anon;
revoke execute on function public.admin_wallet_adjustment(uuid,text,numeric,text) from anon;
revoke execute on function public.admin_reject_pending_withdrawal(uuid,text) from anon;
revoke execute on function public.admin_list_withdrawals(integer) from anon;
revoke execute on function public.admin_list_deposits(integer) from anon;
revoke execute on function public.admin_list_recent_audit(integer) from anon;
revoke execute on function public.admin_list_wallets(integer) from anon;
revoke execute on function public.admin_financial_timeseries(integer) from anon;
revoke execute on function public.admin_system_health() from anon;

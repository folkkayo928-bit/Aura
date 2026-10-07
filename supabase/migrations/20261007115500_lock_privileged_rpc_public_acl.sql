-- Mirror the production ACL hardening applied on 2026-10-07.
-- Keep privileged RPCs callable only by authenticated admin-gated application flows;
-- anonymous/public execution is explicitly denied.

REVOKE EXECUTE ON FUNCTION public.admin_create_drop(text,text,timestamptz,numeric,integer,uuid,uuid,text,text,boolean,jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_snapshot() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_financial_timeseries(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_foundation_readiness() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_deposits(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_drops_v2(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_p2p_disputes(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_recent_audit(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_wallets(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_withdrawals(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_pending_withdrawal(uuid,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_p2p_dispute(uuid,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_drop_status(uuid,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_wallet_status(uuid,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_system_health() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_drop_v2(uuid,text,text,text,numeric,integer,text,timestamptz,boolean,jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_wallet_adjustment(uuid,text,numeric,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.aura_can(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.aura_owner_bootstrap_available() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_aura_admin(uuid) FROM public, anon;

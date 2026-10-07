-- Security/performance follow-up applied in production.
revoke execute on function public.raise_p2p_dispute(uuid,text) from public,anon;
grant execute on function public.raise_p2p_dispute(uuid,text) to authenticated;
create index if not exists p2p_orders_resolved_by_idx on public.p2p_orders(resolved_by);

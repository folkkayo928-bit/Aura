-- P2P order state is mutated only by SECURITY DEFINER server-side functions.
revoke insert, update on table public.p2p_orders from anon, authenticated;

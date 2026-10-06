create policy "collection_watchlist_self_insert"
on public.collection_watchlist
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "collection_watchlist_self_delete"
on public.collection_watchlist
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on table public.artworks from anon, authenticated;
revoke insert, update, delete on table public.collections from anon, authenticated;
revoke insert, update, delete on table public.p2p_offers from anon, authenticated;
revoke insert, update, delete on table public.onchain_wallets from anon, authenticated;
revoke insert, update on table public.external_wallets from anon, authenticated;
revoke insert on table public.wallet_withdrawals from anon, authenticated;

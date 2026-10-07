create or replace function public.admin_list_p2p_disputes(p_limit integer default 100)
returns setof public.p2p_orders
language sql
security definer
set search_path to public
as $function$
  select o.*
  from public.p2p_orders o
  where o.status = 'in_dispute'
    and public.aura_can('operator')
  order by o.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$function$;

create or replace function public.admin_resolve_p2p_dispute(
  p_order_id uuid,
  p_resolution text,
  p_reason text
)
returns public.p2p_orders
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_admin uuid := auth.uid();
  v_order public.p2p_orders;
  v_art public.artworks;
  v_offer public.p2p_offers;
  v_buyer_wallet public.wallet_accounts;
  v_seller_wallet public.wallet_accounts;
  v_amount numeric;
begin
  if v_admin is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.aura_can('operator') then raise exception 'ADMIN_ROLE_REQUIRED'; end if;
  if p_resolution not in ('release_to_buyer','refund_seller') then raise exception 'INVALID_RESOLUTION'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'REASON_REQUIRED'; end if;

  select * into v_order from public.p2p_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'in_dispute' then raise exception 'ORDER_NOT_IN_DISPUTE'; end if;

  v_amount := v_order.crypto_amount;

  if v_order.artwork_id is not null then
    select * into v_art from public.artworks where id = v_order.artwork_id for update;
    if not found then raise exception 'ARTWORK_NOT_FOUND'; end if;

    select * into v_offer from public.p2p_offers where id = v_order.offer_id for update;

    if p_resolution = 'release_to_buyer' then
      if exists (select 1 from public.artwork_ownership where artwork_id = v_order.artwork_id and owner_id = v_order.buyer_id) then
        raise exception 'BUYER_ALREADY_OWNS_ARTWORK';
      end if;
      if not exists (select 1 from public.artwork_ownership where artwork_id = v_order.artwork_id and owner_id = v_order.seller_id) then
        raise exception 'SELLER_NO_LONGER_OWNS_ARTWORK';
      end if;

      delete from public.artwork_ownership where artwork_id = v_order.artwork_id and owner_id = v_order.seller_id;
      insert into public.artwork_ownership(artwork_id, owner_id, acquired_at, purchase_price_usdt)
      values (v_order.artwork_id, v_order.buyer_id, now(), v_amount);

      update public.artworks set is_listed_on_p2p = false, updated_at = now() where id = v_order.artwork_id;
      update public.p2p_offers set available_crypto = 0, is_active = false, updated_at = now() where id = v_order.offer_id;
      update public.p2p_orders set status = 'completed', updated_at = now() where id = v_order.id returning * into v_order;
    else
      update public.p2p_offers set available_crypto = greatest(available_crypto, 0) + 1, is_active = true, updated_at = now() where id = v_order.offer_id;
      update public.artworks set is_listed_on_p2p = true, updated_at = now() where id = v_order.artwork_id;
      update public.p2p_orders set status = 'cancelled', updated_at = now() where id = v_order.id returning * into v_order;
    end if;
  else
    if p_resolution = 'release_to_buyer' then
      select * into v_buyer_wallet from public.wallet_accounts where user_id = v_order.buyer_id for update;
      if not found then raise exception 'BUYER_WALLET_NOT_FOUND'; end if;
      update public.wallet_accounts set balance_usdt = balance_usdt + v_amount, updated_at = now() where id = v_buyer_wallet.id;
      insert into public.wallet_ledger(wallet_id, user_id, direction, amount_usdt, kind, reference_id, memo)
      values (v_buyer_wallet.id, v_order.buyer_id, 'credit', v_amount, 'p2p_dispute_release', v_order.id::text, 'P2P dispute resolved: released to buyer');
    else
      select * into v_seller_wallet from public.wallet_accounts where user_id = v_order.seller_id for update;
      if not found then raise exception 'SELLER_WALLET_NOT_FOUND'; end if;
      update public.wallet_accounts set balance_usdt = balance_usdt + v_amount, updated_at = now() where id = v_seller_wallet.id;
      insert into public.wallet_ledger(wallet_id, user_id, direction, amount_usdt, kind, reference_id, memo)
      values (v_seller_wallet.id, v_order.seller_id, 'credit', v_amount, 'p2p_dispute_refund', v_order.id::text, 'P2P dispute resolved: refunded to seller');
    end if;

    update public.p2p_offers set available_crypto = available_crypto + v_amount, is_active = true, updated_at = now() where id = v_order.offer_id;
    update public.p2p_orders
       set status = case when p_resolution = 'release_to_buyer' then 'completed' else 'cancelled' end,
           updated_at = now()
     where id = v_order.id
     returning * into v_order;
  end if;

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (
    v_admin,
    case when p_resolution = 'release_to_buyer' then 'p2p_dispute_release' else 'p2p_dispute_refund' end,
    'p2p_order',
    v_order.id,
    jsonb_build_object('resolution', p_resolution, 'reason', trim(p_reason), 'buyer_id', v_order.buyer_id, 'seller_id', v_order.seller_id, 'amount', v_order.crypto_amount)
  );

  insert into public.activity_events(user_id, kind, entity_type, entity_id, metadata)
  values
    (v_order.buyer_id, 'p2p_dispute_resolved', 'p2p_order', v_order.id::text, jsonb_build_object('resolution', p_resolution, 'reason', trim(p_reason))),
    (v_order.seller_id, 'p2p_dispute_resolved', 'p2p_order', v_order.id::text, jsonb_build_object('resolution', p_resolution, 'reason', trim(p_reason)));

  perform public.refresh_p2p_trader_stats(v_order.buyer_id);
  perform public.refresh_p2p_trader_stats(v_order.seller_id);

  return v_order;
end;
$function$;

revoke all on function public.admin_list_p2p_disputes(integer) from public, anon, authenticated;
grant execute on function public.admin_list_p2p_disputes(integer) to authenticated;

revoke all on function public.admin_resolve_p2p_dispute(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_resolve_p2p_dispute(uuid, text, text) to authenticated;

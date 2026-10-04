create or replace function public.raise_p2p_dispute(p_order_id uuid)
returns public.p2p_orders
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.p2p_orders;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select *
    into v_order
    from public.p2p_orders
   where id = p_order_id
   for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_user <> v_order.buyer_id and v_user <> v_order.seller_id then
    raise exception 'NOT_PARTICIPANT';
  end if;

  if v_order.status not in ('escrow_locked','payment_marked') then
    raise exception 'ORDER_NOT_DISPUTABLE';
  end if;

  update public.p2p_orders
     set status = 'in_dispute'
   where id = p_order_id
  returning * into v_order;

  insert into public.activity_events(user_id, kind, entity_type, entity_id, metadata)
  values (
    v_user,
    'p2p_dispute_opened',
    'p2p_order',
    v_order.id::text,
    jsonb_build_object('reference_code', v_order.reference_code)
  );

  return v_order;
end;
$function$;

revoke execute on function public.raise_p2p_dispute(uuid) from public, anon;
grant execute on function public.raise_p2p_dispute(uuid) to authenticated;

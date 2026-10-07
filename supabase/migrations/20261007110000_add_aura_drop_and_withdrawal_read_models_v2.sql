create function public.admin_list_drops_v2(p_limit integer default 100)
returns table (
  id uuid, collection_id uuid, creator_id uuid, title text, description text, banner_url text,
  mint_price_usdt numeric, supply integer, minted_so_far integer, category text,
  scheduled_at timestamptz, whitelist_open boolean, status text, perks jsonb,
  created_by uuid, published_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language sql security definer
set search_path = public, pg_temp
as $$
  select d.id,d.collection_id,d.creator_id,d.title,d.description,d.banner_url,
         d.mint_price_usdt,d.supply,d.minted_so_far,d.category,d.scheduled_at,
         d.whitelist_open,d.status,d.perks,d.created_by,d.published_at,d.created_at,d.updated_at
  from public.aura_drops d
  where public.aura_can('operator')
  order by coalesce(d.scheduled_at,d.created_at) desc
  limit greatest(1, least(coalesce(p_limit,100),500));
$$;

create function public.admin_update_drop_v2(
  p_drop_id uuid,
  p_title text default null,
  p_description text default null,
  p_banner_url text default null,
  p_mint_price_usdt numeric default null,
  p_supply integer default null,
  p_category text default null,
  p_scheduled_at timestamptz default null,
  p_whitelist_open boolean default null,
  p_perks jsonb default null
)
returns public.aura_drops
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_drop public.aura_drops;
begin
  if not public.aura_can('operator') then raise exception 'admin access required'; end if;
  if p_mint_price_usdt is not null and p_mint_price_usdt < 0 then raise exception 'mint price cannot be negative'; end if;
  if p_supply is not null and p_supply < 1 then raise exception 'supply must be at least 1'; end if;
  update public.aura_drops
  set title=coalesce(p_title,title), description=coalesce(p_description,description),
      banner_url=coalesce(p_banner_url,banner_url), mint_price_usdt=coalesce(p_mint_price_usdt,mint_price_usdt),
      supply=coalesce(p_supply,supply), category=coalesce(p_category,category),
      scheduled_at=coalesce(p_scheduled_at,scheduled_at), whitelist_open=coalesce(p_whitelist_open,whitelist_open),
      perks=coalesce(p_perks,perks), updated_at=now()
  where id=p_drop_id returning * into v_drop;
  if not found then raise exception 'drop not found'; end if;
  insert into public.admin_audit_log(admin_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'update_drop','aura_drop',p_drop_id,jsonb_build_object('title',v_drop.title,'status',v_drop.status));
  return v_drop;
end;
$$;

create function public.list_live_aura_drops_v2(p_limit integer default 50)
returns setof public.aura_drops
language sql security invoker
set search_path = public, pg_temp
as $$
  select d.* from public.aura_drops d
  where d.status in ('scheduled','live')
  order by case when d.status='live' then 0 else 1 end, coalesce(d.scheduled_at,d.created_at) asc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

create function public.my_withdrawal_history_v2(p_limit integer default 50)
returns table (
  id uuid, chain text, token_symbol text, destination_address text,
  amount numeric, network_fee numeric, status text, email_confirmed_at timestamptz,
  tx_hash text, rejection_reason text, created_at timestamptz, updated_at timestamptz,
  broadcast_at timestamptz, confirmed_onchain_at timestamptz
)
language sql security invoker
set search_path = public, pg_temp
as $$
  select w.id,w.chain,w.token_symbol,w.destination_address,w.amount,w.network_fee,w.status,
         w.email_confirmed_at,w.tx_hash,w.rejection_reason,w.created_at,w.updated_at,
         w.broadcast_at,w.confirmed_onchain_at
  from public.wallet_withdrawals w
  where w.user_id=auth.uid()
  order by w.created_at desc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

revoke execute on function public.admin_list_drops_v2(integer) from public;
revoke execute on function public.admin_update_drop_v2(uuid,text,text,text,numeric,integer,text,timestamptz,boolean,jsonb) from public;
revoke execute on function public.list_live_aura_drops_v2(integer) from public;
revoke execute on function public.my_withdrawal_history_v2(integer) from public;
grant execute on function public.admin_list_drops_v2(integer) to authenticated;
grant execute on function public.admin_update_drop_v2(uuid,text,text,text,numeric,integer,text,timestamptz,boolean,jsonb) to authenticated;
grant execute on function public.list_live_aura_drops_v2(integer) to authenticated;
grant execute on function public.my_withdrawal_history_v2(integer) to authenticated;

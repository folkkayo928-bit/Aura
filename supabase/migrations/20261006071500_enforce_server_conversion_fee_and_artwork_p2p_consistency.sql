create or replace function public.convert_owned_artwork(
  p_artwork_id uuid,
  p_fee_usdt numeric default 2
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_art public.artworks;
  v_wallet public.wallet_accounts;
  v_fee numeric(24,8) := 2;
  v_payout numeric(24,8);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.artwork_ownership where artwork_id=p_artwork_id and owner_id=v_user) then
    raise exception 'NOT_OWNER';
  end if;
  select * into v_art from public.artworks where id=p_artwork_id for update;
  v_payout := greatest(0, v_art.current_value_usdt - v_fee);
  select * into v_wallet from public.wallet_accounts where user_id=v_user and status='active' for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  update public.wallet_accounts set balance_usdt=balance_usdt+v_payout where id=v_wallet.id;
  delete from public.artwork_ownership where artwork_id=p_artwork_id and owner_id=v_user;
  update public.artworks set collectors_count=greatest(0,collectors_count-1), is_listed_on_p2p=false where id=p_artwork_id;
  insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
    values(v_wallet.id,v_user,'credit',v_payout,'artwork_convert',v_art.id::text,v_art.title);
  insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata)
    values(v_user,'artwork_converted','artwork',v_art.id::text,jsonb_build_object('payout_usdt',v_payout,'fee_usdt',v_fee));
  return jsonb_build_object('ok',true,'payout_usdt',v_payout,'fee_usdt',v_fee);
end;
$function$;

create or replace function public.create_my_artwork(
  p_title text,
  p_description text,
  p_price_usdt numeric,
  p_visual_theme text,
  p_category text,
  p_media_type text default 'image',
  p_media_url text default null,
  p_collection_name text default null,
  p_traits jsonb default '[]'::jsonb,
  p_list_on_p2p boolean default false,
  p_p2p_price_fiat numeric default null,
  p_p2p_currency text default 'USD',
  p_p2p_payment_methods jsonb default '[]'::jsonb
) returns public.artworks
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_art public.artworks;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_price_usdt is null or p_price_usdt <= 0 then raise exception 'INVALID_PRICE'; end if;
  insert into public.artworks (
    creator_id,title,description,original_price_usdt,current_value_usdt,
    visual_theme,category,media_type,media_url,collection_name,traits,
    is_listed_on_p2p,p2p_price_fiat,p2p_currency,p2p_payment_methods,
    eligible_interactions,interest_level,interest_score,
    conversion_eligible,conversion_liquidity
  ) values (
    v_user,trim(p_title),coalesce(p_description,''),p_price_usdt,p_price_usdt,
    coalesce(p_visual_theme,'custom_upload'),coalesce(p_category,'generative'),
    coalesce(p_media_type,'image'),p_media_url,p_collection_name,
    coalesce(p_traits,'[]'::jsonb),
    false,null,null,'[]'::jsonb,
    0,'Not reported',0,false,'Not reported'
  )
  returning * into v_art;
  insert into public.artwork_ownership(artwork_id,owner_id,purchase_price_usdt)
    values(v_art.id,v_user,p_price_usdt);
  insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata)
    values(v_user,'artwork_created','artwork',v_art.id::text,jsonb_build_object('title',v_art.title,'price_usdt',p_price_usdt));
  return v_art;
end;
$function$;

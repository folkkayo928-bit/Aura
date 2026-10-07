-- AURA additive backend foundation: admin operations, wallet controls, scheduled drops.
-- Admin functions are guarded by public.is_aura_admin(). No existing customer workflow is replaced.

create table if not exists public.aura_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'operator' check (role in ('owner','finance','operator','moderator')),
  active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.aura_admins enable row level security;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;

create index if not exists aura_admins_active_idx on public.aura_admins(active);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_entity_idx on public.admin_audit_log(entity_type, entity_id);

create table if not exists public.aura_drops (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references public.collections(id) on delete set null,
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  banner_url text,
  mint_price_usdt numeric not null default 0 check (mint_price_usdt >= 0),
  supply integer not null default 1 check (supply > 0),
  minted_so_far integer not null default 0 check (minted_so_far >= 0 and minted_so_far <= supply),
  category text not null default 'generative',
  scheduled_at timestamptz not null,
  whitelist_open boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','live','completed','cancelled')),
  perks jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.aura_drops enable row level security;

create index if not exists aura_drops_status_scheduled_idx on public.aura_drops(status, scheduled_at);
create index if not exists aura_drops_collection_idx on public.aura_drops(collection_id);
create index if not exists aura_drops_creator_idx on public.aura_drops(creator_id);

create table if not exists public.aura_drop_reminders (
  drop_id uuid not null references public.aura_drops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(drop_id, user_id)
);
alter table public.aura_drop_reminders enable row level security;
create index if not exists aura_drop_reminders_user_idx on public.aura_drop_reminders(user_id);

create or replace function public.is_aura_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.aura_admins where user_id=p_user_id and active=true);
$$;

create policy aura_drops_public_read on public.aura_drops
for select to public using (status in ('scheduled','live','completed'));

create policy aura_drop_reminders_self_read on public.aura_drop_reminders
for select to authenticated using (user_id=auth.uid());
create policy aura_drop_reminders_self_insert on public.aura_drop_reminders
for insert to authenticated with check (user_id=auth.uid());
create policy aura_drop_reminders_self_delete on public.aura_drop_reminders
for delete to authenticated using (user_id=auth.uid());

create or replace function public.toggle_aura_drop_reminder(p_drop_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_status text; v_exists boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select status into v_status from public.aura_drops where id=p_drop_id;
  if not found then raise exception 'DROP_NOT_FOUND'; end if;
  if v_status not in ('scheduled','live') then raise exception 'DROP_NOT_ACTIVE'; end if;
  select exists(select 1 from public.aura_drop_reminders where drop_id=p_drop_id and user_id=v_user) into v_exists;
  if v_exists then
    delete from public.aura_drop_reminders where drop_id=p_drop_id and user_id=v_user;
    return false;
  end if;
  insert into public.aura_drop_reminders(drop_id,user_id) values(p_drop_id,v_user) on conflict do nothing;
  return true;
end;
$$;

create or replace function public.admin_dashboard_snapshot()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_total_users bigint; v_active_wallets bigint; v_total_wallet_balance numeric;
  v_pending_withdrawals bigint; v_queued_withdrawals bigint; v_detected_deposits bigint;
  v_credited_deposits bigint; v_open_p2p_orders bigint; v_scheduled_drops bigint; v_live_artworks bigint;
begin
  if not public.is_aura_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select count(*) into v_total_users from public.profiles;
  select count(*) into v_active_wallets from public.wallet_accounts where status='active';
  select coalesce(sum(balance_usdt),0) into v_total_wallet_balance from public.wallet_accounts;
  select count(*) into v_pending_withdrawals from public.wallet_withdrawals where status='pending_email_confirmation';
  select count(*) into v_queued_withdrawals from public.wallet_withdrawals where status in ('queued','processing');
  select count(*) into v_detected_deposits from public.wallet_deposits where status='detected';
  select count(*) into v_credited_deposits from public.wallet_deposits where status='credited';
  select count(*) into v_open_p2p_orders from public.p2p_orders where status in ('escrow_locked','payment_marked','in_dispute');
  select count(*) into v_scheduled_drops from public.aura_drops where status='scheduled';
  select count(*) into v_live_artworks from public.artworks where published=true;
  return jsonb_build_object(
    'totalUsers',v_total_users,'activeWallets',v_active_wallets,'totalWalletBalanceUSDT',v_total_wallet_balance,
    'pendingWithdrawals',v_pending_withdrawals,'queuedWithdrawals',v_queued_withdrawals,'detectedDeposits',v_detected_deposits,
    'creditedDeposits',v_credited_deposits,'openP2POrders',v_open_p2p_orders,'scheduledDrops',v_scheduled_drops,
    'liveArtworks',v_live_artworks,'generatedAt',now()
  );
end;
$$;

create or replace function public.admin_create_drop(
  p_title text,p_description text,p_scheduled_at timestamptz,p_mint_price_usdt numeric default 0,
  p_supply integer default 1,p_collection_id uuid default null,p_creator_id uuid default null,
  p_banner_url text default null,p_category text default 'generative',
  p_whitelist_open boolean default false,p_perks jsonb default '[]'::jsonb
)
returns public.aura_drops language plpgsql security definer set search_path=public as $$
declare v_drop public.aura_drops; v_admin uuid:=auth.uid();
begin
  if not public.is_aura_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if trim(coalesce(p_title,''))='' then raise exception 'INVALID_DROP_TITLE'; end if;
  if p_scheduled_at is null then raise exception 'INVALID_DROP_DATE'; end if;
  if p_supply is null or p_supply<=0 then raise exception 'INVALID_DROP_SUPPLY'; end if;
  if p_mint_price_usdt is null or p_mint_price_usdt<0 then raise exception 'INVALID_DROP_PRICE'; end if;
  insert into public.aura_drops(collection_id,creator_id,title,description,banner_url,mint_price_usdt,supply,category,scheduled_at,whitelist_open,status,perks,created_by)
  values(p_collection_id,p_creator_id,trim(p_title),left(trim(coalesce(p_description,'')),5000),nullif(trim(coalesce(p_banner_url,'')),''),
    p_mint_price_usdt,p_supply,
    case when p_category in ('generative','sculpture','minimalist','kinetic','botanical','cyber','anime_pfp','brand_streetwear','ui_design','gif_animation') then p_category else 'generative' end,
    p_scheduled_at,coalesce(p_whitelist_open,false),'draft',
    case when jsonb_typeof(coalesce(p_perks,'[]'::jsonb))='array' then p_perks else '[]'::jsonb end,v_admin)
  returning * into v_drop;
  insert into public.admin_audit_log(admin_user_id,action,entity_type,entity_id,metadata)
  values(v_admin,'create_drop','aura_drop',v_drop.id::text,jsonb_build_object('title',v_drop.title));
  return v_drop;
end;
$$;

create or replace function public.admin_set_drop_status(p_drop_id uuid,p_status text)
returns public.aura_drops language plpgsql security definer set search_path=public as $$
declare v_drop public.aura_drops; v_admin uuid:=auth.uid();
begin
  if not public.is_aura_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('draft','scheduled','live','completed','cancelled') then raise exception 'INVALID_DROP_STATUS'; end if;
  update public.aura_drops set status=p_status,
    published_at=case when p_status in ('scheduled','live') then coalesce(published_at,now()) else published_at end,updated_at=now()
  where id=p_drop_id returning * into v_drop;
  if not found then raise exception 'DROP_NOT_FOUND'; end if;
  insert into public.admin_audit_log(admin_user_id,action,entity_type,entity_id,metadata)
  values(v_admin,'set_drop_status','aura_drop',p_drop_id::text,jsonb_build_object('status',p_status));
  return v_drop;
end;
$$;

create or replace function public.admin_set_wallet_status(p_user_id uuid,p_status text,p_reason text)
returns public.wallet_accounts language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=auth.uid(); v_wallet public.wallet_accounts;
begin
  if not public.is_aura_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('active','locked') then raise exception 'INVALID_WALLET_STATUS'; end if;
  if char_length(trim(coalesce(p_reason,'')))<8 then raise exception 'ADMIN_REASON_REQUIRED'; end if;
  update public.wallet_accounts set status=p_status,updated_at=now() where user_id=p_user_id returning * into v_wallet;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  insert into public.admin_audit_log(admin_user_id,action,entity_type,entity_id,metadata)
  values(v_admin,'set_wallet_status','wallet_account',v_wallet.id::text,jsonb_build_object('user_id',p_user_id,'status',p_status,'reason',left(trim(p_reason),1000)));
  return v_wallet;
end;
$$;

create or replace function public.admin_wallet_adjustment(p_user_id uuid,p_direction text,p_amount_usdt numeric,p_reason text)
returns public.wallet_accounts language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=auth.uid(); v_wallet public.wallet_accounts; v_before numeric; v_after numeric; v_ledger_id uuid;
begin
  if not public.is_aura_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_direction not in ('credit','debit') then raise exception 'INVALID_ADJUSTMENT_DIRECTION'; end if;
  if p_amount_usdt is null or p_amount_usdt<=0 then raise exception 'INVALID_ADJUSTMENT_AMOUNT'; end if;
  if char_length(trim(coalesce(p_reason,'')))<10 then raise exception 'ADMIN_REASON_REQUIRED'; end if;
  select * into v_wallet from public.wallet_accounts where user_id=p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_wallet.status<>'active' then raise exception 'WALLET_NOT_ACTIVE'; end if;
  v_before:=v_wallet.balance_usdt;
  v_after:=case when p_direction='credit' then v_before+p_amount_usdt else v_before-p_amount_usdt end;
  if v_after<0 then raise exception 'INSUFFICIENT_WALLET_BALANCE'; end if;
  update public.wallet_accounts set balance_usdt=v_after,updated_at=now() where id=v_wallet.id;
  insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,memo)
  values(v_wallet.id,p_user_id,p_direction,p_amount_usdt,'admin_adjustment',left(trim(p_reason),2000))
  returning id into v_ledger_id;
  insert into public.admin_audit_log(admin_user_id,action,entity_type,entity_id,metadata)
  values(v_admin,'wallet_adjustment','wallet_account',v_wallet.id::text,jsonb_build_object('user_id',p_user_id,'direction',p_direction,'amount_usdt',p_amount_usdt,'before_balance_usdt',v_before,'after_balance_usdt',v_after,'ledger_id',v_ledger_id,'reason',left(trim(p_reason),1000)));
  select * into v_wallet from public.wallet_accounts where id=v_wallet.id;
  return v_wallet;
end;
$$;

create or replace function public.admin_reject_pending_withdrawal(p_withdrawal_id uuid,p_reason text)
returns public.wallet_withdrawals language plpgsql security definer set search_path=public as $$
declare v_admin uuid:=auth.uid(); v_withdrawal public.wallet_withdrawals; v_wallet public.wallet_accounts; v_refund numeric;
begin
  if not public.is_aura_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_reason,'')))<10 then raise exception 'ADMIN_REASON_REQUIRED'; end if;
  select * into v_withdrawal from public.wallet_withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_withdrawal.status<>'pending_email_confirmation' then raise exception 'WITHDRAWAL_NOT_ADMIN_REJECTABLE'; end if;
  v_refund:=v_withdrawal.amount+v_withdrawal.network_fee;
  select * into v_wallet from public.wallet_accounts where user_id=v_withdrawal.user_id and status='active' for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  update public.wallet_accounts set balance_usdt=balance_usdt+v_refund,updated_at=now() where id=v_wallet.id;
  insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
  values(v_wallet.id,v_withdrawal.user_id,'credit',v_refund,'admin_withdrawal_reject',v_withdrawal.id::text,left(trim(p_reason),2000));
  update public.wallet_withdrawals set status='rejected',rejection_reason=left(trim(p_reason),2000),updated_at=now(),
    security_note='Rejected by authorized AURA operator; reserved funds refunded. No blockchain broadcast occurred.'
  where id=v_withdrawal.id returning * into v_withdrawal;
  insert into public.admin_audit_log(admin_user_id,action,entity_type,entity_id,metadata)
  values(v_admin,'reject_withdrawal','wallet_withdrawal',v_withdrawal.id::text,jsonb_build_object('user_id',v_withdrawal.user_id,'refund_usdt',v_refund,'reason',left(trim(p_reason),1000)));
  return v_withdrawal;
end;
$$;

revoke all on function public.is_aura_admin(uuid) from public;
grant execute on function public.is_aura_admin(uuid) to authenticated;
revoke all on function public.admin_dashboard_snapshot() from public;
grant execute on function public.admin_dashboard_snapshot() to authenticated;
revoke all on function public.admin_create_drop(text,text,timestamptz,numeric,integer,uuid,uuid,text,text,boolean,jsonb) from public;
grant execute on function public.admin_create_drop(text,text,timestamptz,numeric,integer,uuid,uuid,text,text,boolean,jsonb) to authenticated;
revoke all on function public.admin_set_drop_status(uuid,text) from public;
grant execute on function public.admin_set_drop_status(uuid,text) to authenticated;
revoke all on function public.admin_set_wallet_status(uuid,text,text) from public;
grant execute on function public.admin_set_wallet_status(uuid,text,text) to authenticated;
revoke all on function public.admin_wallet_adjustment(uuid,text,numeric,text) from public;
grant execute on function public.admin_wallet_adjustment(uuid,text,numeric,text) to authenticated;
revoke all on function public.admin_reject_pending_withdrawal(uuid,text) from public;
grant execute on function public.admin_reject_pending_withdrawal(uuid,text) to authenticated;

revoke all on function public.aura_worker_read_withdrawals(integer,integer) from public;
revoke all on function public.aura_worker_delete_withdrawal_message(bigint) from public;
grant execute on function public.aura_worker_read_withdrawals(integer,integer) to service_role;
grant execute on function public.aura_worker_delete_withdrawal_message(bigint) to service_role;

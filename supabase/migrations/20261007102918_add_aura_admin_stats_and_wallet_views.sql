create or replace function public.admin_list_wallets(p_limit integer default 100)
returns table(
  user_id uuid,
  handle text,
  display_name text,
  wallet_id uuid,
  balance_usdt numeric,
  wallet_status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select p.id,p.handle,p.display_name,w.id,w.balance_usdt,w.status,w.created_at
  from public.wallet_accounts w
  join public.profiles p on p.id=w.user_id
  where public.is_aura_admin()
  order by w.balance_usdt desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

create or replace function public.admin_financial_timeseries(p_days integer default 30)
returns table(
  metric_date date,
  ledger_credits_usdt numeric,
  ledger_debits_usdt numeric,
  onchain_deposits_usdt numeric,
  withdrawals_usdt numeric,
  p2p_order_volume_usdt numeric
)
language sql
stable
security definer
set search_path=public
as $$
  with days as (
    select generate_series(
      current_date - greatest(1,least(coalesce(p_days,30),365)) + 1,
      current_date,
      interval '1 day'
    )::date as metric_date
  ),
  credits as (
    select created_at::date as metric_date,
           coalesce(sum(amount_usdt) filter (where direction='credit'),0) as credits,
           coalesce(sum(amount_usdt) filter (where direction='debit'),0) as debits
    from public.wallet_ledger
    where created_at >= current_date - greatest(1,least(coalesce(p_days,30),365)) + 1
    group by 1
  ),
  deps as (
    select created_at::date as metric_date, coalesce(sum(amount),0) as amount
    from public.wallet_deposits
    where status='credited'
      and created_at >= current_date - greatest(1,least(coalesce(p_days,30),365)) + 1
    group by 1
  ),
  wd as (
    select created_at::date as metric_date, coalesce(sum(amount),0) as amount
    from public.wallet_withdrawals
    where status in ('queued','processing','broadcast','confirmed')
      and created_at >= current_date - greatest(1,least(coalesce(p_days,30),365)) + 1
    group by 1
  ),
  p2p as (
    select created_at::date as metric_date, coalesce(sum(crypto_amount),0) as amount
    from public.p2p_orders
    where status='completed'
      and created_at >= current_date - greatest(1,least(coalesce(p_days,30),365)) + 1
    group by 1
  )
  select d.metric_date,
         coalesce(c.credits,0),
         coalesce(c.debits,0),
         coalesce(dp.amount,0),
         coalesce(w.amount,0),
         coalesce(p.amount,0)
  from days d
  left join credits c on c.metric_date=d.metric_date
  left join deps dp on dp.metric_date=d.metric_date
  left join wd w on w.metric_date=d.metric_date
  left join p2p p on p.metric_date=d.metric_date
  where public.is_aura_admin()
  order by d.metric_date;
$$;

create or replace function public.admin_system_health()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select case
    when not public.is_aura_admin() then jsonb_build_object('error','ADMIN_REQUIRED')
    else jsonb_build_object(
      'onchainWallets', (select count(*) from public.onchain_wallets),
      'depositSweepPending', (select count(*) from public.wallet_deposits where sweep_status='pending' and status='credited'),
      'depositSweepFailed', (select count(*) from public.wallet_deposits where sweep_status='failed'),
      'withdrawalWorkerErrors', (select count(*) from public.wallet_withdrawals where last_worker_error is not null),
      'withdrawalQueued', (select count(*) from public.wallet_withdrawals where status='queued'),
      'withdrawalProcessing', (select count(*) from public.wallet_withdrawals where status='processing'),
      'p2pDisputes', (select count(*) from public.p2p_orders where status='in_dispute'),
      'generatedAt', now()
    )
  end;
$$;

revoke all on function public.admin_list_wallets(integer) from public;
revoke all on function public.admin_financial_timeseries(integer) from public;
revoke all on function public.admin_system_health() from public;
grant execute on function public.admin_list_wallets(integer) to authenticated;
grant execute on function public.admin_financial_timeseries(integer) to authenticated;
grant execute on function public.admin_system_health() to authenticated;

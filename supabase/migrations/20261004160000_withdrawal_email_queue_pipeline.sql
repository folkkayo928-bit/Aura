-- AURA withdrawal email confirmation, durable queue, broadcaster and on-chain confirmation pipeline.
create extension if not exists pgmq;
create extension if not exists pg_cron;

select pgmq.create('aura_withdrawals')
where not exists (select 1 from pgmq.list_queues() where queue_name='aura_withdrawals');
select pgmq.create('aura_withdrawal_confirmations')
where not exists (select 1 from pgmq.list_queues() where queue_name='aura_withdrawal_confirmations');

create table if not exists public.wallet_withdrawal_email_confirmations (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.wallet_withdrawals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.wallet_withdrawal_email_confirmations enable row level security;
revoke all on public.wallet_withdrawal_email_confirmations from public, anon, authenticated;

create index if not exists wallet_withdrawal_email_confirmations_withdrawal_idx on public.wallet_withdrawal_email_confirmations(withdrawal_id);
create index if not exists wallet_withdrawal_email_confirmations_expiry_idx on public.wallet_withdrawal_email_confirmations(expires_at);

alter table public.wallet_withdrawals
  add column if not exists queue_message_id bigint,
  add column if not exists confirmation_attempts integer not null default 0,
  add column if not exists last_worker_error text,
  add column if not exists next_attempt_at timestamptz;
create index if not exists wallet_withdrawals_queue_status_idx on public.wallet_withdrawals(status,next_attempt_at,created_at);

create or replace function public.issue_wallet_withdrawal_email_confirmation(p_withdrawal_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_user uuid:=auth.uid();
  v_withdrawal public.wallet_withdrawals;
  v_token text;
  v_hash text;
  v_expires timestamptz:=now()+interval '30 minutes';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_withdrawal from public.wallet_withdrawals where id=p_withdrawal_id and user_id=v_user for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_withdrawal.status<>'pending_email_confirmation' then raise exception 'WITHDRAWAL_EMAIL_CONFIRMATION_NOT_ALLOWED'; end if;
  delete from public.wallet_withdrawal_email_confirmations where withdrawal_id=v_withdrawal.id and consumed_at is null;
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');
  insert into public.wallet_withdrawal_email_confirmations(withdrawal_id,user_id,token_hash,expires_at)
  values(v_withdrawal.id,v_user,v_hash,v_expires);
  return jsonb_build_object('withdrawal_id',v_withdrawal.id,'token',v_token,'expires_at',v_expires);
end $$;
revoke all on function public.issue_wallet_withdrawal_email_confirmation(uuid) from public,anon;
grant execute on function public.issue_wallet_withdrawal_email_confirmation(uuid) to authenticated;

create or replace function public.confirm_wallet_withdrawal(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_hash text;
  v_confirmation public.wallet_withdrawal_email_confirmations;
  v_withdrawal public.wallet_withdrawals;
  v_message_id bigint;
begin
  if p_token is null or length(trim(p_token))<32 then raise exception 'INVALID_WITHDRAWAL_CONFIRMATION'; end if;
  v_hash:=encode(extensions.digest(trim(p_token),'sha256'),'hex');
  select * into v_confirmation from public.wallet_withdrawal_email_confirmations where token_hash=v_hash for update;
  if not found or v_confirmation.consumed_at is not null or v_confirmation.expires_at<=now() then raise exception 'INVALID_OR_EXPIRED_WITHDRAWAL_CONFIRMATION'; end if;
  select * into v_withdrawal from public.wallet_withdrawals where id=v_confirmation.withdrawal_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_withdrawal.status<>'pending_email_confirmation' then raise exception 'WITHDRAWAL_NOT_CONFIRMABLE'; end if;
  update public.wallet_withdrawal_email_confirmations set consumed_at=now() where id=v_confirmation.id;
  select pgmq.send('aura_withdrawals',jsonb_build_object('withdrawal_id',v_withdrawal.id::text)) into v_message_id;
  update public.wallet_withdrawals set status='queued',email_confirmed_at=now(),queue_message_id=v_message_id,updated_at=now(),security_note='Email confirmed; withdrawal queued for server-side blockchain broadcast.'
    where id=v_withdrawal.id returning * into v_withdrawal;
  return jsonb_build_object('withdrawal_id',v_withdrawal.id,'status',v_withdrawal.status,'queued_at',v_withdrawal.updated_at);
end $$;
revoke all on function public.confirm_wallet_withdrawal(text) from public;
grant execute on function public.confirm_wallet_withdrawal(text) to anon,authenticated;

create or replace function public.get_aura_worker_secret()
returns text language sql security definer set search_path=vault,public
as $$ select decrypted_secret from vault.decrypted_secrets where name='aura_worker_secret' limit 1 $$;
revoke all on function public.get_aura_worker_secret() from public,anon,authenticated;
grant execute on function public.get_aura_worker_secret() to service_role;

create or replace function public.aura_worker_read_withdrawals(p_visibility_timeout integer default 300,p_qty integer default 5)
returns jsonb language sql security definer set search_path=public,pgmq
as $$ select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from pgmq.read('aura_withdrawals',greatest(30,least(p_visibility_timeout,900)),greatest(1,least(p_qty,20))) m $$;
create or replace function public.aura_worker_delete_withdrawal_message(p_msg_id bigint)
returns boolean language sql security definer set search_path=public,pgmq
as $$ select pgmq.delete('aura_withdrawals',p_msg_id) $$;
create or replace function public.aura_worker_enqueue_confirmation(p_withdrawal_id uuid,p_delay_seconds integer default 30)
returns bigint language plpgsql security definer set search_path=public,pgmq as $$
declare v_id bigint;
begin select pgmq.send('aura_withdrawal_confirmations',jsonb_build_object('withdrawal_id',p_withdrawal_id::text),greatest(5,least(p_delay_seconds,3600))) into v_id; return v_id; end $$;
create or replace function public.aura_worker_read_confirmations(p_visibility_timeout integer default 300,p_qty integer default 10)
returns jsonb language sql security definer set search_path=public,pgmq
as $$ select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from pgmq.read('aura_withdrawal_confirmations',greatest(30,least(p_visibility_timeout,900)),greatest(1,least(p_qty,50))) m $$;
create or replace function public.aura_worker_delete_confirmation_message(p_msg_id bigint)
returns boolean language sql security definer set search_path=public,pgmq
as $$ select pgmq.delete('aura_withdrawal_confirmations',p_msg_id) $$;

revoke all on function public.aura_worker_read_withdrawals(integer,integer), public.aura_worker_delete_withdrawal_message(bigint), public.aura_worker_enqueue_confirmation(uuid,integer), public.aura_worker_read_confirmations(integer,integer), public.aura_worker_delete_confirmation_message(bigint) from public,anon,authenticated;
grant execute on function public.aura_worker_read_withdrawals(integer,integer), public.aura_worker_delete_withdrawal_message(bigint), public.aura_worker_enqueue_confirmation(uuid,integer), public.aura_worker_read_confirmations(integer,integer), public.aura_worker_delete_confirmation_message(bigint) to service_role;

-- The live project creates the two cron jobs only after Vault secrets
-- aura_project_url, aura_publishable_key and aura_worker_secret are configured.

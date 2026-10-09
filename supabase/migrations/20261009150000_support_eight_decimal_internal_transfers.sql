create or replace function public.internal_transfer(p_recipient text,p_amount_usdt numeric,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
 v_sender uuid:=auth.uid(); v_recipient uuid; v_sender_handle text; v_recipient_handle text;
 v_lookup text:=lower(trim(coalesce(p_recipient,'')));
 v_sender_wallet public.wallet_accounts%rowtype; v_recipient_wallet public.wallet_accounts%rowtype;
 v_existing public.wallet_internal_transfer_requests%rowtype; v_transfer_id uuid:=p_idempotency_key;
 v_inserted integer:=0;
begin
 if v_sender is null then raise exception 'AUTH_REQUIRED'; end if;
 if v_transfer_id is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
 if v_lookup='' then raise exception 'RECIPIENT_REQUIRED'; end if;
 if p_amount_usdt is null or p_amount_usdt<=0 then raise exception 'INVALID_AMOUNT'; end if;
 if p_amount_usdt<>round(p_amount_usdt,8) then raise exception 'INVALID_AMOUNT_PRECISION'; end if;
 select p.id,p.handle into v_recipient,v_recipient_handle from public.profiles p
 where lower(ltrim(p.handle,'@'))=ltrim(v_lookup,'@') or lower(p.vault_id)=v_lookup limit 1;
 if v_recipient is null then raise exception 'RECIPIENT_NOT_FOUND'; end if;
 if v_recipient=v_sender then raise exception 'SELF_TRANSFER_NOT_ALLOWED'; end if;
 select p.handle into v_sender_handle from public.profiles p where p.id=v_sender;
 if v_sender_handle is null then raise exception 'SENDER_PROFILE_NOT_FOUND'; end if;
 insert into public.wallet_internal_transfer_requests(request_id,sender_id,recipient_id,amount_usdt)
 values(v_transfer_id,v_sender,v_recipient,p_amount_usdt) on conflict(request_id) do nothing;
 get diagnostics v_inserted = row_count;
 select * into v_existing from public.wallet_internal_transfer_requests where request_id=v_transfer_id for update;
 if v_existing.sender_id<>v_sender or v_existing.recipient_id<>v_recipient or v_existing.amount_usdt<>p_amount_usdt then
   raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_DETAILS';
 end if;
 if v_inserted=0 then
   if exists(select 1 from public.wallet_ledger where kind='internal_transfer' and reference_id=v_transfer_id::text and user_id=v_sender and direction='debit') then
     return jsonb_build_object('ok',true,'already_processed',true,'transfer_id',v_transfer_id,'amount_usdt',p_amount_usdt);
   end if;
   raise exception 'TRANSFER_REQUEST_INCOMPLETE';
 end if;
 perform wa.id from public.wallet_accounts wa where wa.user_id in(v_sender,v_recipient) order by wa.user_id for update;
 select * into v_sender_wallet from public.wallet_accounts where user_id=v_sender;
 if not found then raise exception 'SENDER_WALLET_NOT_FOUND'; end if;
 select * into v_recipient_wallet from public.wallet_accounts where user_id=v_recipient;
 if not found then raise exception 'RECIPIENT_WALLET_NOT_FOUND'; end if;
 if v_sender_wallet.status<>'active' then raise exception 'SENDER_WALLET_NOT_ACTIVE'; end if;
 if v_recipient_wallet.status<>'active' then raise exception 'RECIPIENT_WALLET_NOT_ACTIVE'; end if;
 if v_sender_wallet.balance_usdt<p_amount_usdt then raise exception 'INSUFFICIENT_FUNDS'; end if;
 update public.wallet_accounts set balance_usdt=balance_usdt-p_amount_usdt,updated_at=now() where id=v_sender_wallet.id;
 update public.wallet_accounts set balance_usdt=balance_usdt+p_amount_usdt,updated_at=now() where id=v_recipient_wallet.id;
 insert into public.wallet_ledger(wallet_id,user_id,direction,amount_usdt,kind,reference_id,memo)
 values
 (v_sender_wallet.id,v_sender,'debit',p_amount_usdt,'internal_transfer',v_transfer_id::text,'Internal transfer to '||coalesce(v_recipient_handle,'AURA user')),
 (v_recipient_wallet.id,v_recipient,'credit',p_amount_usdt,'internal_transfer',v_transfer_id::text,'Internal transfer from '||coalesce(v_sender_handle,'AURA user'));
 insert into public.activity_events(user_id,kind,entity_type,entity_id,metadata)
 values
 (v_sender,'wallet_sent','wallet',v_transfer_id::text,jsonb_build_object('amount_usdt',p_amount_usdt,'recipient_id',v_recipient,'transfer_id',v_transfer_id)),
 (v_recipient,'wallet_received','wallet',v_transfer_id::text,jsonb_build_object('amount_usdt',p_amount_usdt,'sender_id',v_sender,'transfer_id',v_transfer_id));
 return jsonb_build_object('ok',true,'already_processed',false,'transfer_id',v_transfer_id,'amount_usdt',p_amount_usdt);
end;
$function$;
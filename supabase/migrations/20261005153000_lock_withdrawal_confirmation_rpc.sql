-- Keep withdrawal confirmation behind the Edge Function.
revoke execute on function public.confirm_wallet_withdrawal(text) from anon;
revoke execute on function public.confirm_wallet_withdrawal(text) from authenticated;

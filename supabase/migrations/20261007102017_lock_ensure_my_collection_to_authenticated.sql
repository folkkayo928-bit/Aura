revoke execute on function public.ensure_my_collection(text,text,text,text,text) from public;
revoke execute on function public.ensure_my_collection(text,text,text,text,text) from anon;
grant execute on function public.ensure_my_collection(text,text,text,text,text) to authenticated;

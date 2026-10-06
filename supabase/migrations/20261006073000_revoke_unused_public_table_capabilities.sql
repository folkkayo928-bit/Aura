do $$
declare
  r record;
begin
  for r in
    select format('%I.%I', schemaname, tablename) as fqtn
    from pg_tables
    where schemaname='public'
  loop
    execute format('revoke truncate, references, trigger on table %s from anon, authenticated', r.fqtn);
  end loop;
end $$;

-- Run once in Supabase SQL Editor if profile sync returns 500 / permission denied.
-- Fixes: permission denied for table profiles (42501)

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on table public.profiles to postgres, service_role;
grant select on table public.profiles to anon, authenticated;

grant all on table public.payment_sessions to postgres, service_role;
grant select on table public.payment_sessions to anon, authenticated;

grant all on table public.transfers to postgres, service_role;
grant select on table public.transfers to anon, authenticated;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant select on tables to anon, authenticated;

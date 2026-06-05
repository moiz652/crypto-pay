-- Crypto Pay MVP schema (Phase 0/1) + security hardening

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  privy_user_id text not null unique,
  display_name text,
  username text unique,
  wallet_address text
);

create index if not exists profiles_username_idx on public.profiles (username);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

create table if not exists public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  short_code text not null unique,
  creator_privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,

  chain_id integer not null,
  token_symbol text not null,
  token_address text not null,
  token_decimals integer not null,
  amount text not null,

  receiver_wallet_address text not null,

  status text not null default 'pending', -- pending | paid | expired | cancelled
  expires_at timestamptz not null,
  payer_tx_hash text
);

create index if not exists payment_sessions_short_code_idx on public.payment_sessions (short_code);

drop trigger if exists trg_payment_sessions_updated_at on public.payment_sessions;
create trigger trg_payment_sessions_updated_at
before update on public.payment_sessions
for each row
execute function public.set_updated_at();

alter table public.payment_sessions enable row level security;

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sender_privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  to_username text,
  to_wallet_address text not null,
  chain_id integer not null,
  token_symbol text not null,
  token_address text not null,
  token_decimals integer not null,
  amount text not null,
  tx_hash text not null unique
);

create index if not exists transfers_sender_idx on public.transfers (sender_privy_user_id, created_at desc);

alter table public.transfers enable row level security;

-- Kill switch / feature flags (H6)
create table if not exists public.feature_flags (
  feature_name text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (feature_name, enabled) values
  ('profile_sync', true),
  ('payment_sessions', true),
  ('transfers', true),
  ('users_resolve', true),
  ('activity', true)
on conflict (feature_name) do nothing;

alter table public.feature_flags enable row level security;

-- profiles: SELECT own, UPDATE own, SELECT by username (public)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_select_by_username on public.profiles;
create policy profiles_select_by_username on public.profiles
  for select
  to anon, authenticated
  using (username is not null);

-- payment_sessions: INSERT own, SELECT own or as payer, SELECT by short_code (public), UPDATE payer fields
drop policy if exists payment_sessions_insert_own on public.payment_sessions;
create policy payment_sessions_insert_own on public.payment_sessions
  for insert
  to authenticated
  with check (
    creator_privy_user_id = (select privy_user_id from public.profiles where id = auth.uid())
  );

drop policy if exists payment_sessions_select_own on public.payment_sessions;
create policy payment_sessions_select_own on public.payment_sessions
  for select
  to authenticated
  using (
    creator_privy_user_id = (select privy_user_id from public.profiles where id = auth.uid())
    or receiver_wallet_address = (select wallet_address from public.profiles where id = auth.uid())
  );

drop policy if exists payment_sessions_select_public on public.payment_sessions;
create policy payment_sessions_select_public on public.payment_sessions
  for select
  to anon, authenticated
  using (short_code is not null);

drop policy if exists payment_sessions_update_payer on public.payment_sessions;
create policy payment_sessions_update_payer on public.payment_sessions
  for update
  to authenticated
  using (status = 'pending' and expires_at > now())
  with check (status in ('paid', 'pending'));

-- transfers: INSERT service_role only (no insert policy for anon/authenticated), SELECT own
drop policy if exists transfers_select_own on public.transfers;
create policy transfers_select_own on public.transfers
  for select
  to authenticated
  using (
    sender_privy_user_id = (select privy_user_id from public.profiles where id = auth.uid())
    or to_wallet_address = (select wallet_address from public.profiles where id = auth.uid())
  );

-- feature_flags: service_role only (no client policies)
drop policy if exists feature_flags_deny_all on public.feature_flags;
create policy feature_flags_deny_all on public.feature_flags
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Privileges (required for service_role / anon via PostgREST)
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on table public.profiles to postgres, service_role;
grant select on table public.profiles to anon, authenticated;

grant all on table public.payment_sessions to postgres, service_role;
grant select on table public.payment_sessions to anon, authenticated;

grant all on table public.transfers to postgres, service_role;
grant select on table public.transfers to anon, authenticated;

grant all on table public.feature_flags to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant select on tables to anon, authenticated;

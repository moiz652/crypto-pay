-- Crypto Pay MVP schema (Phase 0/1)

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

-- For MVP we use a server-side service role key for profile sync, so no direct client access is required yet.
-- Add RLS policies later once you decide whether to map Privy identities into Supabase Auth.

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
  tx_hash text not null
);

create index if not exists transfers_sender_idx on public.transfers (sender_privy_user_id, created_at desc);

alter table public.transfers enable row level security;

-- Privileges (required for service_role / anon via PostgREST)
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


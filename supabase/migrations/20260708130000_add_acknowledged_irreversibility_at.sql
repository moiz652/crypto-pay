alter table public.profiles
  add column if not exists acknowledged_irreversibility_at timestamptz;

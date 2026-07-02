alter table public.sessions
  add column if not exists coach_hidden_at timestamptz;

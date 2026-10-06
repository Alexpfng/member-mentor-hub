alter table public.planned_sessions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists planned_sessions_catchup_idx
  on public.planned_sessions (member_id, planned_date)
  where metadata @> '{"catchup": true}'::jsonb;

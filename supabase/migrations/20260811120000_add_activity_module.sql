-- Module Activité : saisie quotidienne des pas et calories par le membre,
-- consultée par le coach, avec objectifs quotidiens fixés par le coach.
-- Calqué sur weight_logs (mêmes policies RLS).

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  steps integer check (steps is null or (steps >= 0 and steps <= 200000)),
  calories integer check (calories is null or (calories >= 0 and calories <= 30000)),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (member_id, date)
);

alter table public.activity_logs enable row level security;

drop policy if exists "Member manages own activity" on public.activity_logs;
create policy "Member manages own activity" on public.activity_logs
  for all using (auth.uid() = member_id) with check (auth.uid() = member_id);

drop policy if exists "Coach views activity" on public.activity_logs;
create policy "Coach views activity" on public.activity_logs
  for select using (has_role(auth.uid(), 'coach'::app_role));

create index if not exists activity_logs_member_date_idx
  on public.activity_logs (member_id, date desc);

-- Objectifs quotidiens fixés par le coach, stockés sur le profil du membre
alter table public.profiles
  add column if not exists daily_steps_goal integer,
  add column if not exists daily_calories_goal integer;

alter table public.profiles drop constraint if exists profiles_daily_steps_goal_check;
alter table public.profiles add constraint profiles_daily_steps_goal_check
  check (daily_steps_goal is null or (daily_steps_goal >= 0 and daily_steps_goal <= 200000));

alter table public.profiles drop constraint if exists profiles_daily_calories_goal_check;
alter table public.profiles add constraint profiles_daily_calories_goal_check
  check (daily_calories_goal is null or (daily_calories_goal >= 0 and daily_calories_goal <= 30000));

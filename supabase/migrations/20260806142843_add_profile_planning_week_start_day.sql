alter table public.profiles
add column if not exists planning_week_start_day smallint;

alter table public.profiles
drop constraint if exists profiles_planning_week_start_day_check;

alter table public.profiles
add constraint profiles_planning_week_start_day_check
check (planning_week_start_day between 1 and 7);

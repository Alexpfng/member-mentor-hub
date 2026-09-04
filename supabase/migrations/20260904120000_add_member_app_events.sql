-- Journal de parcours coaché : navigation, séances, Strava et événements utiles au support.

create table if not exists public.member_app_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text not null default 'member'
    check (actor_role in ('member', 'coach', 'system')),
  event_name text not null,
  surface text not null default 'member_app',
  path text,
  session_id uuid references public.sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists member_app_events_member_created_idx
  on public.member_app_events(member_id, created_at desc);

create index if not exists member_app_events_session_idx
  on public.member_app_events(session_id, created_at desc);

create index if not exists member_app_events_event_created_idx
  on public.member_app_events(event_name, created_at desc);

alter table public.member_app_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_app_events'
      and policyname = 'Member reads own app events'
  ) then
    create policy "Member reads own app events"
    on public.member_app_events
    for select
    to authenticated
    using ((select auth.uid()) = member_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_app_events'
      and policyname = 'Coach reads member app events'
  ) then
    create policy "Coach reads member app events"
    on public.member_app_events
    for select
    to authenticated
    using (public.has_role((select auth.uid()), 'coach'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_app_events'
      and policyname = 'Member inserts own app events'
  ) then
    create policy "Member inserts own app events"
    on public.member_app_events
    for insert
    to authenticated
    with check (
      (select auth.uid()) = member_id
      and (actor_user_id is null or actor_user_id = (select auth.uid()))
      and actor_role = 'member'
    );
  end if;
end $$;

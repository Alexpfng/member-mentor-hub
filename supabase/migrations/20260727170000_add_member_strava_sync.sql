-- Connexion Strava individuelle par membre + journal d'import des activités.

create table if not exists public.member_strava_connections (
  member_id uuid primary key references public.profiles(id) on delete cascade,
  strava_athlete_id bigint not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text[] not null default '{}',
  last_sync_at timestamptz,
  last_webhook_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_strava_activities (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  strava_activity_id bigint not null unique,
  session_id uuid references public.sessions(id) on delete set null,
  activity_type text not null,
  name text,
  started_at timestamptz not null,
  distance_m numeric,
  moving_time_s integer,
  elapsed_time_s integer,
  elevation_gain_m integer,
  average_heartrate numeric,
  average_speed_mps numeric,
  raw_payload jsonb,
  sync_status text not null default 'imported',
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_strava_activities_member_idx
  on public.member_strava_activities(member_id, started_at desc);

create index if not exists member_strava_activities_session_idx
  on public.member_strava_activities(session_id);

create index if not exists member_strava_connections_athlete_idx
  on public.member_strava_connections(strava_athlete_id);

alter table public.member_strava_connections enable row level security;
alter table public.member_strava_activities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_strava_connections'
      and policyname = 'Member reads own Strava connection'
  ) then
    create policy "Member reads own Strava connection"
    on public.member_strava_connections
    for select
    to authenticated
    using ((select auth.uid()) = member_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_strava_connections'
      and policyname = 'Coach reads member Strava connection'
  ) then
    create policy "Coach reads member Strava connection"
    on public.member_strava_connections
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.member_profiles mp
        where mp.member_id = member_strava_connections.member_id
          and mp.coach_id = (select auth.uid())
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_strava_activities'
      and policyname = 'Member reads own Strava activities'
  ) then
    create policy "Member reads own Strava activities"
    on public.member_strava_activities
    for select
    to authenticated
    using ((select auth.uid()) = member_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_strava_activities'
      and policyname = 'Coach reads member Strava activities'
  ) then
    create policy "Coach reads member Strava activities"
    on public.member_strava_activities
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.member_profiles mp
        where mp.member_id = member_strava_activities.member_id
          and mp.coach_id = (select auth.uid())
      )
    );
  end if;
end $$;

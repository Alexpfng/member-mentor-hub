-- Communauté : fil d'actualité des jalons + défi du mois.
--
-- Le fil ne stocke RIEN : les jalons sont recalculés depuis les séances, les
-- records et le tonnage. Seul le consentement de partage est persisté, et il est
-- explicitement opt-in : afficher le prénom et l'activité d'un client aux autres
-- clients du coach ne peut pas être un défaut.

alter table public.profiles
  add column if not exists share_milestones boolean not null default false;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  -- Métriques calculables depuis l'existant, aucune saisie manuelle du membre.
  metric text not null check (metric in ('sessions', 'volume_kg', 'distance_km')),
  target numeric not null check (target > 0),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_dates_ordered check (ends_on >= starts_on)
);

create index if not exists challenges_coach_dates_idx
  on public.challenges (coach_id, starts_on desc);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, member_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

do $$
begin
  -- Lecture ouverte aux connectés : un défi est collectif par nature.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenges'
      and policyname = 'Authenticated read challenges'
  ) then
    create policy "Authenticated read challenges"
    on public.challenges
    for select
    to authenticated
    using (true);
  end if;

  -- Seul un coach crée ou modifie un défi.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenges'
      and policyname = 'Coach writes challenges'
  ) then
    create policy "Coach writes challenges"
    on public.challenges
    for all
    to authenticated
    using (public.has_role((select auth.uid()), 'coach'))
    with check (public.has_role((select auth.uid()), 'coach'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_participants'
      and policyname = 'Authenticated read participants'
  ) then
    create policy "Authenticated read participants"
    on public.challenge_participants
    for select
    to authenticated
    using (true);
  end if;

  -- Un membre s'inscrit et se retire lui-même, personne ne l'inscrit d'office.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_participants'
      and policyname = 'Member manages own participation'
  ) then
    create policy "Member manages own participation"
    on public.challenge_participants
    for all
    to authenticated
    using ((select auth.uid()) = member_id)
    with check ((select auth.uid()) = member_id);
  end if;
end $$;

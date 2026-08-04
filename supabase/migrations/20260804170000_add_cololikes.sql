-- Cololikes : encouragements laissés sur une entrée du fil communautaire.
--
-- Le fil est recalculé, il n'a pas de table d'événements. Un like porte donc sur
-- une CLÉ stable dérivée du contenu (`activity:<session_id>`,
-- `record:<membre>:<date>:<exercice>`, `tier:<membre>:<palier>`…), construite
-- côté application. Aucune clé étrangère : la même mécanique marche pour une
-- séance comme pour un palier, et un événement qui disparaît emporte
-- simplement ses likes avec lui.

create table if not exists public.cololikes (
  event_key text not null,
  liker_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_key, liker_id)
);

create index if not exists cololikes_event_idx on public.cololikes (event_key);

alter table public.cololikes enable row level security;

do $$
begin
  -- Les compteurs sont publics au sein de la communauté du coach.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cololikes'
      and policyname = 'Authenticated read cololikes'
  ) then
    create policy "Authenticated read cololikes"
    on public.cololikes
    for select
    to authenticated
    using (true);
  end if;

  -- On ne like que pour soi, et on retire son propre like.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cololikes'
      and policyname = 'Member manages own cololikes'
  ) then
    create policy "Member manages own cololikes"
    on public.cololikes
    for all
    to authenticated
    using ((select auth.uid()) = liker_id)
    with check ((select auth.uid()) = liker_id);
  end if;
end $$;

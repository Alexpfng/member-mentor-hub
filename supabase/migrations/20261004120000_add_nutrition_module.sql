-- Module Nutrition : objectif kcal consommees, aliments de reference et journal alimentaire.
-- Volontairement separe du module Activite afin de ne pas confondre calories mangees et depensees.

create table if not exists public.nutrition_goals (
  member_id uuid primary key references public.profiles(id) on delete cascade,
  daily_kcal_goal integer check (daily_kcal_goal is null or (daily_kcal_goal >= 0 and daily_kcal_goal <= 10000)),
  coach_note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Autre',
  kcal_per_100g integer not null check (kcal_per_100g >= 0 and kcal_per_100g <= 1000),
  protein_per_100g numeric(6,2) check (protein_per_100g is null or protein_per_100g >= 0),
  carbs_per_100g numeric(6,2) check (carbs_per_100g is null or carbs_per_100g >= 0),
  fat_per_100g numeric(6,2) check (fat_per_100g is null or fat_per_100g >= 0),
  is_default boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.nutrition_foods
  add constraint nutrition_foods_name_unique unique (name);

create table if not exists public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  food_id uuid references public.nutrition_foods(id) on delete set null,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner')),
  food_name text not null,
  grams integer not null check (grams > 0 and grams <= 5000),
  kcal_per_100g integer not null check (kcal_per_100g >= 0 and kcal_per_100g <= 1000),
  protein_per_100g numeric(6,2),
  carbs_per_100g numeric(6,2),
  fat_per_100g numeric(6,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.nutrition_goals enable row level security;
alter table public.nutrition_foods enable row level security;
alter table public.nutrition_entries enable row level security;

drop policy if exists "Member views own nutrition goal" on public.nutrition_goals;
create policy "Member views own nutrition goal" on public.nutrition_goals
  for select using (auth.uid() = member_id);

drop policy if exists "Coach manages nutrition goals" on public.nutrition_goals;
create policy "Coach manages nutrition goals" on public.nutrition_goals
  for all using (public.has_role(auth.uid(), 'coach'::app_role))
  with check (public.has_role(auth.uid(), 'coach'::app_role));

drop policy if exists "Users view nutrition foods" on public.nutrition_foods;
create policy "Users view nutrition foods" on public.nutrition_foods
  for select using (true);

drop policy if exists "Coach manages nutrition foods" on public.nutrition_foods;
create policy "Coach manages nutrition foods" on public.nutrition_foods
  for all using (public.has_role(auth.uid(), 'coach'::app_role))
  with check (public.has_role(auth.uid(), 'coach'::app_role));

drop policy if exists "Member manages own nutrition entries" on public.nutrition_entries;
create policy "Member manages own nutrition entries" on public.nutrition_entries
  for all using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

drop policy if exists "Coach views nutrition entries" on public.nutrition_entries;
create policy "Coach views nutrition entries" on public.nutrition_entries
  for select using (public.has_role(auth.uid(), 'coach'::app_role));

create index if not exists nutrition_entries_member_date_idx
  on public.nutrition_entries (member_id, date desc, created_at asc);

create index if not exists nutrition_foods_name_idx
  on public.nutrition_foods (name);

grant select on public.nutrition_goals to authenticated;
grant select, insert, update, delete on public.nutrition_entries to authenticated;
grant select on public.nutrition_foods to authenticated;

insert into public.nutrition_foods (name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
values
  ('Riz cuit', 'Feculent', 130, 2.7, 28.0, 0.3),
  ('Pates cuites', 'Feculent', 150, 5.0, 30.0, 1.0),
  ('Flocons d''avoine', 'Feculent', 370, 13.0, 60.0, 7.0),
  ('Poulet', 'Proteine', 165, 31.0, 0.0, 3.6),
  ('Oeufs', 'Proteine', 155, 13.0, 1.1, 11.0),
  ('Skyr', 'Proteine', 60, 10.0, 4.0, 0.2),
  ('Banane', 'Fruit', 89, 1.1, 23.0, 0.3),
  ('Pomme', 'Fruit', 52, 0.3, 14.0, 0.2),
  ('Avocat', 'Lipide', 160, 2.0, 9.0, 15.0),
  ('Huile d''olive', 'Lipide', 884, 0.0, 0.0, 100.0)
on conflict do nothing;

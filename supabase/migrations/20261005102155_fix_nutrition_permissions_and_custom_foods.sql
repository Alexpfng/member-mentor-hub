-- Corrige l'exposition Data API des tables nutrition.
-- Les policies RLS existent déjà : ces GRANT rendent seulement les tables joignables
-- par les rôles PostgREST utilisés par le front et les server functions.

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.nutrition_goals to authenticated, service_role;
grant insert, update, delete on table public.nutrition_goals to service_role;

grant select, insert on table public.nutrition_foods to authenticated, service_role;
grant update, delete on table public.nutrition_foods to service_role;

grant select, insert, update, delete on table public.nutrition_entries to authenticated, service_role;

drop policy if exists "Users create nutrition foods" on public.nutrition_foods;
create policy "Users create nutrition foods" on public.nutrition_foods
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and is_default = false
  );

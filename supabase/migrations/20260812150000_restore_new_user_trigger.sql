-- Sur la base wvcf (copie live migrée depuis l'ancienne base Lovable), le trigger
-- Supabase `on_auth_user_created` n'a pas été recréé : les triggers du schéma `auth`
-- ne suivent pas une copie du schéma `public`. Résultat : chaque NOUVELLE inscription
-- crée bien un `auth.users`, mais sans ligne `profiles` ni rôle `member` → le membre
-- n'apparaît jamais dans la liste des coachés (listMembers filtre role='member').
-- Les anciens membres avaient déjà leurs lignes copiées, d'où le bug invisible
-- jusqu'au premier nouveau client (Julien).

-- On durcit handle_new_user en idempotent : une erreur dans ce trigger AFTER INSERT
-- ferait échouer toute l'inscription. `on conflict do nothing` évite ça.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill : répare tous les comptes déjà créés sans profil / sans rôle (Julien inclus).
insert into public.profiles (id, email, first_name, last_name)
select u.id, u.email,
       trim(u.raw_user_meta_data->>'first_name'),
       trim(u.raw_user_meta_data->>'last_name')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'member'
from auth.users u
where not exists (select 1 from public.user_roles ur where ur.user_id = u.id)
on conflict do nothing;

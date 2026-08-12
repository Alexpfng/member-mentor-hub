-- L'app fonctionne sur invitation (le coach invite des personnes de confiance).
-- La confirmation d'email de Supabase (activée par défaut sur le projet) bloquait
-- l'onboarding : signUp ne renvoyait pas de session tant que l'email n'était pas
-- confirmé → le nouveau client atterrissait sur l'onboarding sans être connecté
-- (« Non connecté »). On auto-confirme donc chaque nouvel utilisateur.

create or replace function public.auto_confirm_email()
returns trigger
language plpgsql
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_confirm_email_trigger on auth.users;
create trigger auto_confirm_email_trigger
  before insert on auth.users
  for each row execute function public.auto_confirm_email();

-- Débloque les comptes déjà créés mais restés non confirmés.
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

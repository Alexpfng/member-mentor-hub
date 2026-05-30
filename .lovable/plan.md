
# Inscription clients sur invitation

## Objectif
Permettre aux clients de s'inscrire seuls via un lien d'invitation que tu génères, sans devoir créer les comptes toi-même, et sans confirmation email (accès direct).

## Étapes

### 1. Désactiver la confirmation email
- Auto-confirm activé : les nouveaux comptes sont utilisables immédiatement après signup.
- Signup global reste activé (sinon les invités ne pourraient pas créer leur compte).

### 2. Table `invitations`
Nouvelle table pour gérer les invitations émises par le coach :
- `token` (texte unique, généré aléatoirement) — utilisé dans l'URL
- `email` (optionnel — si rempli, l'invitation est verrouillée sur cet email)
- `created_by` (coach)
- `expires_at` (par défaut +14 jours)
- `used_at` / `used_by` (marqués au moment de l'inscription)

RLS :
- Coach : ALL sur ses propres invitations
- Anon : peut lire une invitation par `token` uniquement (pour valider le lien sur la page signup) — colonnes limitées via une fonction `validate_invitation(token)` SECURITY DEFINER qui renvoie juste `{ valid, email }`.

### 3. Page coach `/coach/invitations`
- Bouton "Créer une invitation" (email optionnel)
- Liste des invitations actives : lien copiable `https://app.colosmartraining.fr/signup?token=XXX`, statut (active / utilisée / expirée), bouton révoquer
- Lien dans la sidebar coach

### 4. Refonte de l'accès signup
- Retirer le toggle "S'inscrire" de `/login` (les clients ne peuvent plus s'inscrire librement)
- Nouvelle route `/signup?token=XXX` :
  - Valide le token via `validate_invitation`
  - Si invalide/expiré/utilisé → message d'erreur, pas de formulaire
  - Si valide → formulaire prénom/nom/email/mot de passe (email pré-rempli + verrouillé si l'invitation en spécifie un)
  - À la soumission : `supabase.auth.signUp` puis marque l'invitation comme utilisée, puis redirige vers `/onboarding/1`

### 5. Trigger existant (déjà OK)
`handle_new_user` crée déjà `profiles` + `user_roles` avec rôle `member`. Rien à changer.

## Détails techniques
- Génération token : `encode(gen_random_bytes(24), 'base64')` côté SQL ou `crypto.randomUUID()` côté client puis stocké.
- Marquage `used_at` : via un serverFn `consumeInvitation(token, userId)` appelé après le signup réussi (utilise `supabaseAdmin` pour bypass RLS et marquer atomiquement).
- Vérification d'unicité email gérée par Supabase Auth nativement.

## Hors scope
- Envoi automatique de l'email d'invitation (tu copies/colles le lien manuellement pour l'instant). On pourra brancher l'infra email `notify.bulbiz.io` plus tard si tu veux.

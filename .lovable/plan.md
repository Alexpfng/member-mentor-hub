
# Fiabiliser les emails de mot de passe oublié

## Diagnostic
- Le code de l'écran de login appelle bien `resetPasswordForEmail` avec un `redirectTo` valide, et la page `/reset-password` existe.
- Aucun domaine d'envoi n'est branché sur ce projet → les emails partent via l'expéditeur par défaut Supabase, qui est limité à ~2 mails/heure et atterrit fréquemment en spam.

## Plan

### 1. Choisir / brancher un domaine d'envoi
Deux options (à choisir avec toi avant de lancer) :
- **Option A — utiliser `colosmartraining.fr`** (recommandé, cohérent avec ton app).
  Tu ouvres la boîte de dialogue de setup, tu y ajoutes le domaine, et tu colles 2 enregistrements NS chez ton registrar (ex : `notify.colosmartraining.fr` délégué à Lovable).
- **Option B — réutiliser `bulbiz.io`** déjà vérifié dans le workspace (les mails partent depuis `notify.bulbiz.io`, ce qui peut être incohérent côté image de marque).

### 2. Mettre en place l'infrastructure d'emails
- Création des files d'attente, table de log d'envoi, suppressions, tokens unsubscribe.
- Création du job cron qui draine la queue (priorité haute pour les emails d'auth).

### 3. Scaffolder les templates d'emails d'auth personnalisés
Génère 6 templates React Email pour :
- réinitialisation de mot de passe (le cas qui te bloque),
- confirmation d'inscription, magic link, invitation, changement d'email, ré-authentification.
- Branding aligné sur l'app (logo CST, couleurs vert sombre, typographies du projet, textes en français).

### 4. Vérifications après mise en service
- Tester « Mot de passe oublié » avec un email réel.
- Si DNS encore en propagation : suivi visible dans **Cloud → Emails**.
- Vérifier le log d'envoi pour confirmer l'état `sent` (et pas `pending`/`dlq`).

## À décider avec toi avant de démarrer
1. Quel domaine d'envoi : `colosmartraining.fr` (option A) ou `bulbiz.io` (option B) ?
2. Adresse d'expéditeur souhaitée (ex : `coach@notify.colosmartraining.fr` ou `no-reply@…`) ?
3. As-tu accès à la zone DNS de `colosmartraining.fr` pour ajouter 2 enregistrements NS ?

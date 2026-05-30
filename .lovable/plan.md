# Réparer l'envoi des emails d'invitation

## Diagnostic

Toutes les invitations sont bien créées et déposées dans la file d'attente email (`email_send_log` montre 5 emails avec le statut `pending` depuis ce matin), mais **aucun email ne part**.

Cause : le job planifié qui vide la file d'attente email (`process-email-queue`) n'existe pas sur ce projet. Sans lui, les emails s'accumulent indéfiniment en `pending`.

## Plan

1. **Provisionner l'infrastructure email manquante** — exécuter la configuration qui :
   - Crée le job planifié qui traite la file toutes les 5 secondes
   - Stocke la clé d'accès sécurisée nécessaire au dispatcher
   - Vérifie que toutes les tables et files (`auth_emails`, `transactional_emails`) sont opérationnelles

2. **Rejouer les 5 invitations bloquées** une fois le dispatcher actif (soit en attendant le prochain cycle, soit en relançant l'envoi depuis l'écran Invitations).

3. **Vérifier** :
   - `cron.job` contient bien `process-email-queue`
   - Les lignes `pending` passent à `sent` dans `email_send_log`
   - L'email arrive bien dans la boîte du client de test (`alex.pfennig26@gmail.com`)

## Notes

- Aucun changement de code applicatif n'est nécessaire — le code d'envoi (`createInvitation`) est correct, il dépose bien le message dans la queue.
- Le domaine d'envoi `notify.bulbiz.io` est déjà vérifié.
- Si après activation un email reste bloqué, on regardera `error_message` dans `email_send_log` pour ajuster (souvent un domaine expéditeur ou suppression).

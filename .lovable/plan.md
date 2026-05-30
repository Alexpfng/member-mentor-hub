Je vais corriger le flux d’invitation pour que le client arrive bien sur la vraie page d’inscription et reçoive un email d’invitation.

## Plan

1. **Corriger l’URL des liens copiés**
   - Remplacer les liens générés avec le domaine Lovable interne par l’URL publique de l’app : `https://app.colosmartraining.fr/signup?token=...`.
   - Garder un fallback propre si l’app est testée en prévisualisation.

2. **Unifier le bouton “Inviter” du dashboard**
   - Le modal actuel utilise l’ancien système d’invitation qui envoie vers `/reset-password`.
   - Je vais le basculer sur le nouveau système `/signup?token=...`, pour que “Envoyer l’invitation” crée une invitation compatible avec l’inscription client.

3. **Activer l’envoi email d’invitation**
   - Utiliser l’infrastructure email déjà configurée et vérifiée sur `notify.bulbiz.io`.
   - Ajouter une fonction serveur sécurisée côté coach qui : crée l’invitation, génère le lien d’inscription, puis déclenche l’email d’invitation au client.
   - Adapter le contenu email pour dire clairement au client qu’il doit créer son compte via ce lien.

4. **Sécuriser le comportement**
   - Vérifier que seuls les coachs peuvent créer/envoyer des invitations.
   - Empêcher l’envoi si l’email est vide ou invalide.
   - Afficher un message clair en cas de succès ou d’erreur.

5. **Vérifier le résultat**
   - Contrôler que le lien affiché/copie pointe vers `/signup?token=...` sur le bon domaine.
   - Vérifier que l’email d’invitation est bien préparé avec le même lien.

## Détail technique

- Fichiers concernés principalement :
  - `src/pages/coach/Invitations.tsx`
  - `src/pages/coach/Dashboard.jsx`
  - `src/lib/invitations.functions.ts` ou `src/lib/coach.functions.ts`
  - templates email d’invitation si nécessaire
- Je ne vais pas rouvrir l’inscription publique : l’inscription restera uniquement sur invitation.
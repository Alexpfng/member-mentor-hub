Je vais simplifier le système d’invitation pour qu’il ne tente plus jamais d’envoyer d’email.

Plan :
1. Sur la page `/coach/invitations`, supprimer le bouton “Envoyer l’email” et garder uniquement “Générer un lien”.
2. Faire en sorte que la génération crée toujours une invitation avec `send_email: false`, puis affiche le lien à copier.
3. Dans le tableau de bord coach, remplacer la modale “envoyer une invitation par email” par une génération de lien à copier, sans envoi email.
4. Côté serveur, neutraliser la logique d’envoi email dans `createInvitation` pour éviter toute tentative d’envoi même si un ancien bouton ou appel passe `send_email: true`.
5. Mettre à jour les textes pour parler uniquement de lien d’inscription à transmettre manuellement au client.

Détail technique :
- Le lien restera au format `https://app.colosmartraining.fr/signup?token=...`.
- L’email pourra rester optionnel pour associer le lien à un client, mais aucun email ne sera envoyé automatiquement.
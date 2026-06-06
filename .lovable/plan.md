## Objectif

Faire en sorte que l’écran **Historique** de l’espace membre n’affiche jamais de séance inventée. Il doit afficher uniquement les séances réelles du membre connecté, issues de la base de données.

## Ce qui sera modifié

1. **Supprimer les données hardcodées**
   - Retirer la liste statique `MAI 2026 / AVRIL 2026` actuellement présente dans `src/pages/membre/Historique.jsx`.
   - Supprimer les textes comme `28 SÉANCES` s’ils ne viennent pas du nombre réel de séances.

2. **Charger les vraies séances du membre**
   - Récupérer l’utilisateur connecté.
   - Lire uniquement ses lignes réelles dans `sessions`, avec `status = completed`.
   - Trier par date décroissante.
   - Grouper l’affichage par mois à partir de la vraie date de séance.

3. **Afficher uniquement des métriques réelles**
   - Utiliser les champs existants de `sessions` :
     - `date`
     - `session_label`
     - `duration_minutes`
     - `average_rpe`
     - `total_volume_kg`
     - `week_number`
     - `day_number`
     - `member_note`
     - `coach_note`
   - Ne pas afficher de PR, nombre d’exercices ou note coach si la donnée n’existe pas réellement.

4. **Ajouter les données détaillées seulement si elles existent**
   - Récupérer les `set_logs` liés aux vraies séances pour calculer le nombre réel d’exercices distincts.
   - Récupérer les `personal_records` liés à ces séances pour afficher un vrai PR uniquement quand il existe.

5. **Gérer les états vides proprement**
   - Si aucune séance terminée n’existe : afficher un état vide clair, par exemple “Aucune séance terminée pour le moment”.
   - Ne jamais remplacer l’absence de données par des exemples.

## Détails techniques

- Fichier principal : `src/pages/membre/Historique.jsx`.
- Requêtes côté client avec le client existant et les RLS actuelles : le membre ne peut lire que ses propres `sessions`, `set_logs` et `personal_records`.
- Aucun changement de schéma base de données nécessaire.
- Aucun nouvel accès large ou donnée fictive ajoutée.

## Validation

- Ouvrir `/membre/historique`.
- Vérifier que les séances affichées correspondent aux vraies lignes `sessions` du membre connecté.
- Vérifier qu’un membre sans historique voit l’état vide, pas des exemples.
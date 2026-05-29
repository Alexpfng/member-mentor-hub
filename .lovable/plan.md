# Nettoyage des doublons d'exercices

## Constat
Sur la table `exercises` (non archivés), j'ai trouvé **10 paires de doublons exacts** (même nom, même catégorie). Aucun n'est référencé dans `set_logs` ni `personal_records` → suppression sans risque.

| # | Nom | Catégorie |
|---|---|---|
| 1 | Adducteurs en position étirée (pieds sur box ou banc) | mobility |
| 2 | Adducteurs work long range pied sur banc | isolation |
| 3 | Alternated b-stance Jump over the line | strength |
| 4 | Alternating Dumbbell Press from Deep Squat | strength |
| 5 | Arrière d'épaule à la machine | isolation |
| 6 | Arrière d'épaule unilatéral sur banc allongé | isolation |
| 7 | Arrière d'épaule unilattéral sur banc | explosive |
| 8 | Assault bike | other |
| 9 | Elevations latérales aux haltères | explosive |
| 10 | Tirage prise large coudes ouverts sur machine | explosive |

## À signaler (pas un doublon, mais suspect)
- **Ligne 7** : « Arrière d'épaule unila**tt**éral sur banc » contient une faute de frappe (double t). À renommer manuellement après nettoyage si tu veux harmoniser avec la ligne 6 « unilatéral ».

## Plan
1. **Migration SQL** : pour chacune des 10 paires, garder l'entrée la plus ancienne (`created_at` min) et supprimer l'autre. Sélection automatique via `ROW_NUMBER() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at)`.
2. Pas de mise à jour de références nécessaire (set_logs/PRs vides pour ces lignes).
3. **Vérification post-migration** : relancer la requête de détection, attendu = 0 ligne.

## Question avant exécution
- OK pour supprimer les 10 doublons en gardant la copie la plus ancienne de chaque paire ?
- Veux-tu que je corrige aussi la faute « unilattéral » → « unilatéral » dans la foulée ?

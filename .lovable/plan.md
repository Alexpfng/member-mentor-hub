## Le problème

L'écran d'erreur "This page didn't load…" en ligne vient de `getMemberDashboard` qui dépasse le délai d'attente du serveur :

```
error: getMemberDashboard failed
message: "upstream request timeout"
```

Dans `src/lib/member-stats.functions.ts`, le calcul du `streak` lance **jusqu'à 26 requêtes Supabase en série** (une par semaine, en `await` dans une boucle `for`). En prod (Cloudflare Worker → Supabase via Internet), chaque aller-retour coûte 80–200 ms, donc on tape facilement les 5–10 s de timeout du Worker — d'où le 500 générique côté navigateur.

En plus, la logique est buggée : si la semaine courante a `< 3` séances, on fait `continue` (au lieu de regarder la semaine d'avant), ce qui force la boucle à toujours faire les 26 itérations.

## Le correctif

Remplacer la boucle par **une seule requête** qui ramène toutes les sessions `completed` des 26 dernières semaines, puis grouper par semaine en mémoire pour calculer le streak.

### Fichier modifié

`src/lib/member-stats.functions.ts` — fonction `getMemberDashboard` uniquement.

### Détail technique

1. Dans le `Promise.all` initial, ajouter une 5e requête :
   ```
   supabaseAdmin
     .from("sessions")
     .select("date")
     .eq("member_id", context.userId)
     .eq("status", "completed")
     .gte("date", isoDay(26 semaines avant lundi))
     .lte("date", isoDay(sunday))
   ```
2. Côté JS : pour chaque ligne, calculer le lundi de sa semaine (`YYYY-MM-DD`), incrémenter un compteur par semaine dans une `Map`.
3. Itérer les semaines en partant de la semaine courante vers le passé :
   - semaine courante : si `count >= 3` → streak++, sinon on ignore (on n'arrête pas le streak sur une semaine en cours).
   - semaines passées : `count >= 3` → streak++, sinon `break`.
4. Supprimer la boucle `for (i=0; i<26; i++)` avec `await` dans le corps.

Aucun changement de schéma, aucun changement de l'API publique de la fonction (mêmes champs retournés). Les autres fonctions du fichier (`getMemberProgression`, `listMyExercises`, `getMyExerciseProgression`) ne sont pas touchées.

### Validation

- Rafraîchir `/membre` une fois loggué : le dashboard charge sans 500.
- Vérifier dans les logs Worker que `getMemberDashboard` ne renvoie plus `upstream request timeout`.
- Vérifier que `streak` affiché correspond bien aux semaines avec ≥ 3 séances complétées.

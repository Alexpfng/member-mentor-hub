# Diagnostic

Le message persiste après republication :

> Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY

Cela signifie que **le build de production n'a pas reçu les variables Vite** (`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`) au moment du déploiement, même si elles sont bien présentes dans le `.env` du sandbox de preview.

Dans Lovable, ce `.env` est **généré et géré automatiquement par l'intégration Lovable Cloud**. Quand le build de prod ne le voit pas, c'est presque toujours parce que l'intégration Cloud doit être rafraîchie côté projet.

Aucun changement de code n'est pertinent ici (le code `client.ts` est correct et auto-généré, et hardcoder les valeurs serait une mauvaise pratique).

# Solution

1. Ouvrir **Lovable Cloud** dans la barre latérale (Connectors → Lovable Cloud).
2. Cliquer sur **Refresh** / **Reconnect** sur l'intégration Supabase / Cloud du projet.
3. Attendre que le sandbox de preview redémarre et que la preview redevienne fonctionnelle (la connexion doit marcher en preview).
4. **Republier l'app** (bouton Publish en haut à droite).
5. Forcer un rechargement de `app.colosmartraining.fr` (Cmd+Shift+R) et retester la connexion.

# Si ça ne suffit toujours pas

- Vérifier dans **Backend → Settings** que les secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` apparaissent bien.
- Vérifier que le domaine custom `app.colosmartraining.fr` pointe bien vers la même app que `member-mentor-hub.lovable.app` (et non vers un ancien déploiement).
- En dernier recours : contacter le support Lovable — un refresh forcé côté infra peut être nécessaire.

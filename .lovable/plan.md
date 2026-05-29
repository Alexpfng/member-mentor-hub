# Diagnostic

L'erreur sur `app.colosmartraining.fr` :

> Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY

vient du fait que le **build publié en ligne est ancien** : il a été généré avant que les variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` soient présentes (ou avant la dernière mise à jour du client Supabase auto-généré).

Dans le projet actuel :
- Le fichier `.env` contient bien `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `src/integrations/supabase/client.ts` lit `import.meta.env.VITE_SUPABASE_URL` au build → ces valeurs sont injectées par Vite **au moment de la publication**.
- En preview ça fonctionne (build récent). En prod, le build affiché date d'avant et n'a pas ces valeurs intégrées → d'où le message d'erreur côté navigateur.

# Solution

Aucun changement de code n'est nécessaire. Il suffit de **republier l'app** pour que le nouveau build inclue les variables Vite et que la connexion fonctionne sur `app.colosmartraining.fr`.

Étapes :
1. Ouvrir le bouton **Publish** en haut à droite de Lovable.
2. Cliquer sur **Publish** (ou **Update**) pour redéployer la dernière version.
3. Attendre 1–2 minutes que le déploiement se termine.
4. Recharger `app.colosmartraining.fr` (avec un rafraîchissement forcé : Cmd+Shift+R) et retenter la connexion de Pierre.

# Si l'erreur persiste après republication

Cela voudrait dire que le build de production n'a pas injecté les variables Vite. Dans ce cas, les pistes seraient :
- Vérifier que les secrets côté Lovable Cloud sont bien rattachés au projet (visibles dans Backend → Settings).
- Forcer une régénération du client Supabase en touchant à la config Cloud (ex. ouvrir/fermer les paramètres backend) puis republier.

Mais dans 99 % des cas, une simple republication corrige ce message.

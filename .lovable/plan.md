## Diagnostic

La tentative de connexion échoue parce que le mot de passe envoyé contient un espace à la fin :

```text
"Pierre2026! "
```

Le vrai mot de passe attendu est :

```text
Pierre2026!
```

## Plan de correction

1. Modifier le formulaire de connexion pour nettoyer automatiquement le mot de passe saisi avant envoi.
2. Appliquer ce nettoyage uniquement à la connexion, pour éviter qu’un espace collé par erreur bloque Pierre.
3. Vérifier que l’email reste normalisé en minuscules comme actuellement.

## Résultat attendu

Pierre pourra se connecter avec `pierre-0214@outlook.fr` et `Pierre2026!`, même si un espace est collé accidentellement à la fin du mot de passe.
# Plan de correction des failles de sécurité

Trois failles détectées par le scanner. Voici comment je propose de les corriger.

## 1. `pinMessage` — n'importe quel utilisateur peut épingler n'importe quel message (warn)

**Fichier :** `src/lib/coach.functions.ts` (lignes 285-297)

Le handler utilise `supabaseAdmin` (qui bypass RLS) mais ne vérifie pas que l'appelant est participant à la conversation.

**Correction :** ajouter un filtre `.or('from_id.eq.<uid>,to_id.eq.<uid>')` sur l'update, et utiliser `context.userId` (le middleware `requireSupabaseAuth` le fournit déjà).

## 2. `saveRunningRoute` — un membre peut s'enregistrer comme coach (warn)

**Fichier :** `src/lib/coach.functions.ts` (lignes 619-657)

Le handler ne vérifie pas le rôle coach côté serveur — seul le routeur frontend bloque l'accès. Comme `supabaseAdmin` bypass RLS, un membre peut appeler la server function directement et créer un parcours en se mettant comme `coach_id`.

**Correction :** ajouter `await assertCoach(context.userId);` au début du handler (même pattern que les autres fonctions coach du fichier).

## 3. Mots de passe en clair dans les migrations (error) — action utilisateur requise

**Fichiers concernés :**
- `supabase/migrations/20260529125037_*.sql`
- `supabase/migrations/20260529152555_*.sql`

Ces fichiers contiennent en clair :
- `ColoSmart2024!` (compte coach)
- `TeddyBeta2024!` (compte test)
- `Pierre2026!` (compte de Pierre)

**Pourquoi je ne peux pas tout fixer automatiquement :**
- Réécrire l'historique git n'est pas possible depuis l'agent : les mots de passe resteront dans les anciens commits même si on nettoie les fichiers maintenant.
- Ces 3 mots de passe doivent donc être **considérés comme compromis** et **changés**.

**Ce que je vais faire côté code :**
- Supprimer les blocs de seed contenant ces mots de passe en clair dans les deux migrations (pour ne plus diffuser de nouveaux mots de passe en clair dans les futurs builds/forks). Les migrations resteront idempotentes pour les comptes déjà créés.

**Ce que tu dois faire (manuellement, je te guiderai) :**
1. Ouvrir Lovable Cloud → Users.
2. Pour les comptes Coach, Teddy et Pierre : utiliser **« Send password reset »** (ou changer le mot de passe directement) afin de poser de nouveaux mots de passe que tu communiqueras en privé à Pierre et Teddy.
3. Considérer les anciens mots de passe comme bannis.

Une fois ces deux étapes faites, je marquerai cette finding comme résolue.

# Étapes d'implémentation

1. Éditer `src/lib/coach.functions.ts` :
   - `pinMessage` : injecter `context` et ajouter le filtre d'ownership.
   - `saveRunningRoute` : ajouter `await assertCoach(context.userId);`.
2. Éditer les deux migrations pour retirer les `crypt('<password>', ...)` (remplacés par un commentaire indiquant que les mots de passe sont gérés via l'UI Auth).
3. Mettre à jour la security memory pour expliquer la posture (pas de seed de mot de passe en clair, role check obligatoire côté serveur sur toutes les fonctions admin).
4. Marquer les 2 findings de code comme `mark_as_fixed`.
5. Pour la finding « mots de passe » : la garder ouverte tant que tu n'as pas confirmé la rotation des 3 mots de passe via l'UI.

Pas de migration SQL nécessaire.

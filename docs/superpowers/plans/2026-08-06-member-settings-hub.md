# Member Settings Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l’espace profil coaché en vrai hub Réglages et rendre son accès évident depuis l’espace membre.

**Architecture:** Réutiliser la route membre existante `/membre/profil` comme écran de réglages sans changer la logique serveur. Renommer la navigation, réorganiser l’interface par sections claires et ajouter un accès rapide depuis le dashboard coaché.

**Tech Stack:** TanStack Start, React, TypeScript, JSX, Supabase, Bun

---

### Task 1: Renommer l’entrée de navigation coaché

**Files:**
- Modify: `src/components/MemberNav.jsx`

- [ ] **Step 1: Write the minimal UI change**

```jsx
{ id: "profile", icon: "⚙️", label: "Réglages", path: "/membre/profil" }
```

- [ ] **Step 2: Verify the file still parses**

Run: `bun run build`
Expected: build OK without navigation errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MemberNav.jsx
git commit -m "feat(member): rename profile nav to settings"
```

### Task 2: Rework the member profile page into a settings hub

**Files:**
- Modify: `src/pages/membre/Profil.tsx`

- [ ] **Step 1: Keep all existing server actions and state**

```tsx
const getPlanningSettings = useServerFn(getMemberPlanningSettings);
const updatePlanningSettings = useServerFn(updateMemberPlanningSettings);
const getStravaStatus = useServerFn(getStravaConnectionStatus);
const getConnectUrl = useServerFn(getStravaConnectUrl);
const disconnectStravaFn = useServerFn(disconnectStrava);
```

- [ ] **Step 2: Replace the top title and intro with a settings-oriented header**

```tsx
<h1 className="font-mono text-xs tracking-widest">RÉGLAGES</h1>
<p className="text-sm opacity-70">Retrouve ici tous tes paramètres coaché.</p>
```

- [ ] **Step 3: Group the page into four sections**

```tsx
<section>Planning</section>
<section>Notifications</section>
<section>Connexions</section>
<section>Compte</section>
```

- [ ] **Step 4: Preserve existing setting controls inside those sections**

```tsx
<select ...>{WEEK_START_OPTIONS.map(...)}</select>
<Switch ... />
<button onClick={handleConnectStrava}>...</button>
<button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>Se déconnecter</button>
```

- [ ] **Step 5: Verify the page builds**

Run: `bun run build`
Expected: build OK with `/membre/profil` still functional

- [ ] **Step 6: Commit**

```bash
git add src/pages/membre/Profil.tsx
git commit -m "feat(member): turn profile into settings hub"
```

### Task 3: Add a quick settings access on the member dashboard

**Files:**
- Modify: `src/pages/membre/Dashboard.jsx`

- [ ] **Step 1: Add a clear shortcut card/button near the top of the dashboard**

```jsx
<button onClick={() => tsNavigate({ to: "/membre/profil" })}>
  ⚙️ Réglages
</button>
```

- [ ] **Step 2: Make the shortcut visually consistent with the existing member UI**

```jsx
className / inline styles aligned with current CST card language
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: build OK and no router errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/membre/Dashboard.jsx
git commit -m "feat(member): add settings shortcut on dashboard"
```

### Task 4: Final verification

**Files:**
- Modify: `src/components/MemberNav.jsx`
- Modify: `src/pages/membre/Profil.tsx`
- Modify: `src/pages/membre/Dashboard.jsx`

- [ ] **Step 1: Run targeted build verification**

Run: `bun run build`
Expected: build OK

- [ ] **Step 2: Review diff**

Run: `git diff -- src/components/MemberNav.jsx src/pages/membre/Profil.tsx src/pages/membre/Dashboard.jsx`
Expected: only settings-hub related UI changes

- [ ] **Step 3: Commit final polish if needed**

```bash
git add src/components/MemberNav.jsx src/pages/membre/Profil.tsx src/pages/membre/Dashboard.jsx
git commit -m "feat(member): expose centralized settings for members"
```

## Fix: Restrict Realtime channel subscriptions via RLS

Add Row-Level Security to `realtime.messages` so authenticated users can only subscribe to Realtime topics they're authorized for. Without this, any logged-in user can listen on any channel name and receive private broadcasts from other members' sessions, messages, pain reports, videos, etc.

### Approach

Enable RLS on `realtime.messages` and add a SELECT policy that authorizes subscription based on the channel topic name. We'll adopt a topic naming convention scoped by user id, and the policy will check that the current `auth.uid()` matches the topic owner.

### Topic naming convention

All client `supabase.channel(...)` calls must use a topic that encodes the authorized user(s):

- `user:{uid}` — private to one user (notifications, own messages)
- `conv:{uidA}:{uidB}` — direct conversation between two users (sorted)
- `session:{session_id}` — only the session's member and any coach
- Generic Postgres-changes channels (e.g. `messages-list`) are no longer allowed; they must be renamed to a scoped topic.

### Migration

1. `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;`
2. Create a SELECT policy on `realtime.messages` for role `authenticated` that allows subscription when:
   - `realtime.topic()` equals `user:` || `auth.uid()`, OR
   - topic starts with `conv:` and contains `auth.uid()` as one of the two ids, OR
   - topic starts with `session:` and `auth.uid()` is the session's member OR has the `coach` role, OR
   - topic starts with `coach:` and the user has the `coach` role.
3. Helper SQL function `public.can_subscribe_topic(topic text)` (SECURITY DEFINER, stable) to centralize the checks and keep the policy readable.

### Code changes

Audit and update every `supabase.channel(<name>)` call in `src/` so the channel name follows the new convention. Likely call sites: messaging, live session, coach dashboard, technique videos, pain reports, notifications. Each is a small string change; subscription filters (`postgres_changes` with row filters) remain unchanged — RLS on the underlying tables still protects payloads, and this new layer protects topic membership.

### Out of scope

- No changes to table-level RLS (already in place).
- No changes to broadcast/presence semantics beyond topic naming.
- No new tables.

### Verification

- Re-run the security scan; `realtime_messages_no_rls` should clear.
- Manually: sign in as Member A, attempt `supabase.channel('user:<member-B-uid>').subscribe()` → should not receive events.
- Existing realtime features (chat, live session updates) continue to work after the topic rename.

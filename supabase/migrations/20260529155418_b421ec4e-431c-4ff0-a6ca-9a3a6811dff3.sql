
-- 1) Restrict INSERT: at least one party must be a coach
DROP POLICY IF EXISTS "Users send messages" ON public.messages;
CREATE POLICY "Users send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = from_id
  AND (
    public.has_role(auth.uid(), 'coach'::public.app_role)
    OR public.has_role(to_id, 'coach'::public.app_role)
  )
);

-- 2) Restrict UPDATE to only `read` and `pinned` columns via column-level grants
REVOKE UPDATE ON public.messages FROM authenticated, anon;
GRANT UPDATE (read, pinned) ON public.messages TO authenticated;

-- Keep RLS predicate: only sender/recipient can touch the row
DROP POLICY IF EXISTS "Users update own message receipts" ON public.messages;
CREATE POLICY "Users update own message receipts"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = to_id OR auth.uid() = from_id)
WITH CHECK (auth.uid() = to_id OR auth.uid() = from_id);

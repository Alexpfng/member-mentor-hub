
-- 1. Column-level UPDATE grant restriction on messages
-- Revoke broad UPDATE and re-grant only on (read, pinned)
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (read, pinned) ON public.messages TO authenticated;

-- Keep service_role unrestricted
GRANT ALL ON public.messages TO service_role;

-- 2. Explicit RESTRICTIVE deny policies for INSERT/DELETE on weekly_logbooks
-- Logbooks are generated exclusively by service_role
CREATE POLICY "No client inserts on weekly_logbooks"
  ON public.weekly_logbooks
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "No client deletes on weekly_logbooks"
  ON public.weekly_logbooks
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);

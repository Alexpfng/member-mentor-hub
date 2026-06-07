
-- 1) Coach SELECT policy on member_notification_prefs
CREATE POLICY "Coaches can view member notification prefs"
ON public.member_notification_prefs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'coach'::app_role));

-- 2) Restrict UPDATE on messages to only `pinned` and `read` columns via column-level GRANTs.
-- Revoke broad UPDATE and re-grant only the two allowed columns to authenticated.
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (pinned, read) ON public.messages TO authenticated;
-- service_role keeps full access for server-side admin operations.
GRANT ALL ON public.messages TO service_role;

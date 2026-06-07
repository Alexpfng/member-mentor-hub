-- Restrict UPDATE on messages to only (pinned, read) columns at the GRANT level.
-- The RLS policy already restricts which rows can be updated; this adds column-level
-- defense-in-depth on top of the existing messages_prevent_content_change trigger.

REVOKE UPDATE ON public.messages FROM authenticated;
REVOKE UPDATE ON public.messages FROM anon;

GRANT UPDATE (pinned, read) ON public.messages TO authenticated;
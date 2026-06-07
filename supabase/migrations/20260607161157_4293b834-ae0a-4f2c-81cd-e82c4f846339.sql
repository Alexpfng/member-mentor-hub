-- Restrict messages UPDATE to only (pinned, read) columns at the privilege level
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (pinned, read) ON public.messages TO authenticated;
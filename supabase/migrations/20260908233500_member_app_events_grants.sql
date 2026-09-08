-- Allow the app API roles to read/write the coaché journey log table.
-- RLS still scopes authenticated users; service_role is used by server functions.

grant select, insert on public.member_app_events to authenticated;
grant select, insert, update, delete on public.member_app_events to service_role;

import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route: renders only an <Outlet /> so that the member detail (index)
// and the adapter child route are SIBLINGS shown full-page in this outlet.
// Previously this route rendered the member page directly with no <Outlet />,
// so navigating to the /adapter child changed the URL but rendered nothing.
export const Route = createFileRoute("/_authenticated/coach/membre/$memberId")({
  component: () => <Outlet />,
});

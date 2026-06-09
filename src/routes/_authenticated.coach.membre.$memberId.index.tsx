import { createFileRoute } from "@tanstack/react-router";
import CoachMember from "../pages/coach/Member";

// Member detail page, now an index route under the $memberId layout so it is a
// sibling of /adapter (both render full-page in the layout's <Outlet />).
export const Route = createFileRoute("/_authenticated/coach/membre/$memberId/")({
  component: CoachMember,
});

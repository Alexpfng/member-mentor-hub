import { createFileRoute } from "@tanstack/react-router";
import CoachMember from "../pages/coach/Member";

// Member detail page, now an index route under the $memberId layout so it is a
// sibling of /adapter (both render full-page in the layout's <Outlet />).
// Les search params de deep link (?tab=…&video=…) sont validés par la route
// layout parente pour être adressables via to: "/coach/membre/$memberId".
export const Route = createFileRoute("/_authenticated/coach/membre/$memberId/")({
  component: CoachMember,
});

import { createFileRoute } from "@tanstack/react-router";
import CoachMember from "../pages/coach/Member";

export const Route = createFileRoute("/_authenticated/coach/membre/$memberId")({
  component: CoachMember,
});

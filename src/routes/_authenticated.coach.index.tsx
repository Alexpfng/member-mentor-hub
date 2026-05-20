import { createFileRoute } from "@tanstack/react-router";
import CoachDashboard from "../pages/coach/Dashboard";

export const Route = createFileRoute("/_authenticated/coach/")({
  component: CoachDashboard,
});

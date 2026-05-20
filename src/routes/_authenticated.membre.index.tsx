import { createFileRoute } from "@tanstack/react-router";
import MemberDashboard from "../pages/membre/Dashboard";

export const Route = createFileRoute("/_authenticated/membre/")({
  component: MemberDashboard,
});

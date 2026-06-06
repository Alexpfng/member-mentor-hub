import { createFileRoute } from "@tanstack/react-router";
import MemberPlanning from "../pages/membre/Planning";

export const Route = createFileRoute("/_authenticated/membre/planning")({
  component: MemberPlanning,
});

import { createFileRoute } from "@tanstack/react-router";
import CoachCommunaute from "../pages/coach/Communaute";

export const Route = createFileRoute("/_authenticated/coach/communaute")({
  component: CoachCommunaute,
});

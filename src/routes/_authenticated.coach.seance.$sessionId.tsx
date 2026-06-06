import { createFileRoute } from "@tanstack/react-router";
import CoachSessionDetail from "@/pages/coach/SessionDetail";

export const Route = createFileRoute("/_authenticated/coach/seance/$sessionId")({
  component: CoachSessionDetail,
});

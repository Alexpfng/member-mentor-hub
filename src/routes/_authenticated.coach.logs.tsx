import { createFileRoute } from "@tanstack/react-router";
import CoachLogs from "../pages/coach/Logs";

export const Route = createFileRoute("/_authenticated/coach/logs")({
  component: CoachLogs,
});

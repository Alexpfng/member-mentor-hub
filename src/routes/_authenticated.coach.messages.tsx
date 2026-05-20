import { createFileRoute } from "@tanstack/react-router";
import CoachMessages from "../pages/coach/Messages";

export const Route = createFileRoute("/_authenticated/coach/messages")({
  component: CoachMessages,
});

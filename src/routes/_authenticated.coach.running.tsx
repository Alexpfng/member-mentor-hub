import { createFileRoute } from "@tanstack/react-router";
import RunningWidget from "../pages/coach/Running";

export const Route = createFileRoute("/_authenticated/coach/running")({
  component: RunningWidget,
});

import { createFileRoute } from "@tanstack/react-router";
import BuilderNew from "../pages/coach/BuilderNew";

export const Route = createFileRoute("/_authenticated/coach/builder")({
  component: BuilderNew,
});

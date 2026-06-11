import { createFileRoute } from "@tanstack/react-router";
import BuilderNew from "../pages/coach/BuilderNew";

// Création d'un nouveau programme (/coach/builder), désormais route index sous le
// layout builder pour être sœur de /coach/builder/$id (édition d'un programme).
export const Route = createFileRoute("/_authenticated/coach/builder/")({
  component: BuilderNew,
});

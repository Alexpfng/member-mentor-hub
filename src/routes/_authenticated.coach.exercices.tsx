import { createFileRoute } from "@tanstack/react-router";
import Exercices from "../pages/coach/Exercices";

export const Route = createFileRoute("/_authenticated/coach/exercices")({
  component: Exercices,
});

import { createFileRoute } from "@tanstack/react-router";
import Programmes from "../pages/coach/Programmes";

export const Route = createFileRoute("/_authenticated/coach/programmes")({
  component: Programmes,
});

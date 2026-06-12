import { createFileRoute } from "@tanstack/react-router";
import CoachSeances from "../pages/coach/Seances";
export const Route = createFileRoute("/_authenticated/coach/seances")({ component: CoachSeances });

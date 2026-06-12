import { createFileRoute } from "@tanstack/react-router";
import CoachMembres from "../pages/coach/Membres";
export const Route = createFileRoute("/_authenticated/coach/membres")({ component: CoachMembres });

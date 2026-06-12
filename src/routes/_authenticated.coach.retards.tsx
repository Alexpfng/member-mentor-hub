import { createFileRoute } from "@tanstack/react-router";
import CoachRetards from "../pages/coach/Retards";
export const Route = createFileRoute("/_authenticated/coach/retards")({ component: CoachRetards });

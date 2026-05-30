import { createFileRoute } from "@tanstack/react-router";
import Invitations from "../pages/coach/Invitations";

export const Route = createFileRoute("/_authenticated/coach/invitations")({
  component: Invitations,
});

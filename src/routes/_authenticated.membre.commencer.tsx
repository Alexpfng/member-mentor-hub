import { createFileRoute } from "@tanstack/react-router";
import Commencer from "../pages/membre/Commencer";

export const Route = createFileRoute("/_authenticated/membre/commencer")({
  component: Commencer,
});

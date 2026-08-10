import { createFileRoute } from "@tanstack/react-router";
import MembreRunningWidget from "../pages/membre/Running";

export const Route = createFileRoute("/_authenticated/membre/running")({
  component: MembreRunningWidget,
});

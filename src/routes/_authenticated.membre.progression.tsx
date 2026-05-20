import { createFileRoute } from "@tanstack/react-router";
import Progression from "../pages/membre/Progression";

export const Route = createFileRoute("/_authenticated/membre/progression")({
  component: Progression,
});

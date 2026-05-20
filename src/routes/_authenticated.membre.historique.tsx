import { createFileRoute } from "@tanstack/react-router";
import Historique from "../pages/membre/Historique";

export const Route = createFileRoute("/_authenticated/membre/historique")({
  component: Historique,
});

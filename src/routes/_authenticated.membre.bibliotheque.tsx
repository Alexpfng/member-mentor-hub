import { createFileRoute } from "@tanstack/react-router";
import Bibliotheque from "../pages/membre/Bibliotheque";

export const Route = createFileRoute("/_authenticated/membre/bibliotheque")({
  component: Bibliotheque,
});

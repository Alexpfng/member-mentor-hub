import { createFileRoute } from "@tanstack/react-router";
import SeanceLibre from "../pages/membre/SeanceLibre";

export const Route = createFileRoute("/_authenticated/membre/seance-libre/$sessionId")({
  component: SeanceLibre,
});

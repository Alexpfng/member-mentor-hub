import { createFileRoute } from "@tanstack/react-router";
import MaSemaine from "../pages/membre/MaSemaine";

export const Route = createFileRoute("/_authenticated/membre/ma-semaine")({
  component: MaSemaine,
});

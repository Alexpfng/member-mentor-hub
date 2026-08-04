import { createFileRoute } from "@tanstack/react-router";
import Communaute from "../pages/membre/Communaute";

export const Route = createFileRoute("/_authenticated/membre/communaute")({
  component: Communaute,
});

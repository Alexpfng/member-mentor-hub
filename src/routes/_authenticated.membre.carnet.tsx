import { createFileRoute } from "@tanstack/react-router";
import MemberCarnet from "../pages/membre/Carnet";

export const Route = createFileRoute("/_authenticated/membre/carnet")({
  component: MemberCarnet,
});

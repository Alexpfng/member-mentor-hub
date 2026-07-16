import { createFileRoute } from "@tanstack/react-router";
import MemberFeedback from "../pages/membre/Retours";

export const Route = createFileRoute("/_authenticated/membre/retours")({
  component: MemberFeedback,
});

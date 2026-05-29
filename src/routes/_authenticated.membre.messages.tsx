import { createFileRoute } from "@tanstack/react-router";
import MemberMessages from "../pages/membre/Messages";

export const Route = createFileRoute("/_authenticated/membre/messages")({
  component: MemberMessages,
});

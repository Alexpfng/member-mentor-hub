import { createFileRoute } from "@tanstack/react-router";
import MemberProgramme from "../pages/membre/Programme";

export const Route = createFileRoute("/_authenticated/membre/programme")({
  component: MemberProgramme,
});

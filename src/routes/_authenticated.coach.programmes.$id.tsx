import { createFileRoute } from "@tanstack/react-router";
import ProgramDetail from "../pages/coach/ProgramDetail";

export const Route = createFileRoute("/_authenticated/coach/programmes/$id")({
  component: ProgramDetail,
});

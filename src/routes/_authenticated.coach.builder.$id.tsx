import { createFileRoute } from "@tanstack/react-router";
import BuilderNew from "../pages/coach/BuilderNew";

export const Route = createFileRoute("/_authenticated/coach/builder/$id")({
  component: BuilderEdit,
});

function BuilderEdit() {
  const { id } = Route.useParams();
  return <BuilderNew programIdParam={id} />;
}

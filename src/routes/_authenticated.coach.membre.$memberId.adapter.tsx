import { createFileRoute } from "@tanstack/react-router";
import AdapterSemaine from "@/pages/coach/AdapterSemaine";

export const Route = createFileRoute("/_authenticated/coach/membre/$memberId/adapter")({
  component: AdapterSemaine,
});

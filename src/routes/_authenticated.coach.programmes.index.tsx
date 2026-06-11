import { createFileRoute } from "@tanstack/react-router";
import Programmes from "../pages/coach/Programmes";

// Liste des programmes, désormais route index sous le layout /programmes pour être
// sœur de /programmes/$id (le détail) — les deux s'affichent en pleine page.
export const Route = createFileRoute("/_authenticated/coach/programmes/")({
  component: Programmes,
});

import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route : ne rend qu'un <Outlet /> pour que la liste (index) et le détail
// (programmes/$id) soient des routes sœurs affichées en pleine page dans cet outlet.
// Auparavant cette route rendait directement la liste sans <Outlet />, donc cliquer
// VOIR changeait l'URL (/programmes/$id) mais réaffichait la liste — le détail ne
// s'affichait jamais.
export const Route = createFileRoute("/_authenticated/coach/programmes")({
  component: () => <Outlet />,
});

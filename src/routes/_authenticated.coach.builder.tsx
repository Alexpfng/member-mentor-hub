import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route : ne rend qu'un <Outlet />. Sinon /coach/builder/$id (édition d'un
// programme existant) affichait le builder VIDE de /coach/builder (nouveau
// programme) au lieu de charger le programme — d'où le « ça repart de zéro ».
export const Route = createFileRoute("/_authenticated/coach/builder")({
  component: () => <Outlet />,
});

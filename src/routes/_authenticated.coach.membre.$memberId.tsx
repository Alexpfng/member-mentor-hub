import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  // Onglet de la fiche membre à ouvrir (deep link, ex. « Ouvrir » d'une vidéo
  // à revoir dans le feed priorité → tab=videos)
  tab: z.enum(["programme", "suivi", "historique", "videos", "progression", "profil", "messages"]).optional().catch(undefined),
  // Vidéo technique à déplier automatiquement dans l'onglet Vidéos
  video: z.string().uuid().optional().catch(undefined),
});

// Layout route: renders only an <Outlet /> so that the member detail (index)
// and the adapter child route are SIBLINGS shown full-page in this outlet.
// Previously this route rendered the member page directly with no <Outlet />,
// so navigating to the /adapter child changed the URL but rendered nothing.
export const Route = createFileRoute("/_authenticated/coach/membre/$memberId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: () => <Outlet />,
});

import { createFileRoute } from "@tanstack/react-router";
import { storeStravaOAuthConnection, verifyStateToken } from "@/lib/strava.functions";

export const Route = createFileRoute("/api/strava/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          return Response.redirect(`${url.origin}/membre/profil?strava=error`, 302);
        }
        if (!code || !state) {
          return new Response("Callback Strava invalide", { status: 400 });
        }

        const verified = verifyStateToken(state);
        if (!verified) {
          return new Response("State Strava invalide ou expiré", { status: 401 });
        }

        await storeStravaOAuthConnection({ memberId: verified.memberId, code });
        return Response.redirect(`${url.origin}/membre/profil?strava=connected`, 302);
      },
    },
  },
});

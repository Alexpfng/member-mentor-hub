import { createFileRoute } from "@tanstack/react-router";
import { syncStravaActivityForAthlete } from "@/lib/strava.functions";

function verifyToken() {
  return process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
}

export const Route = createFileRoute("/api/strava/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode !== "subscribe" || !token || token !== verifyToken()) {
          return new Response("Unauthorized", { status: 401 });
        }
        return Response.json({ "hub.challenge": challenge });
      },

      POST: async ({ request }) => {
        const payload = (await request.json()) as {
          object_type?: string;
          aspect_type?: string;
          object_id?: number;
          owner_id?: number;
        };

        if (payload.object_type !== "activity" || !payload.object_id || !payload.owner_id) {
          return Response.json({ ok: true, ignored: true });
        }

        if (!["create", "update"].includes(payload.aspect_type ?? "")) {
          return Response.json({ ok: true, ignored: true });
        }

        try {
          const result = await syncStravaActivityForAthlete(payload.owner_id, payload.object_id);
          return Response.json({ ok: true, result });
        } catch (error) {
          console.error("[strava/webhook] sync failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});

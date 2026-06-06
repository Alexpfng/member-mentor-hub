import { createFileRoute } from "@tanstack/react-router";
import { generateLogbooksForAll } from "@/lib/logbook.functions";

export const Route = createFileRoute("/api/public/hooks/generate-logbooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Server-only secret. Never use VITE_/anon key here — it is bundled in the client.
        const expected =
          process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await generateLogbooksForAll();
        return Response.json({ ok: true, count: results.length, results });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { generateLogbooksForAll } from "@/lib/logbook.functions";

export const Route = createFileRoute("/api/public/hooks/generate-logbooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        if (!expected) return new Response("CRON_SECRET not configured", { status: 500 });
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await generateLogbooksForAll();
        return Response.json({ ok: true, count: results.length, results });
      },
    },
  },
});

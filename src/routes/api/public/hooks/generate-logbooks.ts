import { createFileRoute } from "@tanstack/react-router";
import { generateLogbooksForAll } from "@/lib/logbook.functions";

export const Route = createFileRoute("/api/public/hooks/generate-logbooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace("Bearer ", "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await generateLogbooksForAll();
        return Response.json({ ok: true, count: results.length, results });
      },
    },
  },
});

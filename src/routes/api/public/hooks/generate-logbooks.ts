import { createFileRoute } from "@tanstack/react-router";
import { generateLogbooksForAll } from "@/lib/logbook.functions";

export const Route = createFileRoute("/api/public/hooks/generate-logbooks")({
  server: {
    handlers: {
      POST: async () => {
        const results = await generateLogbooksForAll();
        return Response.json({ ok: true, count: results.length, results });
      },
    },
  },
});

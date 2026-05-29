import { createFileRoute } from "@tanstack/react-router";
import { seedBetaAccounts } from "@/lib/seed.functions";

// One-shot beta seed endpoint. Idempotent.
// Curl: POST https://<host>/api/public/seed-beta
export const Route = createFileRoute("/api/public/seed-beta")({
  server: {
    handlers: {
      POST: async () => {
        const result = await seedBetaAccounts();
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        // Allow GET too for convenience
        const result = await seedBetaAccounts();
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

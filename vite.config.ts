// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// Force Nitro for production so Vercel receives a real server output instead of
// only the Vite dist/ folder used by Lovable/Cloudflare.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import path from "node:path";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  vite: {
    plugins: [
      nitro({
        preset: "vercel",
      }),
    ],

    resolve: {
      alias: {
        "react-router-dom": path.resolve(
          __dirname,
          "src/lib/rrd-shim.tsx"
        ),
        "entities/lib/decode.js": path.resolve(
          __dirname,
          "node_modules/entities/lib/decode.js"
        ),
        "entities/lib/encode.js": path.resolve(
          __dirname,
          "node_modules/entities/lib/encode.js"
        ),
        "entities": path.resolve(
          __dirname,
          "node_modules/entities"
        ),
      },
    },
  },
});

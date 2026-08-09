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

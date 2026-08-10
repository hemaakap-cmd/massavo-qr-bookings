import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  // mcpPlugin() rewrites supabase/functions/mcp/index.ts as a side effect. It has
  // no role in unit tests, and running it under vitest left that tracked file
  // modified after every `npm test`, so it is skipped in test mode.
  plugins: [react(), mode !== "test" && mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // `globals: true` matches tsconfig.app.json's "types": ["vitest/globals"].
    globals: true,
    // Component tests (localization.test.tsx) render with Testing Library, and
    // src/i18n reads localStorage at import time — both need a DOM.
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // Each localization case renders a full page twice (de + en). The heavier
    // routes exceed the 5s default on slower machines; the network-bound e2e
    // suites already pass explicit 20-25s timeouts for the same reason.
    testTimeout: 30_000,
  },
  // Batch D: strip console.log/info/debug from production bundles, keep warn/error
  esbuild: mode === "production"
    ? { pure: ["console.log", "console.info", "console.debug", "console.trace"] }
    : undefined,
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "supabase-vendor": ["@supabase/supabase-js"],
          "ui-vendor": ["lucide-react"],
          // Heavy admin-only dependency. Kept out of the public-route bundles.
          "recharts-vendor": ["recharts"],
          // PDF generation is ~120KB. Only loaded when a user clicks "Print"
          // or admins generate a report. Combined here so the two libs ship
          // together when needed (they're always used as a pair).
          "pdf-vendor": ["jspdf", "html2canvas"],
          // QR scanning + rendering — used in narrow flows.
          "qr-vendor": ["qrcode.react", "html5-qrcode"],
          // i18n is everywhere but the bundle wins from a dedicated chunk.
          "i18n-vendor": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
        },
      },
    },
  },
}));

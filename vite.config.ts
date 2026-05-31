import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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

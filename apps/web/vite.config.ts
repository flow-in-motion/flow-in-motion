import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HtmlTagDescriptor, Plugin } from "vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Adds <link rel="preconnect"> tags for the API and Supabase, so the browser
 * opens those connections while the app's code is still downloading. Uses
 * the same environment variables (and fallback order) as src/api/client.ts
 * and skips any that aren't set.
 */
function preconnectToBackends(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const origins = [
    env.VITE_API_URL ?? env.VITE_API_BASE_URL,
    env.VITE_SUPABASE_URL,
  ].flatMap((url) => {
    try {
      return url ? [new URL(url).origin] : [];
    } catch {
      return [];
    }
  });

  return {
    name: "preconnect-to-backends",
    transformIndexHtml: () =>
      [...new Set(origins)].map(
        (href): HtmlTagDescriptor => ({
          tag: "link",
          attrs: { rel: "preconnect", href, crossorigin: "" },
          injectTo: "head-prepend",
        }),
      ),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), preconnectToBackends(mode)],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
}));

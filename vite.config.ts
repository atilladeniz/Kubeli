import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const tauriMockEnv = env.VITE_TAURI_MOCK ?? process.env.VITE_TAURI_MOCK ?? "";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "next-intl": path.resolve(__dirname, "src/lib/i18n/next-intl-compat.ts"),
      },
    },
    define: {
      "process.env.VITE_TAURI_MOCK": JSON.stringify(tauriMockEnv),
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 3000,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            // Only always-loaded vendors get named chunks (cache stability).
            // Monaco/xterm/diagram are NOT listed: forcing them into manual
            // chunks pulled shared helper modules into those chunks and
            // dragged them back into the startup graph — the dynamic imports
            // (lazy Dashboard/editor/diagram/terminal) split them naturally.
            if (id.includes("@tauri-apps")) {
              return "vendor-tauri";
            }

            if (id.includes("@radix-ui") || id.includes("lucide-react")) {
              return "vendor-ui";
            }

            if (id.includes("zustand")) {
              return "vendor-state";
            }

            if (id.includes("/react/") || id.includes("/react-dom/")) {
              return "vendor-react";
            }

            return;
          },
        },
      },
    },
  };
});

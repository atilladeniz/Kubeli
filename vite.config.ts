import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const tauriMockEnv =
    env.VITE_TAURI_MOCK ??
    env.NEXT_PUBLIC_TAURI_MOCK ??
    process.env.VITE_TAURI_MOCK ??
    process.env.NEXT_PUBLIC_TAURI_MOCK ??
    "";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "next-intl": path.resolve(__dirname, "src/lib/i18n/next-intl-compat.ts"),
      },
    },
    define: {
      // Preserve existing process.env checks during migration.
      "process.env.NEXT_PUBLIC_TAURI_MOCK": JSON.stringify(tauriMockEnv),
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
    },
  };
});

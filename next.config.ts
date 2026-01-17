import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  images: {
    unoptimized: true,
  },
  // Disable server-side features for Tauri static export
  trailingSlash: true,
  // Disable dev indicators (the N button in the corner)
  devIndicators: false,
  // Empty turbopack config to silence warning
  turbopack: {},
};

export default nextConfig;

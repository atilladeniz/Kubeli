// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://kubeli.dev',
  trailingSlash: 'never',
  // Self-host fonts + auto-generate metric-matched fallbacks -> no font-swap
  // layout shift (was a Google Fonts CDN <link> with display=swap).
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 500, 600, 700],
      // optional: with the preload above the woff2 is ready before first paint,
      // so Inter shows immediately and never flashes/swaps (no FOUT).
      display: 'optional',
      fallbacks: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains',
      weights: [400, 500],
      display: 'optional',
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
  ],
  integrations: [mdx(), react(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
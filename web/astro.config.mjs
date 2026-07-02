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
      // block, not optional: optional shows the metric-fallback for the whole
      // pageview whenever the woff2 misses the ~100ms block window (e.g. a hard
      // reload past the cache) -> inconsistent "wrong font this load, right the
      // next". block keeps text invisible (fallback metrics reserve the box, so
      // 0 CLS) until the real font paints. Both faces are preloaded same-origin
      // subsets, so that invisible window is a few ms -> no FOIT, always Inter.
      display: 'block',
      fallbacks: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains',
      weights: [400, 500],
      display: 'block',
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
  ],
  integrations: [mdx(), react(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
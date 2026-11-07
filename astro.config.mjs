import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://threetotango.canimi.app',
  output: 'static',
  // Never inline scripts into HTML: the CSP forbids inline script-src.
  vite: { build: { assetsInlineLimit: 0 } },
});

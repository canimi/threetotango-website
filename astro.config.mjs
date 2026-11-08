import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://threetotango.canimi.app',
  output: 'static',
  // Inline all CSS (style-src allows 'unsafe-inline'): removes render-blocking CSS requests on mobile.
  build: { inlineStylesheets: 'always' },
  // Never inline scripts into HTML: the CSP forbids inline script-src.
  vite: { build: { assetsInlineLimit: 0 } },
});

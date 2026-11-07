// Plain `tsc` does not know .astro files (the Astro language server does); tests import components for the Container API.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
  const Component: AstroComponentFactory;
  export default Component;
}

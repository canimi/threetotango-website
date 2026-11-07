/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig lets tests render .astro components with the Container API.
export default getViteConfig({
  test: { include: ['tests/**/*.test.ts'], globalSetup: ['tests/global-setup.ts'], testTimeout: 30000 },
});

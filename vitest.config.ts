import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests cover pure functions only, so a plain Node environment is enough;
// the Nuxt runtime (and @nuxt/test-utils) is not needed here.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
})

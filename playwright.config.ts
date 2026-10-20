import { defineConfig, devices } from '@playwright/test'

const PORT = 3300

// E2E runs against the production build (`nuxt build` + Node server), i.e. what gets deployed.
export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm build && node .output/server/index.mjs',
    url: `http://localhost:${PORT}/api/products`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})

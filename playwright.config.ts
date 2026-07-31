import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH

export default defineConfig({
  testDir: './e2e',
  // The game animates on timers, so serial runs keep the waits predictable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Artifacts only on failure, so a green run stays cheap.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...(CHROMIUM_PATH ? { launchOptions: { executablePath: CHROMIUM_PATH } } : {}),
  },
  projects: [
    {
      name: 'mobile-chromium',
      // 390x844 is the breakpoint the touch-target work targets.
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  // Tests run against the real production bundle, not the dev server.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

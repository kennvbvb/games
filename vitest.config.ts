import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    // e2e/ is Playwright's; vitest would try to run those specs otherwise.
    exclude: ['e2e/**', 'node_modules/**'],
  },
})

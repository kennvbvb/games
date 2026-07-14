import { defineConfig } from 'vite'

// GitHub Pages serves this as a project site under /games/, so asset URLs need
// that prefix there; other hosts (e.g. Vercel) serve from the domain root.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/games/' : '/',
})

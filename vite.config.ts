import { defineConfig } from 'vite'

// Served from https://<user>.github.io/games/ as a GitHub Pages project site,
// so all asset URLs need the repo name as a base path.
export default defineConfig({
  base: '/games/',
})

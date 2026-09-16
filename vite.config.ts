/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages serves a project site from /<repo>/ (ADR-0007), so the base path is
 * configuration rather than a constant — adding a custom domain later moves the site
 * to / and must not require touching router paths. `vite dev` serves at the base path
 * too, so sub-path bugs surface in development rather than in production.
 */
const base = process.env.BASE_PATH ?? '/chess-gambits/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})

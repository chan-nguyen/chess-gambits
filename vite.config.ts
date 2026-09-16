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
    // Only unit tests. `e2e/` holds Playwright specs and vitest would try to run them.
    // Both roots must be listed: `src/` is the application, `tools/` is the build-time
    // content gate. Naming only `src/` silently drops the gate's own tests, which is how
    // a suite reports green while the checks that matter most are not running at all.
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    /**
     * Vitest stubs CSS imports to an empty module by default, which also empties `?raw`
     * and `?inline`. Components assert over their own stylesheets — that a board draws
     * with design tokens rather than raw colours, for one — so the text has to survive
     * the transform.
     */
    css: true,
  },
})

import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the **built output** served by a static file server, not
 * against the Vite dev server (ADR-0009). Base-path resolution and deep links are
 * precisely what a unit test cannot cover: they are claims about which files exist on
 * disk and what a host answers for a URL.
 *
 * The suite is parameterised by `BASE_PATH`, so the same assertions run against both
 * shapes the site can be published in:
 *
 *   npm run e2e               # /chess-gambits/ — GitHub Pages project site today
 *   BASE_PATH=/ npm run e2e   # /             — a custom domain later
 */

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'

/**
 * A port per base path. `reuseExistingServer` is deliberately on outside CI, and without
 * this the second of the two runs would silently reuse the first one's server and test
 * the wrong build.
 */
const port = Number(process.env.PORT ?? (basePath === '/' ? '4174' : '4173'))

const baseURL = `http://localhost:${port}${basePath}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    // Always build, so a run can never assert against a stale `dist/` from the other
    // base path.
    command: 'npm run build && npm run serve:dist',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { BASE_PATH: basePath, PORT: String(port) },
  },
})

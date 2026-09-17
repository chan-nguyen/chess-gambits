import { expect, test, type Page } from '@playwright/test'
import { locales } from '../src/lib/locale.ts'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'

/**
 * **AC 6. The Content Security Policy, asserted rather than assumed.**
 *
 * The policy is built by `tools/shells/csp.ts` and stamped into all 2,111 documents by
 * `scripts/generate-shells.ts`, which reads every one of them back off disk and refuses a
 * build where any is missing it. That covers *presence*. What it cannot cover is the only
 * question that matters in the end: **does the shipped site run clean under it**, and does
 * the browser actually refuse what the policy forbids.
 *
 * So there are two halves here, and neither is worth much alone:
 *
 * - The site is walked under the real policy and required to render *and* to report zero
 *   violations. A page that rendered with violations has a policy that is lying; a page
 *   with no violations that also did not render has a policy that broke it.
 * - Four probes do the things the policy forbids and require the browser to stop each one.
 *   Without them "zero violations" is indistinguishable from a page that never had a
 *   policy at all, which is exactly how a CSP rots into a `<meta>` tag nobody reads.
 *
 * **The constraint that shapes all of this**: GitHub Pages serves response headers this
 * project cannot configure (ADR-0007), so the policy rides in the document as
 * `<meta http-equiv>`. `docs/security.md` records the one thing that costs — `frame-ancestors`
 * cannot be expressed there — and accepts it, because the site has no authenticated state,
 * no destructive action and no form for a framing attack to capture.
 *
 * **The one hole in the policy, stated plainly.** `index.html` carries an inline script:
 * the pre-paint theme read at `docs/security.md` B5, which cannot be a module because it
 * has to run before any module does. It is allowed by the SHA-256 of its own bytes, never
 * by `'unsafe-inline'`, and the build refuses to emit a second one. `probes` below proves
 * the distinction is real: a *different* inline script is still refused.
 */

declare global {
  interface Window {
    /** Filled by an init script, so it is listening before the document has a policy. */
    cspViolations?: string[]
  }
}

/** `script-src`, `style-src`, … and what was blocked, in one line a CI log can carry. */
const startCollecting = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const violations: string[] = []
    window.cspViolations = violations
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} blocked ${event.blockedURI || '(inline)'}`)
    })
  })
}

const violations = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() => [...(window.cspViolations ?? [])])

/**
 * The policy as the host served it, read out of the raw bytes rather than the DOM.
 *
 * An unknown path is answered with `404.html` and a real 404 status — that is the claim
 * `scripts/static-server.ts` exists to keep honest — and that document needs the policy
 * just as much, so the status is checked against what the route is supposed to answer.
 */
const servedPolicy = async (page: Page, route: string, status = 200): Promise<string> => {
  const base = test.info().project.use.baseURL
  if (base === undefined) throw new Error('no baseURL configured')

  const response = await page.request.get(new URL(route, base).toString())
  expect(response.status(), `${route} was not served`).toBe(status)

  const html = await response.text()
  const found = /<meta http-equiv="Content-Security-Policy" content="([^"]*)" \/>/.exec(html)
  if (found === null) throw new Error(`${route} carries no Content-Security-Policy meta element`)
  return found[1] ?? ''
}

const directive = (policy: string, name: string): string => {
  const found = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
  if (found === undefined) throw new Error(`the policy has no \`${name}\` directive:\n  ${policy}`)
  return found
}

/**
 * Every route shape the site publishes: the three static ones, a *Listed* entry whose page
 * is the empty state, and a taught entry deep in a line — which is the only one that
 * renders a board, branch choices, badges and an outcome card, and therefore the only one
 * where a stray inline style would ever come from.
 */
const ROUTES: readonly { readonly path: string; readonly status: number }[] = [
  { path: 'vi/', status: 200 },
  { path: `vi/${routeSegments.catalogue}`, status: 200 },
  { path: `vi/${routeSegments.about}`, status: 200 },
  { path: `vi/${routeSegments.catalogue}/damiano-defence-refutation`, status: 200 },
  { path: `vi/${routeSegments.catalogue}/benko-gambit?line=cxb5+a6`, status: 200 },
  { path: `en/${routeSegments.catalogue}/legals-mate`, status: 200 },
  { path: `fr/${routeSegments.catalogue}/italian-game-evans-gambit`, status: 200 },
  { path: 'vi/definitely-not-a-route', status: 404 },
]

test.describe('the policy the host serves', () => {
  test('is on every shape of document, and is the same policy on each', async ({ page }) => {
    const seen = new Set<string>()
    for (const { path, status } of ROUTES) {
      seen.add(await servedPolicy(page, path, status))
    }

    expect([...seen], 'the documents disagree about the policy').toHaveLength(1)
  })

  test('is on the root and the 404 document too', async ({ page }) => {
    for (const route of ['', '404.html']) {
      expect(await servedPolicy(page, route)).toContain("default-src 'none'")
    }
  })

  test('denies by default and allows only this origin', async ({ page }) => {
    const policy = await servedPolicy(page, 'vi/')

    expect(policy.split(';')[0]?.trim(), 'the policy must deny by default').toBe(
      "default-src 'none'",
    )
    for (const name of ['style-src', 'img-src', 'connect-src']) {
      expect(directive(policy, name)).toBe(`${name} 'self'`)
    }
    // §6 budgets zero downloaded fonts. Written into the policy, so it is the browser that
    // enforces it on every visitor rather than a test that enforces it on CI.
    expect(directive(policy, 'font-src')).toBe("font-src 'none'")
    expect(directive(policy, 'base-uri')).toBe("base-uri 'none'")
    expect(directive(policy, 'form-action')).toBe("form-action 'none'")
  })

  /**
   * The assertion this ticket is really about. Every one of these tokens is a way to make
   * a page work by widening the policy instead of fixing the page, and each would leave
   * every other test in this file passing.
   */
  test('buys no page its exemption', async ({ page }) => {
    const policy = await servedPolicy(page, `vi/${routeSegments.catalogue}/benko-gambit`)

    for (const token of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", 'data:', 'http']) {
      expect(policy, `the policy contains ${token}`).not.toContain(token)
    }
    expect(policy.split(';').map((part) => part.trim())).not.toContain('* ')
  })

  /**
   * One hash, for one documented script. A second would mean somebody added an inline
   * script and the build hashed it, which `scripts/generate-shells.ts` refuses — this is
   * the same rule asserted on the published bytes rather than inside the build.
   */
  test('names exactly one inline script, by hash', async ({ page }) => {
    const sources = directive(await servedPolicy(page, 'vi/'), 'script-src')
      .split(' ')
      .slice(1)

    expect(sources[0]).toBe("'self'")
    expect(sources.slice(1)).toHaveLength(1)
    expect(sources[1]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/)
  })
})

test.describe('the site under its own policy', () => {
  for (const { path } of ROUTES) {
    test(`${path} renders and reports no violation`, async ({ page }) => {
      await startCollecting(page)
      await page.goto(path)

      /*
       * Rendered *and* clean. Without this line a policy that blocked the bundle outright
       * would report zero violations of `style-src` and pass — the failure would be total
       * and invisible, which is the worst shape a green test can have.
       */
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForLoadState('networkidle')

      expect(await violations(page), `${path} violated its own policy`).toEqual([])
    })
  }

  /**
   * The interactive surface, not just the first paint. Branch navigation, the tree overlay
   * and the appearance control are where a component would reach for an inline style, and
   * a policy checked only on load would never see it.
   */
  test('stays clean through a branch, the tree overlay and a theme change', async ({ page }) => {
    await startCollecting(page)
    await page.goto(`vi/${routeSegments.catalogue}/benko-gambit`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

    await page.getByRole('link', { name: vi.learn.nextPly }).click()
    await expect(page).toHaveURL(/line=/)

    // The overlay is the phone layout's tree (§1); above 768px the tree is already on the
    // page and there is no dialog to open. It is included because a dialog is where a
    // component is most likely to reach for an inline style.
    await page.setViewportSize({ width: 360, height: 800 })
    await page.getByRole('button', { name: vi.tree.show }).click()
    await expect(page.getByRole('dialog', { name: vi.tree.heading })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 1280, height: 800 })
    await page
      .getByRole('group', { name: vi.appearance.label })
      .getByRole('button', { name: vi.appearance.dark })
      .click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    expect(await violations(page)).toEqual([])
  })

  /**
   * The hashed script is not a decoration: the theme it applies has to be on the document
   * at the first frame, and it only runs at all if the hash in the policy matches the
   * bytes the build emitted. A hash that drifted would land here as an unstyled first
   * paint plus a `script-src` violation, rather than as a production-only bug.
   */
  test('runs the one script it allows, and would report it if it did not', async ({ page }) => {
    await startCollecting(page)
    await page.goto('vi/')
    await page.evaluate(() => window.localStorage.setItem('chess-gambits.theme', 'dark'))
    await page.reload()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await violations(page)).toEqual([])
  })
})

/**
 * **The probes.** Each does something the policy forbids and requires the browser to stop
 * it. Together they are what makes every `toEqual([])` above a measurement instead of a
 * listener nothing could ever have reached.
 */
test.describe('what the policy refuses', () => {
  const load = async (page: Page): Promise<void> => {
    await startCollecting(page)
    await page.goto(`vi/${routeSegments.about}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }

  /** AC 6 in one test: a future inline style fails rather than quietly widening the policy. */
  test('an inline <style> element does nothing', async ({ page }) => {
    await load(page)

    const applied = await page.evaluate(() => {
      const style = document.createElement('style')
      style.textContent = 'body { background: rgb(255, 0, 255) !important }'
      document.head.append(style)
      return window.getComputedStyle(document.body).backgroundColor
    })

    expect(applied, 'an inline stylesheet was applied').not.toBe('rgb(255, 0, 255)')
    expect((await violations(page)).join('\n')).toContain('style-src')
  })

  test('an inline style attribute does nothing either', async ({ page }) => {
    await load(page)

    const applied = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.setAttribute('style', 'width: 123px')
      document.body.append(probe)
      return window.getComputedStyle(probe).width
    })

    expect(applied, 'a style attribute was applied').not.toBe('123px')
    expect((await violations(page)).join('\n')).toContain('style-src')
  })

  /**
   * The difference between a hash and `'unsafe-inline'`, made visible. The policy allows
   * one script by its exact bytes; any other inline script is refused, which is the whole
   * reason the exemption at `docs/security.md` B5 is affordable.
   */
  test('a second inline script does not run', async ({ page }) => {
    await load(page)

    const ran = await page.evaluate(() => {
      const script = document.createElement('script')
      script.textContent = 'window.__injected = true'
      document.head.append(script)
      return '__injected' in window
    })

    expect(ran, 'an injected inline script executed').toBe(false)
    expect((await violations(page)).join('\n')).toContain('script-src')
  })

  /**
   * Requirement N8 enforced by the browser rather than by a recorder. `e2e/route-budgets.spec.ts`
   * asserts the site *asks* for nothing off-origin; this asserts that it could not reach it
   * if it did. The request never leaves the machine: the policy refuses it before the
   * network is involved, which is also why this test needs no internet.
   */
  test('an off-origin script or font is refused before it is fetched', async ({ page }) => {
    await load(page)

    await page.evaluate(() => {
      const script = document.createElement('script')
      script.src = 'https://cdn.example.invalid/analytics.js'
      document.head.append(script)

      const font = document.createElement('link')
      font.rel = 'stylesheet'
      font.href = 'https://fonts.example.invalid/family.css'
      document.head.append(font)
    })

    await expect
      .poll(async () => (await violations(page)).length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(2)

    const reported = (await violations(page)).join('\n')
    expect(reported).toContain('cdn.example.invalid')
    expect(reported).toContain('fonts.example.invalid')
  })
})

/**
 * The published documents, sampled across locales. The build's own read-back covers all
 * 2,111; what this adds is that a **host** answers a real deep link with those bytes, at
 * both base paths the matrix runs — the same reason `e2e/shell-metadata.spec.ts` exists.
 */
test('every locale of a deep link carries the policy', async ({ page }) => {
  for (const locale of locales) {
    const policy = await servedPolicy(page, `${locale}/${routeSegments.catalogue}/benko-gambit`)
    expect(policy).toContain("script-src 'self' 'sha256-")
  }
})

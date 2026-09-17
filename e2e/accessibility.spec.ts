import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { EVANS_ENTRY, MAIN_LINE, MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import { shortcutStorageKey } from '../src/components/learn/shortcuts.ts'
import { lineSearch, parseLine } from '../src/lib/line.ts'
import { locales } from '../src/lib/locale.ts'
import { compileEntry } from '../tools/content/compile.ts'
import { loadContent } from '../tools/content/entries.ts'
import { countableBranches } from '../src/components/progress/branches.ts'
import type { CompiledNode } from '../src/lib/content-types.ts'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * The accessibility gate (#18, requirement N4).
 *
 * **Read the limit before reading the tests.** Automated rules catch roughly a third of
 * WCAG, and nothing in this file changes that number. What it does is make that third a
 * gate that fails a build instead of an assumption, and make the other two thirds a
 * written, scheduled obligation — the checklist in `docs/design-system.md` §5, run by hand
 * by a maintainer who is not a screen-reader user. A green run here is not a claim that
 * the site is accessible. It is a claim that a specific, listed set of machine-checkable
 * failures is absent.
 *
 * Four things live here, and each is here rather than in a unit test because a browser is
 * the only thing that can settle it:
 *
 * - **AC 1**, the axe sweep. Colour contrast, name/role/value and the document outline are
 *   computed styles and a real accessibility tree; jsdom has neither.
 * - **AC 2**, the keyboard-only walk. Tab order is a browser behaviour, and "focus is
 *   visible" is a *measurement* of the computed outline, not a reading of the stylesheet.
 * - **AC 3**, the live region, read back from the shipped `role="status"` element.
 * - **AC 4**, 2.1.4 Character Key Shortcuts, which needs real `localStorage` surviving a
 *   real reload before the interesting half of the criterion is even reachable.
 *
 * Every measurement carries a probe that makes it fail, following the convention the rest
 * of `e2e/` set: a gate nobody has watched fail is a comment.
 */

/*
 * WCAG 2.2 AA is the floor `docs/design-system.md` §5 sets, so the tag list is every
 * WCAG rule tag up to and including 2.2 AA and nothing else. Axe's `best-practice` tags
 * are deliberately absent: they are opinions, some of them contested, and a gate that
 * blocks a merge may only carry rules this project has actually committed to.
 */
const WCAG_TAGS: readonly string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * A *Listed* gambit id: the empty state, which is still what 697 of the 700 published ids
 * resolve to and therefore worth scanning in its own right.
 *
 * It is deliberately not a taught one. A gambit page with no tree renders no board, no
 * branch choices, no quality badges and no outcome card, so a sweep that stopped here would
 * pass without ever having looked at the components this product is about. The fixture
 * states and the taught-entry sweep below are what close that gap.
 */
const PUBLISHED_GAMBIT = 'damiano-defence-refutation'

/** One axe violation, flattened to one line per offending element. */
type Finding = {
  readonly rule: string
  readonly impact: string
  readonly where: string
  readonly why: string
}

const scan = async (page: Page): Promise<readonly Finding[]> => {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze()

  /*
   * A sweep that analysed nothing reports no violations, and would be indistinguishable
   * from a clean page in every line of output below. Axe always has something to say about
   * a rendered document, so an empty result set means the injection failed, not that the
   * page is perfect.
   */
  const examined = results.passes.length + results.violations.length + results.incomplete.length
  if (examined === 0) throw new Error(`axe analysed no rule at all on ${page.url()}`)

  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      rule: violation.id,
      impact: violation.impact ?? 'unknown',
      where: node.target.join(' '),
      why: (node.failureSummary ?? violation.help).replace(/\s+/g, ' ').trim(),
    })),
  )
}

/**
 * The failure message is the whole value of this gate. "1 violation" sends a maintainer to
 * a report they have to go and find; the rule id, the impact, the selector and axe's own
 * sentence let them start on the fix from the CI log.
 */
const describe = (findings: readonly Finding[]): string =>
  findings.map((f) => `  [${f.impact}] ${f.rule} at ${f.where}\n    ${f.why}`).join('\n')

const expectNoViolations = (findings: readonly Finding[], where: string): void => {
  expect(findings, `${where}\n${describe(findings)}`).toEqual([])
}

/** Ready enough to scan: the page has its heading and has stopped fetching. */
const settled = async (page: Page): Promise<void> => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test.describe('the axe sweep (AC 1)', () => {
  for (const locale of locales) {
    const routes = [
      { name: 'home', path: `${locale}/` },
      { name: 'catalogue', path: `${locale}/${routeSegments.catalogue}` },
      { name: 'gambit', path: `${locale}/${routeSegments.catalogue}/${PUBLISHED_GAMBIT}` },
      { name: 'about', path: `${locale}/${routeSegments.about}` },
    ]

    for (const { name, path } of routes) {
      test(`${name} in ${locale} has no WCAG 2.2 AA violation axe can see`, async ({ page }) => {
        await page.goto(path)
        await settled(page)

        expectNoViolations(await scan(page), `${path} fails axe:`)
      })
    }
  }

  /*
   * The states the published routes cannot reach yet — a branch point with its previews and
   * quality badges, and a leaf with its outcome card. Served from the same fixture the rest
   * of `e2e/` uses, for the reason `learning-fixture.ts` gives: the application is entirely
   * the shipped one and only the JSON is supplied.
   *
   * Scanned in Vietnamese only, and that is a stated narrowing rather than an oversight.
   * What differs between locales on these screens is the annotation text, which the four
   * published routes already exercise in all three; what is scanned here is component
   * markup, which is locale-independent.
   */
  const fixtureStates = [
    { name: 'a branch point, with previews and quality badges', line: [] },
    { name: 'a learner node offering a choice of plans', line: ['Ba5'] },
    { name: 'a leaf, with its outcome card', line: ['Ba5', 'd4'] },
  ]

  for (const { name, line } of fixtureStates) {
    test(`${name} has no WCAG 2.2 AA violation axe can see`, async ({ page }) => {
      await serveEntry(page, EVANS_ENTRY)
      await page.goto(`vi/${routeSegments.catalogue}/${EVANS_ENTRY.id}${lineSearch(line)}`)
      await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

      expectNoViolations(await scan(page), `${EVANS_ENTRY.id} at [${line.join(' ')}] fails axe:`)
    })
  }

  /*
   * The same routes at phone width, plus the two states that exist only there.
   *
   * §1 defines three layouts and everything above sees exactly one of them: Playwright's
   * default viewport is 1280 wide, so the collapsed header menu and the full-screen tree
   * overlay — the only disclosure and the only dialog on this site — are never in the
   * accessibility tree the sweep walks. A dialog is the single control type most likely to
   * carry a name/role/value fault, so leaving it unscanned would be the kind of quiet
   * under-coverage this ticket exists to prevent.
   *
   * Vietnamese only, for the same reason the fixture states are: what changes below 768px
   * is layout, not language.
   */
  test.describe('at 360px, where §1 puts a different layout on screen', () => {
    test.use({ viewport: { width: 360, height: 640 } })

    const paths = [
      `vi/`,
      `vi/${routeSegments.catalogue}`,
      `vi/${routeSegments.catalogue}/${PUBLISHED_GAMBIT}`,
      `vi/${routeSegments.about}`,
    ]

    for (const path of paths) {
      test(`${path} has no WCAG 2.2 AA violation axe can see`, async ({ page }) => {
        await page.goto(path)
        await settled(page)

        expectNoViolations(await scan(page), `${path} at 360px fails axe:`)
      })
    }

    test('the collapsed header menu, open, has none either', async ({ page }) => {
      await page.goto(`vi/${routeSegments.about}`)
      await settled(page)

      await page.getByRole('button', { name: vi.nav.menu }).click()
      await expect(page.getByRole('navigation', { name: vi.nav.primary })).toBeVisible()

      expectNoViolations(await scan(page), 'the open header menu at 360px fails axe:')
    })

    test('the full-screen tree overlay, open, has none either', async ({ page }) => {
      await serveEntry(page, EVANS_ENTRY)
      await page.goto(`vi/${routeSegments.catalogue}/${EVANS_ENTRY.id}`)
      await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

      // Asserted open, not clicked and hoped for: a scan of a dialog that never opened is
      // a scan of the page behind it, and it would pass.
      await page.getByRole('button', { name: vi.tree.show }).click()
      await expect(page.getByRole('dialog', { name: vi.tree.heading })).toBeVisible()

      expectNoViolations(await scan(page), 'the open tree overlay at 360px fails axe:')
    })
  })

  /**
   * The probe. Without it a green sweep would be indistinguishable from a sweep that
   * silently stopped analysing — which is how an accessibility gate rots into a badge.
   */
  test('the sweep reports a violation that is really there', async ({ page }) => {
    await page.goto(`vi/${routeSegments.about}`)
    await settled(page)

    await page.evaluate(() => {
      const button = document.createElement('button')
      button.style.inlineSize = '44px'
      button.style.blockSize = '44px'
      document.body.append(button)
    })

    const findings = await scan(page)

    expect(findings.map((finding) => finding.rule)).toContain('button-name')
  })
})

/**
 * **AC 2.** Catalogue, into an entry, through a branch node, to a leaf — with no pointer
 * event anywhere in the walk, and the focus indicator *measured* at every stop.
 *
 * Measured, because "focus is visible" is the one accessibility claim in
 * `docs/design-system.md` §5 that a single stylesheet edit can quietly falsify. Reading the
 * computed `outline` off whatever is focused, and requiring it to be the `--color-focus`
 * ring the token file actually defines, is the difference between a test that would notice
 * and a test that would not.
 */
type FocusStop = {
  readonly tag: string
  readonly name: string
  readonly classes: string
  readonly href: string | null
  readonly outlineStyle: string
  readonly outlineWidth: number
  readonly outlineColor: string
}

const focusedStop = (page: Page): Promise<FocusStop> =>
  page
    .evaluate(() => {
      const element = document.activeElement
      if (element === null) return null
      const style = window.getComputedStyle(element)
      return {
        tag: element.tagName,
        name: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 50),
        // `getAttribute`, not `className`: on an SVG element the property is an
        // `SVGAnimatedString` and `.includes` would not exist on it.
        classes: element.getAttribute('class') ?? '',
        href: element.getAttribute('href'),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineColor: style.outlineColor,
      }
    })
    .then((stop) => {
      if (stop === null) throw new Error('nothing at all was focused')
      return stop
    })

/**
 * `--color-focus`, resolved by the browser from the shipped stylesheet rather than copied
 * into this file. A hard-coded `rgb(26, 79, 208)` would keep passing on the day the token
 * was redefined, and would fail on the day it was merely reformatted.
 */
const focusRingColour = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-focus)'
    document.body.append(probe)
    const colour = window.getComputedStyle(probe).color
    probe.remove()
    return colour
  })

const expectFocusVisible = (stop: FocusStop, ring: string, where: string): void => {
  const subject = `${where}: <${stop.tag.toLowerCase()}> "${stop.name}"`

  expect(stop.tag, `${where}: focus fell off the page onto the document body`).not.toBe('BODY')
  expect(stop.outlineStyle, `${subject} has no focus outline`).not.toBe('none')
  expect(
    stop.outlineWidth,
    `${subject} has a ${stop.outlineWidth}px outline`,
  ).toBeGreaterThanOrEqual(2)
  expect(stop.outlineColor, `${subject} is not ringed in --color-focus`).toBe(ring)
}

/** Tab forward until `arrived` is satisfied, checking the ring at every stop on the way. */
const tabUntil = async (
  page: Page,
  ring: string,
  where: string,
  arrived: (stop: FocusStop) => boolean,
): Promise<FocusStop> => {
  const visited: string[] = []

  for (let press = 1; press <= 150; press += 1) {
    await page.keyboard.press('Tab')
    const stop = await focusedStop(page)
    visited.push(`${stop.tag} "${stop.name}"`)
    expectFocusVisible(stop, ring, `${where}, after ${press} tab(s)`)
    if (arrived(stop)) return stop
  }

  throw new Error(`${where}: never arrived in 150 tabs. Visited:\n  ${visited.join('\n  ')}`)
}

test.describe('the keyboard-only walk (AC 2)', () => {
  const isGambitLink = (stop: FocusStop): boolean =>
    stop.href !== null && /\/gambits\/[^/?#]+/.test(stop.href)

  /*
   * Located by class rather than by label. An opponent reply reads "5...Ba5" and a plan —
   * which is the learner's own move — reads "6.d4", so a predicate on the ellipsis would
   * find the branch and then never find the leaf.
   */
  const isChoice = (stop: FocusStop): boolean => stop.classes.includes('choice-link')

  test('goes catalogue, entry, branch, leaf without ever touching a pointer', async ({ page }) => {
    await serveEntry(page, EVANS_ENTRY)
    await page.goto(`vi/${routeSegments.catalogue}?tier=all&q=benko`)
    await settled(page)
    const ring = await focusRingColour(page)

    // The catalogue, tabbed from the top of the document — no seeded focus, no click.
    const entry = await tabUntil(page, ring, 'on the catalogue', isGambitLink)
    await page.keyboard.press('Enter')

    // Into the entry. It is a branch point: the opponent has four modelled replies.
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
    await expect(page.getByRole('heading', { name: vi.learn.branchHeading })).toBeVisible()
    expect(entry.href).not.toBeNull()

    // Through the branch node, by tabbing to a reply rather than by pressing its digit.
    const branch = await tabUntil(page, ring, 'at the branch point', isChoice)
    expect(branch.name).toContain('5...Ba5')
    await page.keyboard.press('Enter')

    /*
     * §4: "moving to a node moves focus to the annotation panel heading". So the walk has
     * somewhere to be after a navigation, and the ring has to be on it — a focus target
     * that is not drawn is the same as no focus target for the person this is written for.
     */
    await expect(page.getByRole('heading', { level: 2 })).toBeFocused()
    expectFocusVisible(await focusedStop(page), ring, 'after entering the branch')

    // On to the leaf, again by tab and Enter.
    await expect(page.getByRole('heading', { name: vi.learn.planHeading })).toBeVisible()
    const plan = await tabUntil(page, ring, 'at the plan choice', isChoice)
    expect(plan.name).toContain('6.d4')
    await page.keyboard.press('Enter')

    // The leaf: a designed stopping point, with the ring still on the heading focus went to.
    await expect(page.locator('.unexplored-outcome')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 })).toBeFocused()
    expectFocusVisible(await focusedStop(page), ring, 'at the leaf')
    await expect(page.getByRole('link', { name: vi.learn.nextPly })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  /**
   * The probe for the ring measurement. With the one rule that draws the indicator removed,
   * the walk's central assertion has to fail — otherwise it is measuring nothing, and this
   * project has already shipped one gate that could not.
   */
  test('the ring measurement fails when the focus style is taken away', async ({ page }) => {
    await page.goto(`vi/${routeSegments.about}`)
    await settled(page)
    const ring = await focusRingColour(page)

    await page.keyboard.press('Tab')
    expectFocusVisible(await focusedStop(page), ring, 'before the stylesheet is edited')

    /*
     * Inserted through CSSOM rather than as a `<style>` element. The site ships a Content
     * Security Policy with `style-src 'self'` (#19), which refuses an injected inline
     * stylesheet outright and makes `page.addStyleTag` throw. A rule appended to a
     * stylesheet the page already loaded is the same edit, arrives last and therefore wins,
     * and is governed by nothing.
     */
    await page.evaluate(() => {
      const sheet = document.styleSheets[0]
      if (sheet === undefined) throw new Error('the page has no stylesheet to edit')
      sheet.insertRule(':focus-visible { outline: none }', sheet.cssRules.length)
    })

    const stripped = await focusedStop(page)
    expect(stripped.outlineStyle).toBe('none')
    expect(() => expectFocusVisible(stripped, ring, 'after the stylesheet is edited')).toThrow()
  })
})

/**
 * **AC 3.** Every move change is announced (§5). Asserted against the shipped
 * `role="status"` region on the studied board, one ply at a time along a whole line, and
 * against the *localised* announcement — "Qh5+, chiếu" rather than "Qh5+, check" — because
 * §5 also requires the words around the SAN to be in the learner's language.
 */
test.describe('the live region (AC 3)', () => {
  const announcement = (page: Page) => page.locator('.learning-surface__board [role="status"]')

  test('is polite, and present before there is anything to announce', async ({ page }) => {
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`vi/${routeSegments.catalogue}/${MAPPED_ENTRY.id}`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

    /*
     * Present and empty, not inserted on the first move. A live region added to the
     * document together with its content is announced by some screen readers and not by
     * others; one that is already there when the text changes is announced by all of them.
     */
    await expect(announcement(page)).toHaveAttribute('aria-live', 'polite')
    await expect(announcement(page)).toHaveText('')
  })

  test('announces each ply of a whole line, in the learner’s language', async ({ page }) => {
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`vi/${routeSegments.catalogue}/${MAPPED_ENTRY.id}`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

    /*
     * One assertion per ply, and each one retries. Collecting `textContent` straight after
     * the click reads the region before React has re-rendered it, which does not fail —
     * it passes with every announcement shifted one ply late.
     */
    const expected = [
      'fxe5, ăn quân',
      'Qh5+, chiếu',
      'Ke7',
      'Qxe5+, ăn quân, chiếu',
      'Kf7',
      'Bc4+, chiếu',
    ]
    expect(expected).toHaveLength(MAIN_LINE.length)

    for (const spoken of expected) {
      await page.getByRole('link', { name: vi.learn.nextPly }).click()
      await expect(announcement(page)).toHaveText(spoken)
    }
  })
})

/**
 * **AC 4. WCAG 2.2 2.1.4 Character Key Shortcuts, which is Level A.**
 *
 * The digits `1`-`9` are the character keys the criterion is actually about, and the
 * criterion is satisfied by one of three mechanisms: turn the shortcut off, remap it, or
 * scope it to focus. This project chose the first, so there are three things to establish
 * and all three have to hold at once: the switch exists, the switch persists, and with the
 * switch off the character keys **do not fire**.
 *
 * The third is the half that is easy to ship broken — a setting read once at mount, or a
 * handler that reads a stale closure, leaves a control that looks right and does nothing.
 * `e2e/move-navigation.spec.ts` establishes persistence for the arrow keys and
 * `e2e/branch-choices.spec.ts` establishes that the digits stop within one page view; what
 * is checked here is the combination neither covers, which is the one 2.1.4 requires: a
 * setting persisted in a previous session, and dead digits in this one.
 */
test.describe('the character-key shortcuts (AC 4)', () => {
  const toggle = (page: Page) => page.getByRole('checkbox', { name: vi.learn.shortcuts })

  const open = async (page: Page): Promise<void> => {
    await serveEntry(page, EVANS_ENTRY)
    await page.goto(`vi/${routeSegments.catalogue}/${EVANS_ENTRY.id}`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
  }

  test('the switch exists, is labelled, and is on by default', async ({ page }) => {
    await open(page)

    await expect(toggle(page)).toBeChecked()
    await expect(toggle(page)).toHaveAccessibleDescription(vi.learn.shortcutsHint)
  })

  test('a digit selects a branch while the switch is on', async ({ page }) => {
    await open(page)

    await page.keyboard.press('2')

    await expect(page).toHaveURL(new RegExp(`\\?line=Bc5$`))
  })

  test('the switch persists, and the digits are dead in the next session', async ({ page }) => {
    await open(page)
    await toggle(page).click()

    // Persisted to real storage, not to a variable that a reload would forget.
    expect(await page.evaluate((key) => window.localStorage.getItem(key), shortcutStorageKey)).toBe(
      'off',
    )

    await page.reload()
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
    await expect(toggle(page)).not.toBeChecked()

    // Every digit, not a representative one: nine handlers is nine chances to miss one.
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      await page.keyboard.press(digit)
    }

    await expect(page).not.toHaveURL(new RegExp('line='))
    // And the branches are still reachable, because the switch turned off a shortcut and
    // not a feature (§4: a numeric shortcut is never the only route to a branch).
    await expect(page.getByRole('link', { name: /5\.\.\.Bc5/ })).toBeVisible()
  })

  test('turning it back on brings the digits back', async ({ page }) => {
    await open(page)
    await toggle(page).click()
    await page.reload()
    await expect(toggle(page)).not.toBeChecked()

    await toggle(page).click()
    await expect(toggle(page)).toBeChecked()

    /*
     * Tab off the switch first. The handler ignores a key aimed at an input, a select or a
     * textarea — which `shortcuts.ts` is careful to say is **not** how 2.1.4 is satisfied —
     * so a digit pressed while the checkbox still has focus would prove nothing either way.
     */
    await page.keyboard.press('Tab')
    await page.keyboard.press('2')

    await expect(page).toHaveURL(new RegExp(`\\?line=Bc5$`))
  })
})

/**
 * The same sweep, over the content the site actually publishes.
 *
 * When this file was written every published id was Tier 0, so the only gambit page a
 * visitor could reach rendered an empty state, and the components this product exists for —
 * the board, the branch choices, the quality badges, the mate and assessment cards — were
 * reachable only from a fixture. #15 changed that: three entries are taught, at real URLs,
 * in three languages.
 *
 * A fixture-served state and a published one are not the same claim. The fixture supplies
 * JSON to the shipped application; this goes through the real route, the real shell, the
 * real per-locale metadata and the real compiled content. Everything between the host and
 * the component is in the path here and stubbed there, and that is where a `lang`, a
 * heading order or a duplicated landmark id would go wrong without either the fixture sweep
 * or the four published routes noticing.
 *
 * The leaves are read from `content/` and compiled here rather than taken from the JSON the
 * site serves, for the reason `e2e/taught-entries.spec.ts` gives: reading the served file
 * would make this agree with whatever the compile step emitted.
 */
test.describe('the axe sweep over published content', () => {
  const content = loadContent('content')
  if (!content.ok) throw new Error('content/ does not pass the gate, so there is nothing to scan')

  const taught = content.entries
    .map(({ entry }) => entry)
    .filter((entry) => entry.tier === 'taught')
    .map((entry) => {
      const compiled = compileEntry(entry)
      return {
        id: entry.id,
        tree: compiled.tree,
        leaves: countableBranches(compiled.tree).map(
          (key) => parseLine(decodeURIComponent(key)).plies,
        ),
      }
    })

  const nodeAt = (tree: CompiledNode, path: readonly string[]): CompiledNode =>
    path.reduce<CompiledNode>((node, ply) => {
      const child = node.children?.find((candidate) => candidate.ply === ply)
      if (child === undefined) throw new Error(`no child \`${ply}\` under ${path.join(' ')}`)
      return child
    }, tree)

  /**
   * One leaf per outcome shape, chosen from the content rather than written down here — so
   * the day a fourth outcome shape exists, this scans it without being edited, and the day
   * one disappears the count below says so.
   */
  const leaves = new Map<string, { readonly id: string; readonly line: readonly string[] }>()
  for (const entry of taught) {
    for (const line of entry.leaves) {
      const outcome = nodeAt(entry.tree, line).outcome
      if (outcome !== undefined && !leaves.has(outcome.kind)) {
        leaves.set(outcome.kind, { id: entry.id, line })
      }
    }
  }

  /** The card each outcome shape renders as, so a leaf scan can prove it reached the leaf. */
  const CARDS: Readonly<Record<string, string>> = {
    mate: '.mate-outcome',
    position: '.assessment-outcome',
    unexplored: '.unexplored-outcome',
  }

  test('has taught content to scan, and both outcome shapes in it', () => {
    expect(taught.length).toBeGreaterThan(0)
    expect([...leaves.keys()].sort()).toStrictEqual(['mate', 'position'])
  })

  for (const locale of locales) {
    for (const entry of taught) {
      test(`${entry.id} in ${locale}, where the learner starts`, async ({ page }) => {
        await page.goto(`${locale}/${routeSegments.catalogue}/${entry.id}`)
        await settled(page)

        expectNoViolations(await scan(page), `${entry.id} in ${locale} fails axe:`)
      })
    }

    for (const [kind, { id, line }] of leaves) {
      test(`a ${kind} outcome in ${locale}, as the site serves it`, async ({ page }) => {
        await page.goto(`${locale}/${routeSegments.catalogue}/${id}${lineSearch(line)}`)
        await settled(page)

        /*
         * The leaf has to actually be on screen before the sweep means anything. A `?line=`
         * that failed to resolve recovers to the nearest valid node, which is a page this
         * file already scans a few tests above — so without this the check would quietly
         * degrade into a second scan of the entry root and still report a clean pass.
         */
        const card = CARDS[kind]
        if (card === undefined) throw new Error(`no card selector for a ${kind} outcome`)
        await expect(page.locator(card)).toBeVisible()

        expectNoViolations(await scan(page), `the ${kind} card in ${locale} fails axe:`)
      })
    }
  }
})

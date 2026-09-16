import { expect, test, type Page } from '@playwright/test'
import { compileEntry } from '../tools/content/compile.ts'
import { loadContent } from '../tools/content/entries.ts'
import { countableBranches } from '../src/components/progress/branches.ts'
import type { CompiledNode } from '../src/lib/content-types.ts'
import { lineSearch, parseLine } from '../src/lib/line.ts'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'

/**
 * AC 7 of #15, and the only test in the suite that touches published content rather than a
 * fixture: every taught entry is walked from the catalogue index to **every one of its
 * leaves**, by clicking, against the built site on a real static host.
 *
 * The leaves are read from `content/` and compiled here rather than from the JSON the site
 * serves, and that direction matters. Taking them from the served file would make the test
 * agree with whatever the compile step emitted, so a compile that silently dropped a
 * subtree would still pass — it would simply have fewer leaves to check. Reading the
 * authored tree and then requiring the deployed site to answer for each of its leaves is
 * the assertion that has something to fail on.
 *
 * `countableBranches` is imported rather than reimplemented for the same reason
 * `tools/catalogue/build.ts` imports it: the set of root-to-leaf lines is one rule, and a
 * second copy of it here would eventually disagree with the number on the card.
 */

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'
const cataloguePath = `${basePath}vi/${routeSegments.catalogue}`

const content = loadContent('content')
if (!content.ok) {
  throw new Error(
    `content/ does not pass the gate, so there is nothing to walk:\n${content.issues
      .map((issue) => `${issue.file}: ${issue.message}`)
      .join('\n')}`,
  )
}

/** One taught entry, with every root-to-leaf line its authored tree has. */
const taught = content.entries
  .map(({ entry }) => entry)
  .filter((entry) => entry.tier === 'taught')
  .map((entry) => {
    const compiled = compileEntry(entry)
    return {
      id: entry.id,
      name: entry.name,
      tree: compiled.tree,
      leaves: countableBranches(compiled.tree).map(
        (key) => parseLine(decodeURIComponent(key)).plies,
      ),
    }
  })

/** The node a path names, so the outcome asserted at a leaf is the one the content states. */
const nodeAt = (tree: CompiledNode, path: readonly string[]): CompiledNode =>
  path.reduce<CompiledNode>((node, ply) => {
    const child = node.children?.find((candidate) => candidate.ply === ply)
    if (child === undefined) throw new Error(`no child \`${ply}\` under ${path.join(' ')}`)
    return child
  }, tree)

/** The card each outcome shape renders as. A leaf must show its own one and no other. */
const CARDS = {
  mate: '.mate-outcome',
  position: '.assessment-outcome',
  unexplored: '.unexplored-outcome',
} as const

const atGambit = async (page: Page, id: string, line: readonly string[]): Promise<void> => {
  await expect(page).toHaveURL(
    new RegExp(
      `/vi/${routeSegments.catalogue}/${id}${lineSearch(line).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    ),
  )
}

test.describe('every taught entry, from the catalogue to every leaf (AC 7)', () => {
  test('there are three of them, and they are the ones this ticket authored', () => {
    expect(taught.map((entry) => entry.id).sort()).toEqual([
      'benko-gambit',
      'italian-game-evans-gambit',
      'legals-mate',
    ])
  })

  for (const entry of taught) {
    test(`${entry.name} — ${entry.leaves.length} lines`, async ({ page }) => {
      // Clicking one leaf at a time from the entry root, so the budget is the number of
      // navigations rather than the default single-interaction one.
      test.setTimeout(120_000)

      /*
       * The default catalogue view is the taught tier, and a narrowed view under the
       * auto-expand limit opens its families — so an entry this ticket taught is one click
       * from `/gambits` with no filtering at all. That is the claim: a visitor who opens
       * the catalogue can reach this.
       */
      await page.goto(cataloguePath)
      /*
       * Waited for by the result count rather than by the heading. The catalogue payload
       * is a separate request, and the heading is on the page before any of it has
       * arrived — so without this the locator below races the fetch and reports a slow
       * server as a missing entry. The count has to be non-zero for the same reason: an
       * empty list is a payload that did not arrive, not a catalogue with nothing in it.
       */
      await expect(page.getByRole('main').getByRole('status')).toContainText(/Đang hiện [1-9]/)

      const card = page
        .getByRole('main')
        .locator(`a[href$="/vi/${routeSegments.catalogue}/${entry.id}"]`)
      await expect(card).toHaveCount(1)
      await card.click()

      await atGambit(page, entry.id, [])
      await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

      const entryPath = `${cataloguePath}/${entry.id}`

      for (const leaf of entry.leaves) {
        await page.goto(entryPath)
        await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

        /*
         * Walk down by clicking, choosing each control by the address it carries rather
         * than by its text: a link's `href` is the same `?line=` contract the URL
         * round-trips on, so this cannot drift from the encoding the site publishes.
         *
         * Which control it is follows from the node, which is the asymmetry the whole
         * model rests on (docs/CONTEXT.md, *The central asymmetry*). An opponent's reply
         * is one of several branches and is a `ChoiceLink`; the gambit's own prescribed
         * move is not a choice at all and is reached with the navigator's *next*. A
         * learner node with more than one child is the deliberate exception — a real
         * choice of plans — and renders `PlanChoices`, which are `ChoiceLink`s too.
         */
        for (const [index] of leaf.entries()) {
          const parent = nodeAt(entry.tree, leaf.slice(0, index))
          const isChoice = parent.kind === 'opponent' || (parent.children?.length ?? 0) > 1
          const target = lineSearch(leaf.slice(0, index + 1))
          const control = isChoice ? '.choice-link' : '.move-navigator__control--next'

          await page.locator(`${control}[href$="${target}"]`).click()
          await atGambit(page, entry.id, leaf.slice(0, index + 1))
        }

        const outcome = nodeAt(entry.tree, leaf).outcome
        expect(outcome, `no outcome at ${leaf.join(' ')}`).toBeDefined()
        if (outcome === undefined) return

        // The leaf shows its own outcome card, and it really is a leaf: nothing to click on.
        await expect(page.locator(CARDS[outcome.kind])).toBeVisible()
        await expect(page.locator('.choice-link')).toHaveCount(0)

        if (outcome.kind === 'mate') {
          // The proof is named on the page, so the claim can be checked in the repository
          // rather than believed (ADR-0005).
          await expect(page.locator(CARDS.mate)).toContainText(outcome.basis.certificate)
        }
      }
    })
  }
})

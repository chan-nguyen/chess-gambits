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
      eco: entry.eco,
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
  test('there are one hundred and thirty-two of them, and they are the ones the content tickets authored', () => {
    expect(taught.map((entry) => entry.id).sort()).toEqual([
      'alekhine-defense-krejcik-variation-krejcik-gambit',
      'amar-opening-paris-gambit-gent-gambit',
      'barnes-opening-gedult-gambit',
      'benko-gambit',
      'benko-gambit-accepted',
      'benko-gambit-declined-bishop-attack',
      'benoni-defense-benoni-gambit-accepted',
      'bird-opening-froms-gambit',
      'bishops-opening-calabrese-countergambit',
      'blackmar-diemer-gambit',
      'blackmar-diemer-gambit-accepted',
      'blackmar-diemer-gambit-declined-brombacher-countergambit',
      'blumenfeld-countergambit',
      'blumenfeld-countergambit-accepted',
      'borg-defense-borg-gambit',
      'caro-kann-defense-labahn-attack-double-gambit',
      'carr-defense-zilbermints-gambit',
      'catalan-opening-hungarian-gambit',
      'center-game-halasz-mcdonnell-gambit',
      'damiano-defence-refutation',
      'danish-gambit',
      'danish-gambit-accepted',
      'danish-gambit-declined-sorensen-defense',
      'duras-gambit',
      'dutch-defense-krejcik-gambit',
      'elephant-gambit',
      'elephant-trap',
      'english-defense-eastbourne-gambit',
      'english-opening-jaenisch-gambit',
      'englund-gambit',
      'englund-gambit-declined',
      'englund-gambit-trap',
      'fishing-pole-trap',
      'four-knights-game-halloween-gambit',
      'french-defense-banzai-leong-gambit',
      'grob-opening-alessi-gambit',
      'grunfeld-defense-gibbon-gambit',
      'halosar-trap',
      'horwitz-defense-zilbermints-gambit',
      'hungarian-opening-van-kuijk-gambit',
      'indian-defense-budapest-gambit',
      'indian-defense-budapest-gambit-accepted-fajarowicz-defense',
      'indian-defense-gibbins-weidenhagen-gambit',
      'irish-gambit',
      'italian-game-blackburne-kostic-gambit',
      'italian-game-evans-gambit',
      'kadas-opening-schneider-gambit',
      'kieninger-trap',
      'kings-gambit',
      'kings-gambit-accepted',
      'kings-gambit-accepted-basman-gambit',
      'kings-gambit-accepted-bishops-gambit',
      'kings-gambit-accepted-breyer-gambit',
      'kings-gambit-accepted-carrera-gambit',
      'kings-gambit-accepted-dodo-variation',
      'kings-gambit-accepted-eisenberg-variation',
      'kings-gambit-accepted-gaga-gambit',
      'kings-gambit-accepted-kings-knights-gambit',
      'kings-gambit-accepted-mason-keres-gambit',
      'kings-gambit-accepted-orsini-gambit',
      'kings-gambit-accepted-paris-gambit',
      'kings-gambit-accepted-schurig-gambit-with-bb5',
      'kings-gambit-accepted-schurig-gambit-with-bd3',
      'kings-gambit-accepted-stamma-gambit',
      'kings-gambit-accepted-tartakower-gambit',
      'kings-gambit-accepted-tumbleweed',
      'kings-gambit-accepted-villemson-gambit',
      'kings-gambit-declined-classical-variation',
      'kings-indian-attack-omega-delta-gambit',
      'kings-indian-defense-samisch-variation-samisch-gambit',
      'kings-pawn-game-bavarian-gambit',
      'kings-pawn-opening-van-hooydoon-gambit',
      'lasker-trap',
      'latvian-gambit',
      'latvian-gambit-accepted',
      'legals-mate',
      'lion-defense-anti-philidor-lions-cave-lion-claw-gambit',
      'mexican-defense-horsefly-gambit',
      'mikenas-defense-pozarek-gambit',
      'modern-defense-lizard-defense-pirc-diemer-gambit',
      'monticelli-trap',
      'mortimer-trap',
      'nimzo-indian-defense-dilworth-gambit',
      'nimzo-larsen-attack-norfolk-gambit',
      'nimzowitsch-defense-wheeler-gambit',
      'noahs-ark-trap',
      'old-indian-defense-aged-gibbon-gambit',
      'owen-defense-naselwaus-gambit',
      'petrovs-defense-stafford-gambit',
      'philidor-defense-lopez-countergambit',
      'pirc-defense-roscher-gambit',
      'polish-defense-spassky-gambit-accepted',
      'polish-opening-birmingham-gambit',
      'ponziani-opening-ponziani-countergambit',
      'portuguese-opening-miguel-gambit',
      'queens-gambit-declined-albin-countergambit',
      'queens-indian-defense-classical-variation-polugaevsky-gambit',
      'queens-pawn-game-zurich-gambit',
      'rat-defense-english-rat-lisbon-gambit',
      'reti-opening-zilbermints-gambit',
      'richter-veresov-attack-malich-gambit',
      'rubinstein-trap',
      'ruy-lopez-schliemann-defense',
      'scandinavian-defense-kiel-variation-trap',
      'scandinavian-defense-zilbermints-gambit',
      'scotch-game-goring-gambit',
      'scotch-game-scotch-gambit',
      'semi-slav-defense-marshall-gambit',
      'siberian-trap',
      'sicilian-defense-brussels-gambit',
      'sicilian-defense-euwe-attack-prins-gambit',
      'sicilian-defense-halasz-gambit',
      'sicilian-defense-morphy-gambit',
      'sicilian-defense-okelly-variation-wing-gambit',
      'sicilian-defense-polish-gambit',
      'sicilian-defense-portsmouth-gambit',
      'sicilian-defense-smith-morra-gambit',
      'sicilian-defense-wing-gambit',
      'slav-defense-diemer-gambit',
      'sodium-attack-durkin-gambit',
      'st-george-defense-zilbermints-gambit',
      'tarrasch-defense-schara-gambit',
      'tarrasch-trap',
      'torre-attack-wagner-gambit',
      'trompowsky-attack-raptor-variation-hergert-gambit',
      'van-geet-opening-laroche-gambit',
      'vant-kruijs-opening-keoni-hiva-gambit-akahi-variation',
      'vienna-gambit-with-max-lange-defense',
      'vienna-game-fyfe-gambit',
      'vienna-game-wurzburger-trap',
      'ware-opening-wing-gambit',
      'zukertort-opening-herrstrom-gambit',
    ])
  })

  for (const entry of taught) {
    test(`${entry.name} — ${entry.leaves.length} lines`, async ({ page }) => {
      // Clicking one leaf at a time from the entry root, so the budget is the number of
      // navigations rather than the default single-interaction one.
      test.setTimeout(120_000)

      /*
       * The default catalogue view is the taught tier, and a narrowed view under the
       * auto-expand limit opens its families — which covered every taught entry
       * unnarrowed through issue #103's batch, but the taught tier itself passed
       * `autoExpandLimit` (100, `filter.ts`) once #109 brought it to one hundred and
       * five, and again once #110's own search-by-name fix turned out to need
       * search-by-ECO instead (a name is translated to Vietnamese on this page —
       * 'Lasker Trap' renders as 'Bẫy Lasker' — and a search for the untranslated
       * content name against a Vietnamese-only haystack finds nothing). Past the limit
       * the index renders as collapsed family buttons (`CatalogueList.tsx`), which is
       * the intended behaviour for the unfiltered view — so this walk narrows by the
       * entry's own ECO code, which is not translated and so matches on every locale
       * this test might run against. Each of this repository's ECO codes matches at
       * most a few dozen taught entries (`sicilian-defense-*` tops out at ten),
       * comfortably under the limit, and the href-based locator below still finds the
       * one card that is this entry's.
       */
      await page.goto(`${cataloguePath}?q=${encodeURIComponent(entry.eco)}`)
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
      /*
       * Issue #54 marked the ply that produced the position; #70 gave the root one. The root
       * is the position after the defining line, whose last ply the page now walks through,
       * so the two squares of that ply are tinted here exactly as they are everywhere else
       * (2026-09-18: two tinted squares, no ring on either).
       */
      await expect(
        page.locator(
          '.learning-surface__board .board__square--from, .learning-surface__board .board__square--to',
        ),
      ).toHaveCount(2)

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

          /*
           * Issue #54, on published content rather than on a fixture. The highlight was
           * complete and unreachable for four waves precisely because nothing asserted it
           * anywhere a visitor actually goes, so every step of every taught line is asked
           * for the two tinted squares — the square the ply left and the square it reached.
           */
          await expect(
            page.locator(
              '.learning-surface__board .board__square--from, .learning-surface__board .board__square--to',
            ),
          ).toHaveCount(2)
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

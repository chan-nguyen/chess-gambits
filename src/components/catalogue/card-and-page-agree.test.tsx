import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import type { LocaleLoader } from '../../i18n/i18n.ts'
import type { CatalogueEntry } from '../../lib/catalogue.ts'
import type { CompiledEntry, CompiledNode, CompiledOutcome } from '../../lib/content-types.ts'
import vi from '../../locales/vi.ts'
import { MATE_ENTRY } from '../learn/learn-fixtures.ts'
import { GambitProgress } from '../progress/GambitProgress.tsx'
import { branchKey, countableBranches } from '../progress/branches.ts'
import {
  progressSchemaVersion,
  progressStorageKey,
  readProgress,
} from '../progress/progress-storage.ts'
import { GambitCard } from './GambitCard.tsx'

/**
 * A card and the page it links to, saying the same thing about the same gambit.
 *
 * The catalogue downloads no tree — that is why 1,003 entries cost 26.3KB — so a card cannot
 * walk one, and is handed the branch keys the build baked in while the page walks the tree it
 * has in front of it. Two answers to one question, reached by two routes. A card that
 * disagreed with the page it links to would be worse than a card carrying no number at all:
 * the learner has no way to tell which one lied, and what this site sells is that its claims
 * can be checked.
 *
 * **Both halves of the sentence, not just the total.** Until issue #48 the build baked a
 * *count*, and a card holding only a count could do no better than clamp the marks it found in
 * storage against it. The page intersects. Those are different arithmetic, and they part
 * company on the case this file now covers: a mark that outlived the branch it was made
 * against. With one stale key the card read "1 of 1" and the page read "0 of 1" — the clamp
 * trading a visibly impossible number for a plausible wrong one. Shipping the keys lets both
 * sides run `learnedCount` over the same set, so the agreement is structural.
 *
 * The chain has two links and they are tested in the two places they can break.
 * `tools/catalogue/branches.test.ts` pins the *keys* the build bakes against
 * `countableBranches`, at the source. This pins the *sentence* the two sides print, at the
 * screen, which is where a learner actually compares them — agreeing keys do not help if one
 * side words the total differently, or stops rendering it. Both are measured against a string
 * built from the catalogue template, so neither can define its way into agreement with the
 * other. It cannot be one test: the browser project has no `node` types and the tools project
 * has no DOM, which is a boundary worth keeping rather than widening for a test.
 */

const FEN = 'placeholder - nothing here reads a position'
const ID = 'card-and-page'

const POSITION: CompiledOutcome = {
  kind: 'position',
  evaluation: { vi: 'Trắng dễ chơi.' },
  plan: { vi: 'Đổi hậu.' },
  basis: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
}

const leaf = (ply: string, outcome: CompiledOutcome): CompiledNode => ({
  ply,
  kind: 'learner',
  fen: FEN,
  outcome,
})

/**
 * Three branches to learn and one `unexplored` stub that is not one — the shape that tells a
 * count of lines from a count of leaves, and the shape every taught entry will have.
 */
const TREE: CompiledNode = {
  kind: 'opponent',
  fen: FEN,
  children: [
    {
      ply: 'fxe5',
      kind: 'learner',
      fen: FEN,
      children: [leaf('Qh5+', POSITION), leaf('Nc3', POSITION)],
    },
    leaf('Qe7', POSITION),
    leaf('d6', { kind: 'unexplored' }),
  ],
}

const ENTRY: CompiledEntry = { ...MATE_ENTRY, id: ID, tree: TREE }
const KEYS = countableBranches(TREE)

/** What the build would bake, computed by the function the build calls. */
const CARD: CatalogueEntry = {
  id: ID,
  variation: 'Card and page',
  eco: 'C51',
  category: 'gambit',
  side: 'white',
  soundness: 'sound',
  tier: 'taught',
  line: 'e4 e5',
  branchKeys: KEYS,
}

const load: LocaleLoader = () => Promise.resolve(vi)

/** The sentence the catalogue would print, built from the template rather than typed out. */
const countText = (learned: number, total: number): string =>
  vi.progress.count.replace('{{learned}}', String(learned)).replace('{{total}}', String(total))

/**
 * A key that names nothing in `TREE`, which is what content churn leaves behind: a branch that
 * was renamed, moved or deleted after a learner marked it.
 *
 * Built with `branchKey` rather than typed out, so it is a real key — percent-encoding and all
 * — and is rejected for naming no branch rather than for being obviously junk. It is a plausible
 * one too: the `fxe5 Qh5+` line exists and used to run one ply further.
 */
const STALE = branchKey(['fxe5', 'Qh5+', 'Kd8'])

const seed = (keys: readonly string[]): void => {
  window.localStorage.setItem(
    progressStorageKey,
    JSON.stringify({ version: progressSchemaVersion, entries: { [ID]: keys } }),
  )
}

/**
 * What the catalogue hands a card, read back the way `CatalogueList` reads it rather than
 * passed in by hand. If the test typed the list out twice, the two sides could be handed
 * different marks and the agreement it claims to check would be about nothing.
 */
const storedKeys = (): readonly string[] => {
  const read = readProgress()
  return read.status === 'ready' ? (read.progress[ID] ?? []) : []
}

const cardText = async (marked: readonly string[]): Promise<string> => {
  const { container } = render(
    <MemoryRouter>
      <I18nProvider locale="vi" load={load}>
        <GambitCard locale="vi" name="Card and page" entry={CARD} marked={marked} />
      </I18nProvider>
    </MemoryRouter>,
  )
  await screen.findAllByRole('link')
  return container.textContent ?? ''
}

const pageText = async (): Promise<string> => {
  const { container } = render(
    <I18nProvider locale="vi" load={load}>
      <GambitProgress entry={ENTRY} requested={[]} />
    </I18nProvider>,
  )
  await screen.findByRole('region', { name: vi.progress.heading })
  return container.textContent ?? ''
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('the card and the page state the same total', () => {
  it('counts lines and not leaves, so there is a real number to compare', () => {
    // Four leaves, three branches: the `unexplored` stub is not one. A card showing 4 here
    // would agree with nothing and would be the first thing a learner noticed.
    expect(KEYS).toHaveLength(3)
    expect(CARD.branchKeys).toStrictEqual(KEYS)
    expect(KEYS).not.toContain(STALE)
  })

  it('with nothing marked', async () => {
    const onPage = await pageText()
    cleanup()

    expect(onPage).toContain(countText(0, 3))
    expect(await cardText(storedKeys())).toContain(countText(0, 3))
  })

  it('with every branch marked', async () => {
    seed(KEYS)

    const onPage = await pageText()
    cleanup()

    expect(onPage).toContain(countText(3, 3))
    expect(await cardText(storedKeys())).toContain(countText(3, 3))
  })

  /**
   * **Issue #48, and the case the clamp was written for.** One mark, naming a branch the tree
   * no longer has. `branches.test.ts` already pins that the page drops it rather than counting
   * it; this pins that the card drops it too.
   *
   * Against the clamp the card printed "1 of 3" here, because `Math.min(1, 3)` is 1 — inside
   * the total, therefore never visibly wrong, and disagreeing with the page all the same.
   */
  it('with a mark whose branch no longer exists, and nothing else', async () => {
    seed([STALE])

    const onPage = await pageText()
    cleanup()

    expect(onPage).toContain(countText(0, 3))
    expect(await cardText(storedKeys())).toContain(countText(0, 3))
  })

  /**
   * The same drift beside a real mark, which is the shape churn actually produces: a learner
   * keeps the branches that survived and loses the one that did not. The clamp printed "2 of
   * 3" against the page's "1 of 3", so this is the case that fails loudest if the intersection
   * is ever traded back for arithmetic on the length of what is in storage.
   */
  it('with one real mark and one whose branch no longer exists', async () => {
    const first = KEYS[0]
    if (first === undefined) throw new Error('the fixture tree has no branches')
    seed([first, STALE])

    const onPage = await pageText()
    cleanup()

    expect(onPage).toContain(countText(1, 3))
    expect(await cardText(storedKeys())).toContain(countText(1, 3))
  })
})

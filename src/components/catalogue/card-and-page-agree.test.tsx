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
import { countableBranches } from '../progress/branches.ts'
import { progressSchemaVersion, progressStorageKey } from '../progress/progress-storage.ts'
import { GambitCard } from './GambitCard.tsx'

/**
 * A card and the page it links to, saying the same thing about the same gambit.
 *
 * The catalogue downloads no tree — that is why seven hundred entries cost under 17KB — so a
 * card cannot count its own branches and is handed a number the build baked in, while the page
 * counts the tree it has in front of it. Two answers to one question, reached by two routes. A
 * card that disagreed with the page it links to would be worse than a card carrying no number
 * at all: the learner has no way to tell which one lied, and what this site sells is that its
 * claims can be checked.
 *
 * The chain has two links and they are tested in the two places they can break.
 * `tools/catalogue/branches.test.ts` pins the *number* the build bakes against
 * `countableBranches`, at the source. This pins the *sentence* the two sides print, at the
 * screen, which is where a learner actually compares them — agreeing numbers do not help if one
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
  branches: KEYS.length,
}

const load: LocaleLoader = () => Promise.resolve(vi)

/** The sentence the catalogue would print, built from the template rather than typed out. */
const countText = (learned: number, total: number): string =>
  vi.progress.count.replace('{{learned}}', String(learned)).replace('{{total}}', String(total))

const cardText = async (marked: number): Promise<string> => {
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
    expect(CARD.branches).toBe(3)
  })

  it('with nothing marked', async () => {
    const onPage = await pageText()
    cleanup()

    expect(onPage).toContain(countText(0, 3))
    expect(await cardText(0)).toContain(countText(0, 3))
  })

  it('with every branch marked', async () => {
    window.localStorage.setItem(
      progressStorageKey,
      JSON.stringify({ version: progressSchemaVersion, entries: { [ID]: KEYS } }),
    )

    const onPage = await pageText()
    cleanup()

    expect(onPage).toContain(countText(3, 3))
    expect(await cardText(KEYS.length)).toContain(countText(3, 3))
  })
})

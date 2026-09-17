import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import type { LocaleLoader } from '../../i18n/i18n.ts'
import type { CompiledEntry, CompiledNode, CompiledOutcome } from '../../lib/content-types.ts'
import viCatalogue from '../../locales/vi.ts'
import { MATE_ENTRY, MATE_LINE } from '../learn/learn-fixtures.ts'
import { GambitProgress } from './GambitProgress.tsx'
import { branchKey } from './branches.ts'
import { progressSchemaVersion, progressStorageKey } from './progress-storage.ts'

/**
 * The panel, end to end through the real storage helper and the real catalogue.
 *
 * Mounted directly rather than through the route, because the route's job is to hand this
 * two values and everything else here is about what happens after that. What is *not* faked
 * is `src/lib/storage.ts`: every test below writes to and reads from the real
 * `window.localStorage`, since "progress persists" is a claim about that object and a fake
 * would make it a claim about the fake.
 */

const VI = viCatalogue.progress

const FEN = 'placeholder - nothing here reads a position'

const POSITION: CompiledOutcome = {
  kind: 'position',
  evaluation: { vi: 'Trắng hơn quân.' },
  plan: { vi: 'Đổi hậu.' },
  basis: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
}

const leaf = (ply: string, outcome: CompiledOutcome): CompiledNode => ({
  ply,
  kind: 'learner',
  fen: FEN,
  outcome,
})

/** Three branches to learn and one stub that is not one. */
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

const ENTRY: CompiledEntry = { ...MATE_ENTRY, id: 'test-gambit', tree: TREE }

const BRANCHES = [branchKey(['fxe5', 'Qh5+']), branchKey(['fxe5', 'Nc3']), branchKey(['Qe7'])]

const load: LocaleLoader = () => Promise.resolve(viCatalogue)

const panel = (entry: CompiledEntry, requested: readonly string[]) => (
  <I18nProvider locale="vi" load={load}>
    <GambitProgress entry={entry} requested={requested} />
  </I18nProvider>
)

/**
 * The panel, and a way to move the learner without remounting it. `to` is what a real
 * navigation does — the same component, a different `line` — and remounting instead would
 * reset the marker's own state for free and prove nothing about the seam that resets it.
 */
const show = async (entry: CompiledEntry, requested: readonly string[] = []) => {
  const view = render(panel(entry, requested))
  const region = await screen.findByRole('region', { name: VI.heading })

  return { region, to: (next: readonly string[]) => view.rerender(panel(entry, next)) }
}

const countText = (learned: number, total: number): string =>
  VI.count.replace('{{learned}}', String(learned)).replace('{{total}}', String(total))

const toggle = () => screen.getByRole('button', { name: VI.learned })
const undo = () => screen.getByRole('button', { name: VI.undo })

const storedEnvelope = (): unknown => {
  const raw = window.localStorage.getItem(progressStorageKey)
  return raw === null ? null : JSON.parse(raw)
}

const seed = (version: number, entries: unknown): void =>
  window.localStorage.setItem(progressStorageKey, JSON.stringify({ version, entries }))

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('progress is a count, not a percentage (AC 5)', () => {
  it('states how many branches of how many, in words', async () => {
    const { region } = await show(ENTRY)

    expect(region).toHaveTextContent(countText(0, 3))
  })

  it('never renders a percentage', async () => {
    seed(progressSchemaVersion, { 'test-gambit': BRANCHES })
    const { region } = await show(ENTRY)

    expect(region).toHaveTextContent(countText(3, 3))
    expect(region.textContent).not.toContain('%')
  })

  it('interpolates rather than showing the placeholders', async () => {
    const { region } = await show(ENTRY)

    expect(region.textContent).not.toContain('{{')
  })

  /** AC 6 and the unexplored exclusion, as the learner sees them: the total is 3, not 4. */
  it('leaves the unmapped stub out of the total', async () => {
    const { region } = await show(ENTRY)

    expect(region).toHaveTextContent(countText(0, 3))
    expect(region).not.toHaveTextContent(countText(0, 4))
  })

  it('does not count a mark whose branch has been removed from the tree', async () => {
    seed(progressSchemaVersion, { 'test-gambit': [...BRANCHES, branchKey(['Qxf7'])] })
    const { region } = await show(ENTRY)

    expect(region).toHaveTextContent(countText(3, 3))
  })
})

describe('marking a branch (AC 1)', () => {
  it('marks it, and says so in the count', async () => {
    const { region } = await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())

    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    expect(region).toHaveTextContent(countText(1, 3))
  })

  it('unmarks it again', async () => {
    const { region } = await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())
    fireEvent.click(toggle())

    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    expect(region).toHaveTextContent(countText(0, 3))
  })

  it('keeps one label and puts the state in aria-pressed, not in the name', async () => {
    await show(ENTRY, ['Qe7'])

    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAccessibleName(VI.learned)
  })

  it('marks only the branch the learner is on', async () => {
    await show(ENTRY, ['fxe5', 'Qh5+'])

    fireEvent.click(toggle())

    expect(storedEnvelope()).toStrictEqual({
      version: progressSchemaVersion,
      entries: { 'test-gambit': [branchKey(['fxe5', 'Qh5+'])] },
    })
  })

  /*
   * Written out rather than built with `branchKey`, because `branchKey` on both sides of the
   * assertion agrees with itself whatever it does — and what is being claimed is that storage
   * spells a branch exactly as the URL does. `+` is the form encoding for a space, so it is the
   * character that breaks that agreement first. Since #46 it cannot come from a mate leaf's own
   * path: the mating move belongs to the proof, not to the tree.
   */
  it('keys a branch as the URL spells it, so a check survives the round trip', async () => {
    await show(ENTRY, ['fxe5', 'Qh5+'])

    fireEvent.click(toggle())

    expect(storedEnvelope()).toStrictEqual({
      version: progressSchemaVersion,
      entries: { 'test-gambit': ['fxe5_Qh5%2B'] },
    })
  })

  it('marks a real compiled entry under its own id and its own branch', async () => {
    await show(MATE_ENTRY, MATE_LINE)

    fireEvent.click(toggle())

    expect(storedEnvelope()).toStrictEqual({
      version: progressSchemaVersion,
      entries: { 'legal-mate': ['Bh5_Nxe5_Bxd1'] },
    })
  })

  it('leaves other gambits alone', async () => {
    seed(progressSchemaVersion, { 'other-gambit': ['d4'] })
    await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())

    expect(storedEnvelope()).toStrictEqual({
      version: progressSchemaVersion,
      entries: { 'other-gambit': ['d4'], 'test-gambit': [branchKey(['Qe7'])] },
    })
  })
})

describe('unmarking is undoable rather than confirmed (AC 1)', () => {
  it('asks nothing before unmarking', async () => {
    seed(progressSchemaVersion, { 'test-gambit': [branchKey(['Qe7'])] })
    await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers an undo afterwards, and taking it restores the mark', async () => {
    seed(progressSchemaVersion, { 'test-gambit': [branchKey(['Qe7'])] })
    const { region } = await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())
    expect(region).toHaveTextContent(VI.unmarked)

    fireEvent.click(undo())

    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    expect(region).toHaveTextContent(countText(1, 3))
    expect(storedEnvelope()).toStrictEqual({
      version: progressSchemaVersion,
      entries: { 'test-gambit': [branchKey(['Qe7'])] },
    })
  })

  it('offers nothing to undo after a mark, which is not destructive', async () => {
    await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())

    expect(screen.queryByRole('button', { name: VI.undo })).toBeNull()
  })

  it('leaves focus on the control rather than on the page, after undo', async () => {
    seed(progressSchemaVersion, { 'test-gambit': [branchKey(['Qe7'])] })
    await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())
    fireEvent.click(undo())

    expect(toggle()).toHaveFocus()
  })

  it('announces the offer, rather than leaving it to be noticed', async () => {
    seed(progressSchemaVersion, { 'test-gambit': [branchKey(['Qe7'])] })
    const { region } = await show(ENTRY, ['Qe7'])

    // Present and empty before the act, so filling it is a change assistive technology
    // reports. A region that arrives with its content is announced by some readers only.
    const status = within(region).getByRole('status')
    expect(status).toBeEmptyDOMElement()

    fireEvent.click(toggle())

    expect(status).toHaveTextContent(VI.unmarked)
    expect(within(status).getByRole('button', { name: VI.undo })).toBeVisible()
  })

  /**
   * A real navigation, not a remount: the panel stays mounted and the `line` changes, which
   * is what pressing next does. An offer that outlived it would read as an offer to restore
   * the branch now on screen, and taking it would mark the wrong one.
   */
  it('drops the offer when the learner navigates to another branch', async () => {
    seed(progressSchemaVersion, { 'test-gambit': [branchKey(['Qe7'])] })
    const { to } = await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())
    expect(undo()).toBeVisible()

    to(['fxe5', 'Qh5+'])

    expect(screen.queryByRole('button', { name: VI.undo })).toBeNull()
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('progress persists across a reload (AC 2)', () => {
  it('comes back marked', async () => {
    await show(ENTRY, ['Qe7'])
    fireEvent.click(toggle())

    cleanup()
    const { region } = await show(ENTRY, ['Qe7'])

    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    expect(region).toHaveTextContent(countText(1, 3))
  })

  it('stores through the wrapped helper, under one versioned key', async () => {
    await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())

    expect(Object.keys(window.localStorage)).toContain(progressStorageKey)
    expect(storedEnvelope()).toMatchObject({ version: progressSchemaVersion })
  })
})

describe('a storage failure is silent and never a crash (AC 3)', () => {
  it('renders with no saved progress when reading throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })

    const { region } = await show(ENTRY, ['Qe7'])

    expect(region).toHaveTextContent(countText(0, 3))
    expect(toggle()).toBeVisible()
  })

  it('still marks, optimistically, when writing throws on quota', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { region } = await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())

    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    expect(region).toHaveTextContent(countText(1, 3))
  })

  it('treats hand-edited data as no saved progress, with no notice and no crash', async () => {
    window.localStorage.setItem(progressStorageKey, 'not json at all')

    const { region } = await show(ENTRY, ['Qe7'])

    expect(region).toHaveTextContent(countText(0, 3))
    expect(region).not.toHaveTextContent(VI.versionDiscarded)
  })
})

describe('an unrecognised version is discarded with a notice (AC 4)', () => {
  it('says so, and throws the data away rather than reading it', async () => {
    seed(progressSchemaVersion + 1, { 'test-gambit': BRANCHES })

    const { region } = await show(ENTRY, ['Qe7'])

    expect(region).toHaveTextContent(VI.versionDiscarded)
    expect(region).toHaveTextContent(countText(0, 3))
  })

  it('replaces the unreadable envelope, so the notice is shown once and not forever', async () => {
    seed(progressSchemaVersion + 1, { 'test-gambit': BRANCHES })
    await show(ENTRY, ['Qe7'])

    expect(storedEnvelope()).toStrictEqual({ version: progressSchemaVersion, entries: {} })

    cleanup()
    const { region } = await show(ENTRY, ['Qe7'])

    expect(region).not.toHaveTextContent(VI.versionDiscarded)
  })

  /**
   * The control, and without it every assertion above would pass on a component that showed
   * the notice unconditionally. Same payload, the version this code writes: no notice, and
   * the progress is honoured.
   */
  it('shows no notice at the version this code writes', async () => {
    seed(progressSchemaVersion, { 'test-gambit': BRANCHES })

    const { region } = await show(ENTRY, ['Qe7'])

    expect(region).not.toHaveTextContent(VI.versionDiscarded)
    expect(region).toHaveTextContent(countText(3, 3))
  })
})

describe('the states where there is nothing to mark', () => {
  it('explains the control rather than disabling it, mid-line', async () => {
    const { region } = await show(ENTRY, ['fxe5'])

    expect(region).toHaveTextContent(VI.atBranchEnd)
    expect(screen.queryByRole('button', { name: VI.learned })).toBeNull()
  })

  it('does the same at a stub that is not mapped yet', async () => {
    const { region } = await show(ENTRY, ['d6'])

    expect(region).toHaveTextContent(VI.atBranchEnd)
    expect(screen.queryByRole('button', { name: VI.learned })).toBeNull()
  })

  /** Every published entry is at this tier today, so it is the common state, not an edge. */
  it('says a Tier 0 entry has no branches, rather than showing "0 of 0"', async () => {
    const listed: CompiledEntry = {
      ...ENTRY,
      tree: { kind: 'opponent', fen: FEN, outcome: { kind: 'unexplored' } },
    }

    const { region } = await show(listed)

    expect(region).toHaveTextContent(VI.nothingToMark)
    expect(region).not.toHaveTextContent(countText(0, 0))
    expect(screen.queryByRole('button', { name: VI.learned })).toBeNull()
  })
})

/**
 * AC 7. **Nothing is sent anywhere.**
 *
 * Every channel a browser has for leaving the machine is spied on, marking is exercised, and
 * each spy is required to be untouched. The block ends by *using* all four, because an
 * assertion that a counter is zero is worth nothing unless the counter can reach one — and
 * this project has already shipped one gate that could not fail.
 *
 * `e2e/progress.spec.ts` makes the same claim in a real browser against the built output,
 * which is the one that covers channels jsdom does not implement.
 */
describe('nothing is sent anywhere (AC 7)', () => {
  const channels = () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}')))
    const xhrSpy = vi.fn()
    const beaconSpy = vi.fn(() => true)
    const socketSpy = vi.fn()

    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(xhrSpy)
    vi.stubGlobal('WebSocket', socketSpy)
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: beaconSpy,
    })

    return { fetchSpy, xhrSpy, beaconSpy, socketSpy }
  }

  const untouched = (spies: ReturnType<typeof channels>): void => {
    expect(spies.fetchSpy, 'fetch').not.toHaveBeenCalled()
    expect(spies.xhrSpy, 'XMLHttpRequest').not.toHaveBeenCalled()
    expect(spies.beaconSpy, 'navigator.sendBeacon').not.toHaveBeenCalled()
    expect(spies.socketSpy, 'WebSocket').not.toHaveBeenCalled()
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('makes no request when a branch is marked, unmarked or restored', async () => {
    const spies = channels()
    await show(ENTRY, ['Qe7'])

    fireEvent.click(toggle())
    fireEvent.click(toggle())
    fireEvent.click(undo())

    untouched(spies)
  })

  it('makes no request when stored progress is read at mount', async () => {
    seed(progressSchemaVersion, { 'test-gambit': BRANCHES })
    const spies = channels()

    await show(ENTRY, ['Qe7'])

    untouched(spies)
  })

  it('makes no request when an unrecognised version is discarded', async () => {
    seed(progressSchemaVersion + 1, { 'test-gambit': BRANCHES })
    const spies = channels()

    const { region } = await show(ENTRY, ['Qe7'])

    expect(region).toHaveTextContent(VI.versionDiscarded)
    untouched(spies)
  })

  /**
   * The probe. Each spy is shown catching the thing it is watching for, so the three
   * assertions above are statements about the component rather than about four functions
   * nothing was ever able to reach.
   */
  it('watches channels that can actually be caught using them', async () => {
    const spies = channels()

    await fetch('https://example.invalid/collect')
    new XMLHttpRequest().open('POST', 'https://example.invalid/collect')
    window.navigator.sendBeacon('https://example.invalid/collect')
    new WebSocket('wss://example.invalid/collect')

    expect(spies.fetchSpy).toHaveBeenCalledTimes(1)
    expect(spies.xhrSpy).toHaveBeenCalledTimes(1)
    expect(spies.beaconSpy).toHaveBeenCalledTimes(1)
    expect(spies.socketSpy).toHaveBeenCalledTimes(1)
  })
})

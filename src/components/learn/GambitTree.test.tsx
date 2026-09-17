import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import type { LocaleLoader } from '../../i18n/i18n.ts'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { lineSearch } from '../../lib/line.ts'
import { preludeSearch } from '../../lib/prelude.ts'
import viCatalogue from '../../locales/vi.ts'
import { GambitRoute } from '../../routes/gambit.tsx'
import { BRANCHING_ENTRY } from './tree-fixtures.ts'
import { treeBreakpoints } from './tree-layout.ts'

/**
 * The whole-tree view, mounted through the real route, the real router and the real
 * loader — for the reason `LearningSurface.test.tsx` gives: the `line` parameter is the
 * only state this page has, and a test that handed the tree a `requested` prop would be
 * testing a program in which clicking a node changes a variable rather than a URL, which
 * is exactly what AC 1 is about.
 *
 * Width is a real input here (AC 3), so every test states the viewport it means.
 * `test-setup.ts` answers `matchMedia` from `window.innerWidth`, so setting it is the same
 * thing as resizing.
 */

const VI = viCatalogue.tree
const LEARN = viCatalogue.learn

const load: LocaleLoader = () => Promise.resolve(viCatalogue)

const serve = (entry: CompiledEntry): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(entry), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

type Options = {
  readonly line?: readonly string[]
  /** How many plies of the defining line to stand after (#70). Omitted means the root. */
  readonly prelude?: number
  /** The viewport this test means. Defaults to the widest of §1's three layouts. */
  readonly width?: number
}

const renderGambit = ({ line = [], prelude, width = treeBreakpoints.wide }: Options = {}) => {
  window.innerWidth = width
  const search = prelude === undefined ? lineSearch(line) : preludeSearch(prelude)

  const router = createMemoryRouter(
    [
      {
        path: '/:locale',
        element: (
          <I18nProvider locale="vi" load={load}>
            <Outlet />
          </I18nProvider>
        ),
        children: [{ path: 'gambits/:id', element: <GambitRoute /> }],
      },
    ],
    { initialEntries: [`/vi/gambits/${BRANCHING_ENTRY.id}${search}`] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** Resolves once the tree has arrived and is on screen. */
const tree = async (options: Options = {}) => {
  const router = renderGambit(options)
  await screen.findByRole('navigation', { name: LEARN.navigation })
  return router
}

const nodes = () => screen.getAllByRole('treeitem')
const node = (name: string | RegExp) => screen.getByRole('treeitem', { name })

beforeEach(() => {
  serve(BRANCHING_ENTRY)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.innerWidth = treeBreakpoints.wide
})

describe('the whole tree, with the current node highlighted (AC 1)', () => {
  it('renders every node in the entry, not just the current line', async () => {
    await tree()

    expect(nodes().map((item) => item.textContent)).toStrictEqual([
      LEARN.gambitRoot,
      `6...Bxd1#${VI.mateIn} 2`,
      '6...Nxe5',
      '7.Qxh5',
      `7...Nxc4=${VI.assessment}`,
      `7...Ng6?${VI.unexplored}`,
    ])
  })

  it('marks the node the URL names, and only that one', async () => {
    await tree({ line: ['Nxe5', 'Qxh5'] })

    expect(nodes().filter((item) => item.getAttribute('aria-current') === 'true')).toStrictEqual([
      node('7.Qxh5'),
    ])
  })

  it('marks the root when the URL names no line at all', async () => {
    await tree()

    expect(node(LEARN.gambitRoot)).toHaveAttribute('aria-current', 'true')
  })

  /**
   * AC 4, in the tree. The tree starts at the gambit root, so while the learner is inside the
   * defining line they are not standing on any node in it — and marking the root `current`
   * for nine plies during which the board shows something else would be telling a screen
   * reader the wrong position, which is worse than a highlight in the wrong place.
   */
  it('marks nothing while the learner is inside the defining line', async () => {
    await tree({ prelude: 2 })

    expect(nodes().filter((item) => item.getAttribute('aria-current') === 'true')).toStrictEqual([])
  })

  /** And the tree keeps a tab stop, because a tree a keyboard cannot enter is not one. */
  it('keeps the roving tab stop on the root while the learner is in the defining line', async () => {
    await tree({ prelude: 2 })

    expect(nodes().filter((item) => item.tabIndex === 0)).toStrictEqual([node(LEARN.gambitRoot)])
  })

  /**
   * A shared link to a branch that no longer exists recovers to the nearest node that does
   * (docs/design-system.md §4), and the highlight has to recover with it — a tree with no
   * current node at all would be a page that cannot say where the visitor is.
   */
  it('highlights the nearest real node when the link strayed', async () => {
    await tree({ line: ['Nxe5', 'Qxh5', 'Nf6'] })

    expect(node('7.Qxh5')).toHaveAttribute('aria-current', 'true')
  })

  it('sets both the URL and the board when a node is chosen', async () => {
    const router = await tree()

    fireEvent.click(node(/^7\.\.\.Nxc4/))

    await waitFor(() =>
      expect(router.state.location.search).toBe(lineSearch(['Nxe5', 'Qxh5', 'Nxc4'])),
    )
    // The knight has actually arrived on c4: the board is driven by the same URL.
    await waitFor(() =>
      expect(screen.getByRole('gridcell', { name: /^c4/ })).toHaveAccessibleName(
        `c4, ${viCatalogue.board.blackKnight}`,
      ),
    )
  })
})

describe('the nodes are links (AC 2)', () => {
  it('carries an href a visitor can copy or middle-click', async () => {
    await tree()

    expect(node(/^6\.\.\.Bxd1/)).toHaveAttribute(
      'href',
      `/vi/gambits/${BRANCHING_ENTRY.id}${lineSearch(['Bxd1'])}`,
    )
    expect(node(LEARN.gambitRoot)).toHaveAttribute('href', `/vi/gambits/${BRANCHING_ENTRY.id}`)
  })

  it('is an anchor, which is the whole reason a middle click works', async () => {
    await tree()

    for (const item of nodes()) expect(item.tagName).toBe('A')
  })
})

describe('the three layouts (AC 3)', () => {
  it('is open with no control of its own at 1024px and above', async () => {
    await tree({ width: treeBreakpoints.wide })

    expect(screen.getByRole('tree')).toBeVisible()
    expect(screen.queryByRole('button', { name: VI.show })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: VI.hide })).not.toBeInTheDocument()
  })

  it('is a disclosure between 768 and 1023px, open and closable', async () => {
    await tree({ width: treeBreakpoints.medium })
    const toggle = screen.getByRole('button', { name: VI.hide })

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tree')).toBeVisible()

    fireEvent.click(toggle)

    expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: VI.show })).toHaveAttribute('aria-expanded', 'false')
  })

  it('is a summary below 768px, and the summary says what is inside', async () => {
    await tree({ width: 360 })

    expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: VI.show })).toBeVisible()
    // Six positions, three root-to-leaf lines.
    const region = screen.getByRole('region', { name: VI.heading })
    expect(region).toHaveTextContent(`${VI.positions} 6`)
    expect(region).toHaveTextContent(`${VI.lines} 3`)
  })

  it('expands to a full-screen overlay below 768px, and not above it', async () => {
    await tree({ width: 360 })

    fireEvent.click(screen.getByRole('button', { name: VI.show }))

    const overlay = screen.getByRole('dialog')
    expect(overlay).toHaveAttribute('aria-modal', 'true')
    expect(overlay).toHaveAccessibleName(VI.heading)
    expect(within(overlay).getByRole('tree')).toBeVisible()
  })
})

/**
 * WCAG 2.2 *2.4.11 Focus Not Obscured*, Level AA (AC 4). Geometry is measured in
 * Playwright, where there is a viewport; what is checked here is the mechanism that makes
 * the geometry come out right — that focus is *inside* the overlay while it covers the
 * page, and back on the control that opened it once it does not.
 */
describe('the overlay never covers the focused element (AC 4)', () => {
  const openOverlay = async () => {
    await tree({ width: 360 })
    const toggle = screen.getByRole('button', { name: VI.show })
    toggle.focus()
    fireEvent.click(toggle)
    return screen.getByRole('dialog')
  }

  it('moves focus into the overlay as it opens', async () => {
    const overlay = await openOverlay()

    await waitFor(() =>
      expect(within(overlay).getByRole('button', { name: VI.close })).toHaveFocus(),
    )
  })

  it('hands focus back to the control that opened it when it closes', async () => {
    const overlay = await openOverlay()

    fireEvent.click(within(overlay).getByRole('button', { name: VI.close }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: VI.show })).toHaveFocus()
  })

  it('closes on Escape, and focus lands in the same place', async () => {
    const overlay = await openOverlay()

    fireEvent.keyDown(overlay, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: VI.show })).toHaveFocus()
  })

  /**
   * The other way focus gets behind an overlay: not by opening it, but by tabbing out of
   * it. `aria-modal` says the page is unavailable; this is what makes that true.
   */
  it('keeps Tab inside it', async () => {
    const overlay = await openOverlay()
    const close = within(overlay).getByRole('button', { name: VI.close })
    const last = within(overlay).getByRole('treeitem', { name: LEARN.gambitRoot })

    fireEvent.keyDown(overlay, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()

    fireEvent.keyDown(overlay, { key: 'Tab' })
    expect(close).toHaveFocus()
  })
})

describe('the mate net is excluded by default (AC 5)', () => {
  it('shows a mate leaf as an ending, not as the moves that prove it', async () => {
    await tree()

    expect(node(/Bxd1/)).toHaveTextContent(`${VI.mateIn} 2`)
    expect(screen.queryByText(/Bxf7\+/)).not.toBeInTheDocument()
    expect(screen.queryByText(VI.refutation)).not.toBeInTheDocument()
  })

  it('reveals the proved sequence behind an explicit control', async () => {
    await tree()

    fireEvent.click(screen.getByRole('checkbox', { name: VI.showRefutation }))

    expect(node(/Bxd1/)).toHaveTextContent('Bxf7+ Ke7 Nd5#')
  })

  it('offers no such control where nothing in the tree is a proved mate', async () => {
    serve({
      ...BRANCHING_ENTRY,
      tree: { kind: 'opponent', fen: BRANCHING_ENTRY.tree.fen, outcome: { kind: 'unexplored' } },
    })
    await tree()

    expect(screen.queryByRole('checkbox', { name: VI.showRefutation })).not.toBeInTheDocument()
  })
})

describe('endings are marked by shape and word (AC 6)', () => {
  it('names each ending in the node itself, so no colour is load-bearing', async () => {
    await tree()

    /*
     * The symbol is `aria-hidden`, so what a screen reader hears is the word. Both are
     * present for a reader who can see the node, and neither is a colour.
     */
    expect(node(/Bxd1/)).toHaveAccessibleName(`6...Bxd1 ${VI.mateIn} 2`)
    expect(node(/Bxd1/)).toHaveTextContent(`6...Bxd1#${VI.mateIn} 2`)
    expect(node(/Nxc4/)).toHaveAccessibleName(`7...Nxc4 ${VI.assessment}`)
    expect(node(/Nxc4/)).toHaveTextContent(`7...Nxc4=${VI.assessment}`)
    expect(node(/Ng6/)).toHaveAccessibleName(`7...Ng6 ${VI.unexplored}`)
    expect(node(/Ng6/)).toHaveTextContent(`7...Ng6?${VI.unexplored}`)
  })

  it('leaves a node with children unmarked', async () => {
    await tree()

    expect(node('7.Qxh5')).toHaveAccessibleName('7.Qxh5')
  })
})

describe('one tab stop, arrow keys inside (AC 7)', () => {
  const tabbable = () => nodes().filter((item) => item.getAttribute('tabindex') === '0')

  it('offers exactly one node to the tab key', async () => {
    await tree({ line: ['Nxe5'] })

    expect(tabbable()).toStrictEqual([node('6...Nxe5')])
  })

  it('starts the tab stop at the node the URL names', async () => {
    await tree({ line: ['Nxe5', 'Qxh5', 'Ng6'] })

    expect(tabbable()).toStrictEqual([node(/Ng6/)])
  })

  it('moves focus between nodes, and moves the tab stop with it', async () => {
    await tree()
    const root = node(LEARN.gambitRoot)
    root.focus()

    fireEvent.keyDown(root, { key: 'ArrowDown' })
    expect(node(/Bxd1/)).toHaveFocus()
    expect(tabbable()).toStrictEqual([node(/Bxd1/)])

    fireEvent.keyDown(node(/Bxd1/), { key: 'End' })
    expect(node(/Ng6/)).toHaveFocus()
  })

  it('walks into a branch and back out of it', async () => {
    await tree()
    const root = node(LEARN.gambitRoot)
    root.focus()

    fireEvent.keyDown(root, { key: 'ArrowRight' })
    expect(node(/Bxd1/)).toHaveFocus()

    fireEvent.keyDown(node(/Bxd1/), { key: 'ArrowLeft' })
    expect(root).toHaveFocus()
  })

  /**
   * The collision this ticket had to resolve: the learning surface steps the *line* on
   * Left and Right from a window listener (#8). An arrow pressed inside the tree must move
   * within the tree and nowhere else — two things from one press is a bug, not a feature.
   */
  it('does not also step the line', async () => {
    const router = await tree()
    const root = node(LEARN.gambitRoot)
    root.focus()

    fireEvent.keyDown(root, { key: 'ArrowRight' })

    expect(router.state.location.search).toBe('')
  })

  it('reports its own depth, so a reader is told where a branch sits', async () => {
    await tree()

    expect(node(/Ng6/)).toHaveAttribute('aria-level', '4')
    expect(node(/Ng6/)).toHaveAttribute('aria-setsize', '2')
    expect(node(/Ng6/)).toHaveAttribute('aria-posinset', '2')
  })
})

/**
 * The state the one published entry is actually in today: Tier 0, a root node and nothing
 * below it. "This one cannot be empty" is a claim to check rather than to assume
 * (docs/definition-of-done.md), and a whole-tree view of a tree with one position in it is
 * exactly where a view like this draws something that looks like a defect.
 */
describe('a tree with nothing in it yet', () => {
  it('draws the one position it has, and says so in the summary', async () => {
    serve({
      ...BRANCHING_ENTRY,
      tier: 'listed',
      tree: { kind: 'opponent', fen: BRANCHING_ENTRY.tree.fen, outcome: { kind: 'unexplored' } },
    })
    await tree()

    expect(nodes()).toHaveLength(1)
    expect(node(new RegExp(`^${LEARN.gambitRoot}`))).toHaveTextContent(VI.unexplored)
    const region = screen.getByRole('region', { name: VI.heading })
    expect(region).toHaveTextContent(`${VI.positions} 1`)
    expect(region).toHaveTextContent(`${VI.lines} 1`)
  })
})

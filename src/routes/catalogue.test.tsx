import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fixtureCatalogue,
  nothingTaughtCatalogue,
  oversizedCatalogue,
} from '../components/catalogue/catalogue-fixtures.ts'
import { autoExpandLimit } from '../components/catalogue/filter.ts'
import viStrings from '../locales/vi.ts'
import { routes } from '../router.tsx'

/**
 * The catalogue page, end to end inside the real route tree: the real router, the real
 * shell, the real i18n and a stubbed network.
 *
 * Nearly every claim here is about the URL, because that is where the whole of this page's
 * state lives (AC 1). A test that pressed a control and then asserted on the screen would
 * pass just as well over a `useState`, and would not notice the day a filtered view stopped
 * being a link.
 *
 * The strings are read from the shipped Vietnamese catalogue rather than written out, so an
 * assertion cannot drift from what a visitor actually reads.
 */

const strings = viStrings.catalogue

const respond = (body: unknown, status = 200): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const search = (router: ReturnType<typeof renderAt>): string =>
  router.state.location.search.replace(/^\?/, '')

/** The page's own region, so the header's links never satisfy a query meant for the list. */
const page = async (): Promise<HTMLElement> => await screen.findByRole('main')

const settled = async (): Promise<HTMLElement> => {
  const main = await page()
  await within(main).findByRole('search')
  return main
}

beforeEach(() => {
  window.localStorage.clear()
  respond(fixtureCatalogue())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('what the page says about itself', () => {
  it('names itself in the visitor language', async () => {
    renderAt('/vi/gambits')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(strings.heading)
  })

  /**
   * **AC 6.** Per-entry badges make each page honest; only this makes the composition
   * honest. It is shown whatever the numbers are, not when they are flattering.
   */
  it('states the aggregate coverage before the list', async () => {
    renderAt('/vi/gambits')
    const main = await settled()

    expect(main).toHaveTextContent('4 đã liệt kê')
    expect(main).toHaveTextContent('2 đã dựng cây')
    expect(main).toHaveTextContent('1 đã dạy sâu')
  })

  it('says how many of the catalogue the current filter is showing', async () => {
    renderAt('/vi/gambits?tier=all')
    const main = await settled()

    await waitFor(() =>
      expect(within(main).getByRole('status')).toHaveTextContent('Đang hiện 4 trong 4 mục'),
    )
  })

  /** §5: one `h1` per route, no level skipped. */
  it('has a heading hierarchy with no gap in it', async () => {
    renderAt('/vi/gambits?tier=all&q=evans')
    const main = await settled()

    const levels = within(main)
      .getAllByRole('heading')
      .map((heading) => Number(heading.tagName.slice(1)))

    expect(levels[0]).toBe(1)
    for (const [index, level] of levels.entries()) {
      expect(level - (levels[index - 1] ?? level)).toBeLessThanOrEqual(1)
    }
    expect(levels).toContain(3)
  })
})

describe('the default view', () => {
  /**
   * **AC 5 and the whole of *the catalogue defaults to depth, not to breadth*.** A bare
   * `/vi/gambits` shows what is taught, not seven hundred rows of index.
   */
  it('shows only what is taught in depth', async () => {
    renderAt('/vi/gambits')
    const main = await settled()

    expect(await within(main).findByRole('link', { name: /Gambit Evans/ })).toBeInTheDocument()
    expect(within(main).queryByRole('link', { name: /Gan Rán/ })).toBeNull()
    expect(within(main).queryByRole('link', { name: /Gambit Benko/ })).toBeNull()
  })

  it('keeps the default out of the URL, so one view has one address', async () => {
    const router = renderAt('/vi/gambits')
    await settled()

    expect(search(router)).toBe('')
  })
})

describe('filtering', () => {
  const filters = async () => within(await settled()).getByRole('search')

  it('puts a typed search term in the URL', async () => {
    const router = renderAt('/vi/gambits?tier=all')
    const box = within(await filters()).getByLabelText(strings.search)

    fireEvent.change(box, { target: { value: 'gan ran' } })

    await waitFor(() => expect(search(router)).toBe('q=gan+ran&tier=all'))
  })

  /** AC 2, through the whole page rather than through the fold function alone. */
  it('finds a Vietnamese name typed without diacritics', async () => {
    renderAt('/vi/gambits?tier=all&q=gan ran')
    const main = await settled()

    expect(await within(main).findByRole('link', { name: /Gan Rán/ })).toBeInTheDocument()
    expect(within(main).queryByRole('link', { name: /Gambit Evans/ })).toBeNull()
  })

  it('keeps a space in the middle of a term, so two words can be typed', async () => {
    const router = renderAt('/vi/gambits?tier=all')
    const box = within(await filters()).getByLabelText(strings.search)

    fireEvent.change(box, { target: { value: 'gambit ' } })
    await waitFor(() => expect(search(router)).toBe('q=gambit+&tier=all'))
    expect(box).toHaveValue('gambit ')
  })

  it.each([
    [strings.side, 'black', 'side=black'],
    [strings.category, 'trap', 'category=trap'],
    [strings.soundness, 'unsound', 'soundness=unsound'],
  ])('puts the %s choice in the URL', async (label, value, expected) => {
    const router = renderAt('/vi/gambits?tier=all')
    const control = within(await filters()).getByLabelText(label)

    fireEvent.change(control, { target: { value } })

    await waitFor(() => expect(search(router)).toBe(`${expected}&tier=all`))
  })

  /** AC 1: the filters compose. Each narrows what the others left. */
  it('composes filters rather than replacing them', async () => {
    renderAt('/vi/gambits?tier=all&side=white&category=trap')
    const main = await settled()

    expect(await within(main).findByRole('link', { name: /Gan Rán/ })).toBeInTheDocument()
    expect(within(main).queryByRole('link', { name: /Gambit Evans/ })).toBeNull()
    expect(within(main).queryByRole('link', { name: /Gambit Benko/ })).toBeNull()
  })

  it('reads a value it does not recognise as no filter at all', async () => {
    renderAt('/vi/gambits?tier=all&side=wihte')
    const main = await settled()

    await waitFor(() => expect(within(main).getByRole('status')).toHaveTextContent('4 trong 4'))
  })

  it('offers the depth choice as radios rather than hiding it in a menu', async () => {
    renderAt('/vi/gambits')
    const group = within(await filters()).getByRole('group', { name: strings.depth })

    expect(within(group).getByRole('radio', { name: strings.depthTaught })).toBeChecked()
    expect(within(group).getByRole('radio', { name: strings.depthAll })).not.toBeChecked()
  })

  it('switches to everything listed when that radio is chosen', async () => {
    const router = renderAt('/vi/gambits')
    const everything = within(await filters()).getByRole('radio', { name: strings.depthAll })

    fireEvent.click(everything)

    await waitFor(() => expect(search(router)).toBe('tier=all'))
  })

  it('offers to clear only once something is set, and clears back to the default', async () => {
    const router = renderAt('/vi/gambits')
    expect(within(await filters()).queryByRole('button', { name: strings.clear })).toBeNull()

    fireEvent.click(within(await filters()).getByRole('radio', { name: strings.depthAll }))
    await waitFor(() => expect(search(router)).toBe('tier=all'))

    fireEvent.click(await within(await filters()).findByRole('button', { name: strings.clear }))
    await waitFor(() => expect(search(router)).toBe(''))
  })

  /**
   * Typing replaces the history entry and a discrete control pushes one. Otherwise Back has
   * to be pressed once per character, which makes the button useless exactly when a visitor
   * reaches for it.
   */
  it('pushes a history entry for a control and replaces one for a keystroke', async () => {
    const router = renderAt('/vi/gambits?tier=all')

    // A discrete choice is something Back should undo, so it pushes.
    fireEvent.change(within(await filters()).getByLabelText(strings.side), {
      target: { value: 'black' },
    })
    await waitFor(() => expect(search(router)).toBe('side=black&tier=all'))

    // Two keystrokes, neither of which may add an entry of its own.
    const box = within(await filters()).getByLabelText(strings.search)
    fireEvent.change(box, { target: { value: 'b' } })
    await waitFor(() => expect(search(router)).toBe('q=b&side=black&tier=all'))
    fireEvent.change(box, { target: { value: 'be' } })
    await waitFor(() => expect(search(router)).toBe('q=be&side=black&tier=all'))

    // One press of Back, and the whole typed term goes with the choice that preceded it.
    await router.navigate(-1)
    await waitFor(() => expect(search(router)).toBe('tier=all'))
  })
})

describe('grouping by family', () => {
  /**
   * AC 4. The dataset is a list of variations, so a flat list of seven hundred of them is
   * unsearchable; collapsed, the same data is forty-seven lines.
   */
  it('collapses the index and renders no card until a family is opened', async () => {
    renderAt('/vi/gambits?tier=all')
    const main = await settled()

    const toggle = await within(main).findByRole('button', { name: /Ván cờ Ý/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(main).queryByRole('link', { name: /Gambit Evans/ })).toBeNull()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await within(main).findByRole('link', { name: /Gambit Evans/ })).toBeInTheDocument()
  })

  it('counts the entries in each family on the control that opens it', async () => {
    renderAt('/vi/gambits?tier=all')
    const main = await settled()

    expect(await within(main).findByRole('button', { name: /Ván cờ Ý/ })).toHaveTextContent('2 mục')
  })

  /**
   * Past the measured limit the families stay grouped. Asserted with a stub catalogue built
   * to exceed it, because the point is the rule rather than the number: a search returning
   * more entries than anybody scans is answered with the index, not with a wall of cards.
   */
  it('leaves the families grouped when a search matches more than the render budget', async () => {
    respond(oversizedCatalogue(autoExpandLimit + 1))
    renderAt('/vi/gambits?tier=all&q=gambit')
    const main = await settled()

    const toggle = await within(main).findByRole('button', { name: /Nhiều mục/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens them when the same search comes back inside it', async () => {
    respond(oversizedCatalogue(autoExpandLimit))
    renderAt('/vi/gambits?tier=all&q=gambit')
    const main = await settled()

    const toggle = await within(main).findByRole('button', { name: /Nhiều mục/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  /** A search asked to see results, so results are shown rather than hidden behind a click. */
  it('opens the matches when the filter is narrowing', async () => {
    renderAt('/vi/gambits?tier=all&q=evans')
    const main = await settled()

    expect(await within(main).findByRole('link', { name: /Gambit Evans/ })).toBeInTheDocument()
    expect(within(main).getByRole('button', { name: /Ván cờ Ý/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})

describe('a card', () => {
  const card = async () => {
    renderAt('/vi/gambits')
    const main = await settled()
    const link = await within(main).findByRole('link', { name: /Gambit Evans/ })
    const element = link.closest('li')
    if (element === null) throw new Error('a card is not in a list item')
    return element
  }

  it('links to the entry, with the family and the variation folded together', async () => {
    const link = within(await card()).getByRole('link', { name: 'Ván cờ Ý: Gambit Evans' })

    expect(link).toHaveAttribute('href', '/vi/gambits/italian-game-evans-gambit')
  })

  it('states the ECO code, the side and the kind as words, never as colour alone', async () => {
    const element = await card()

    expect(element).toHaveTextContent('C51')
    expect(element).toHaveTextContent(viStrings.catalogue.white)
    expect(element).toHaveTextContent(viStrings.catalogue.gambit)
  })

  /**
   * **AC 9.** A one-word label is not an explanation, so each badge is a link to the place
   * the word is defined — and the two anchors are the ones the About page actually sets.
   */
  it('links both badges to the About page explanation', async () => {
    const element = await card()

    expect(within(element).getByRole('link', { name: /Vững/ })).toHaveAttribute(
      'href',
      '/vi/about#soundness',
    )
    expect(within(element).getByRole('link', { name: /Đã dạy sâu/ })).toHaveAttribute(
      'href',
      '/vi/about#tiers',
    )
  })

  /**
   * The count is the baked one, and it is the same sentence the gambit page shows. A card
   * and the page it links to must not word the same fact differently, and must not give
   * different numbers — which is what `tools/catalogue/branches.test.ts` pins.
   */
  it('shows progress as a count out of the baked branch total', async () => {
    expect(await card()).toHaveTextContent('0 trên 12 nhánh')
  })

  it('shows no count at all for an entry with no branches to learn', async () => {
    renderAt('/vi/gambits?tier=all&q=benko')
    const main = await settled()
    const link = await within(main).findByRole('link', { name: /Gambit Benko/ })
    const element = link.closest('li')

    expect(element).not.toHaveTextContent('nhánh')
  })
})

describe('when there is nothing to show', () => {
  it('says so, and offers the index, when nothing is taught in depth yet', async () => {
    respond(nothingTaughtCatalogue())
    renderAt('/vi/gambits')
    const main = await settled()

    expect(await within(main).findByText(strings.nothingTaught)).toBeInTheDocument()

    const everything = within(main).getByRole('link', { name: strings.showEverything })
    expect(everything).toHaveAttribute('href', '/vi/gambits?tier=all')
  })

  /**
   * Two different emptinesses. Telling a visitor their search came back empty, when the
   * truth is that nothing is taught yet, sends them off rewording a term that was never
   * the problem.
   */
  it('distinguishes a search that matched nothing from a site with nothing taught', async () => {
    renderAt('/vi/gambits?tier=all&q=zzzz')
    const main = await settled()

    expect(await within(main).findByText(strings.nothingHere)).toBeInTheDocument()
    expect(within(main).queryByText(strings.nothingTaught)).toBeNull()
  })
})

describe('when the catalogue does not arrive', () => {
  it('names the failure and offers a retry, instead of a blank page', async () => {
    respond('', 503)
    renderAt('/vi/gambits')
    const main = await page()

    const alert = await within(main).findByRole('alert')
    expect(alert).toHaveTextContent('503')
    expect(within(alert).getByRole('button')).toBeInTheDocument()
  })

  it('keeps the page heading, so the shell is still navigable', async () => {
    respond('', 503)
    renderAt('/vi/gambits')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(strings.heading)
  })
})

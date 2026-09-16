import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { storedLocaleKey } from '../../lib/locale.ts'
import fr from '../../locales/fr.ts'
import vi from '../../locales/vi.ts'
import { routes } from '../../router.tsx'
import { themeAttribute, themeStorageKey } from '../../styles/theme.ts'

/**
 * AC 3 and AC 4 of #2, the parts of its AC 8 that do not need a browser, and #7's AC 1 and
 * AC 5: the locale route parameter drives the language, and switching preserves the route.
 *
 * What is *not* here: the 768px collapse itself. It is a media query, jsdom does not
 * evaluate media queries into computed style, and a test that pretended otherwise would
 * pass while the header was broken at every real width. That claim is `e2e/shell.spec.ts`,
 * at 360, 768 and 1280.
 */

/**
 * A string the shell is expected to show, read from the shipped catalogue so an assertion
 * cannot quietly drift from what a visitor actually sees. French is a `PartialTranslations`
 * and may legitimately omit keys, so a missing one fails as a broken fixture rather than
 * matching an empty string.
 */
const required = (value: string | undefined, name: string): string => {
  if (value === undefined) throw new Error(`fixture: ${name} is missing from the catalogue`)
  return value
}

const french = {
  menu: required(fr.nav?.menu, 'fr.nav.menu'),
  catalogue: required(fr.nav?.catalogue, 'fr.nav.catalogue'),
  about: required(fr.nav?.about, 'fr.nav.about'),
  primary: required(fr.nav?.primary, 'fr.nav.primary'),
  language: required(fr.nav?.language, 'fr.nav.language'),
}

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.removeAttribute(themeAttribute)
})

const header = async () => await screen.findByRole('banner')
const footer = async () => await screen.findByRole('contentinfo')

/**
 * jsdom applies plain class selectors, so the collapsed state — `display: none` — is real
 * here and the destinations are genuinely absent from the accessibility tree until the
 * button is pressed. It does *not* apply media conditions, so what is exercised below is
 * the narrow header at every width. The wide one is the e2e's.
 */
const openMenu = async (name: string): Promise<HTMLElement> => {
  const button = await within(await header()).findByRole('button', { name })
  fireEvent.click(button)
  return button
}

describe('the header', () => {
  it('names the site and links it home, in the current locale', async () => {
    renderAt('/fr/about')

    const name = await within(await header()).findByRole('link', {
      name: 'Chess Gambit Trainer',
    })
    expect(name).toHaveAttribute('href', '/fr/')
  })

  it('collapses the destinations out of the accessibility tree, not merely out of sight', async () => {
    renderAt('/fr/about')

    const button = await within(await header()).findByRole('button', { name: french.menu })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(within(await header()).queryByRole('navigation', { name: french.primary })).toBeNull()
    expect(within(await header()).queryByRole('link', { name: french.catalogue })).toBeNull()
  })

  it('keeps the language switcher out of the collapse (AC 3)', async () => {
    renderAt('/fr/about')

    // Collapsed, and the switcher is still there: it is the one control a visitor may
    // need before they can read the menu.
    await within(await header()).findByRole('button', { name: french.menu })
    expect(within(await header()).getByRole('navigation', { name: french.language })).toBeVisible()
  })

  it('offers the two destinations once expanded', async () => {
    renderAt('/fr/about')
    const button = await openMenu(french.menu)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const primary = within(await header()).getByRole('navigation', { name: french.primary })
    expect(within(primary).getByRole('link', { name: french.catalogue })).toHaveAttribute(
      'href',
      '/fr/gambits',
    )
    expect(within(primary).getByRole('link', { name: french.about })).toHaveAttribute(
      'href',
      '/fr/about',
    )
  })

  it('points aria-controls at the panel it actually expands', async () => {
    renderAt('/fr/about')
    const button = await openMenu(french.menu)

    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    expect(panel).toContainElement(
      within(await header()).getByRole('navigation', { name: french.primary }),
    )
  })
})

describe('the language', () => {
  /** Acceptance criterion 1: the route parameter is what drives `changeLanguage`. */
  it('comes from the route, not from a preference or a default', async () => {
    renderAt('/fr/about')

    expect(await screen.findByRole('button', { name: french.menu })).toBeVisible()
    expect(screen.queryByRole('button', { name: vi.nav.menu })).toBeNull()
  })

  it('is Vietnamese on a Vietnamese route', async () => {
    renderAt('/vi/about')

    expect(await screen.findByRole('button', { name: vi.nav.menu })).toBeVisible()
  })

  it('tells the document which language it is in (WCAG 3.1.1, AC 5)', async () => {
    renderAt('/fr/about')

    await waitFor(() => expect(document.documentElement.lang).toBe('fr'))
  })
})

describe('the language switcher', () => {
  it('offers all three languages, each named in its own language', async () => {
    renderAt('/vi/about')

    const language = await screen.findByRole('navigation', { name: vi.nav.language })
    expect(within(language).getByRole('link', { name: 'Tiếng Việt' })).toBeVisible()
    expect(within(language).getByRole('link', { name: 'English' })).toBeVisible()
    expect(within(language).getByRole('link', { name: 'Français' })).toBeVisible()
  })

  it('marks the current language for assistive technology', async () => {
    renderAt('/vi/about')

    const language = await screen.findByRole('navigation', { name: vi.nav.language })
    expect(within(language).getByRole('link', { name: 'Tiếng Việt' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(language).getByRole('link', { name: 'English' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('keeps the route, the query and the fragment exactly (§3, AC 1)', async () => {
    renderAt('/vi/gambits/evans-gambit?line=e4_e5_Nf3#tree')

    const language = await screen.findByRole('navigation', { name: vi.nav.language })
    expect(within(language).getByRole('link', { name: 'Français' })).toHaveAttribute(
      'href',
      '/fr/gambits/evans-gambit?line=e4_e5_Nf3#tree',
    )
  })

  /**
   * The claim the href above only implies: following it really does land on the same node
   * of the same gambit, in the other language. `line` is the branch a visitor is sharing,
   * so losing it is losing the page.
   */
  it('actually switches the language while keeping the line intact (AC 1)', async () => {
    renderAt('/vi/gambits/evans-gambit?line=e4_e5_Nf3')

    const language = await screen.findByRole('navigation', { name: vi.nav.language })
    fireEvent.click(within(language).getByRole('link', { name: 'Français' }))

    expect(await screen.findByRole('button', { name: french.menu })).toBeVisible()
    expect(screen.getByTestId('line-plies')).toHaveTextContent('e4 e5 Nf3')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('evans-gambit')
  })

  it('remembers the language a visitor chose, so / is stable next time (§1)', async () => {
    renderAt('/vi/about')

    const language = await screen.findByRole('navigation', { name: vi.nav.language })
    fireEvent.click(within(language).getByRole('link', { name: 'Français' }))

    expect(window.localStorage.getItem(storedLocaleKey)).toBe('fr')
  })
})

describe('the appearance control', () => {
  it('starts on system, and says so', async () => {
    renderAt('/vi/about')
    await openMenu(vi.nav.menu)

    const group = await screen.findByRole('group', { name: vi.appearance.label })
    expect(within(group).getByRole('button', { name: vi.appearance.system })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('applies a choice to the document and remembers it', async () => {
    renderAt('/vi/about')
    await openMenu(vi.nav.menu)

    const group = await screen.findByRole('group', { name: vi.appearance.label })
    fireEvent.click(within(group).getByRole('button', { name: vi.appearance.dark }))

    expect(document.documentElement.getAttribute(themeAttribute)).toBe('dark')
    expect(window.localStorage.getItem(themeStorageKey)).toBe('dark')
    expect(within(group).getByRole('button', { name: vi.appearance.dark })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('goes back to following the system, which a two-way toggle could not', async () => {
    window.localStorage.setItem(themeStorageKey, 'dark')
    renderAt('/vi/about')
    await openMenu(vi.nav.menu)

    const group = await screen.findByRole('group', { name: vi.appearance.label })
    fireEvent.click(within(group).getByRole('button', { name: vi.appearance.system }))

    expect(document.documentElement.hasAttribute(themeAttribute)).toBe(false)
    expect(window.localStorage.getItem(themeStorageKey)).toBe('system')
  })
})

describe('the footer', () => {
  it('links the repository', async () => {
    renderAt('/vi/about')

    expect(
      await within(await footer()).findByRole('link', { name: vi.footer.source }),
    ).toHaveAttribute('href', 'https://github.com/chan-nguyen/chess-gambits')
  })

  it('names both licences, because they differ', async () => {
    renderAt('/vi/about')

    expect(await within(await footer()).findByRole('link', { name: 'MIT' })).toBeVisible()
    expect(within(await footer()).getByRole('link', { name: 'CC BY-SA 4.0' })).toBeVisible()
  })

  it('credits the openings dataset, which is CC0 and needs no credit', async () => {
    renderAt('/vi/about')

    expect(
      await within(await footer()).findByRole('link', { name: 'lichess-org/chess-openings' }),
    ).toHaveAttribute('href', 'https://github.com/lichess-org/chess-openings')
    expect(within(await footer()).getByText(/CC0/)).toBeVisible()
  })

  it('points at the About page for how a mate is proved (§1)', async () => {
    renderAt('/vi/about')

    expect(
      await within(await footer()).findByRole('link', { name: vi.footer.mateProof }),
    ).toHaveAttribute('href', '/vi/about')
  })
})

describe('the shell itself', () => {
  it('offers a skip link before anything else in the tab order', async () => {
    renderAt('/vi/about')

    const skip = await screen.findByRole('link', { name: vi.skip.toContent })
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toContainElement(
      screen.getByRole('heading', { level: 1 }),
    )
  })

  it('still frames a page whose locale does not exist', async () => {
    renderAt('/de/about')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
    expect(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByRole('contentinfo')).toBeVisible()
  })
})

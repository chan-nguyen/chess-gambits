import { describe, expect, it } from 'vitest'
import designSystem from '../../../docs/design-system.md?raw'
import boardStyles from './Board.css?raw'

/**
 * AC 7, over the real values rather than over an impression of them.
 *
 * The values are read out of `docs/design-system.md` §2, which is where the design
 * system says values live ("Nothing here may be invented at implementation time"). So
 * this asserts the shipped palette, and editing a hex in the doc without re-checking
 * contrast fails here rather than reaching a learner.
 *
 * Note what makes this a *greyscale* check: WCAG relative luminance is a weighted sum of
 * the three channels and carries no hue at all. Two colours that clear a contrast ratio
 * clear it with the colour removed, which is exactly the property §5 asks for.
 */

type TokenValues = { readonly light: string; readonly dark: string }

const TOKEN_ROW = /^\|\s*`(--[a-z-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/gim

const readTokens = (markdown: string): ReadonlyMap<string, TokenValues> => {
  const tokens = new Map<string, TokenValues>()
  for (const [, name, light, dark] of markdown.matchAll(TOKEN_ROW)) {
    if (name === undefined || light === undefined || dark === undefined) continue
    tokens.set(name, { light, dark })
  }
  return tokens
}

const TOKENS = readTokens(designSystem)

const channel = (hex: string, offset: number): number => {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.2 relative luminance. Hue-free, which is the point. */
const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)

const contrast = (a: string, b: string): number => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}

const THEMES: readonly (keyof TokenValues)[] = ['light', 'dark']

const valueOf = (token: string, theme: keyof TokenValues): string => {
  const values = TOKENS.get(token)
  if (values === undefined) throw new Error(`design-system.md §2 defines no ${token}`)
  return values[theme]
}

const EXPECTED_TOKENS: readonly string[] = [
  '--color-board-light',
  '--color-board-dark',
  '--color-board-highlight-from',
  '--color-board-highlight-to',
  '--color-board-check',
  '--color-board-mark',
  '--color-board-coordinate',
  '--color-piece-white-fill',
  '--color-piece-white-stroke',
  '--color-piece-black-fill',
  '--color-piece-black-stroke',
]

/**
 * Everything a piece can be drawn on top of.
 *
 * `--color-board-highlight-from` is back on this list as of 2026-09-18: no board state ever
 * draws a piece on the square a ply left, but every other surface here is checked whether or
 * not the realistic case arises, and this one is cheap to hold to the same bar.
 */
const SURFACES: readonly string[] = [
  '--color-board-light',
  '--color-board-dark',
  '--color-board-highlight-from',
  '--color-board-highlight-to',
  '--color-board-check',
]

describe('the token table itself', () => {
  it('is present, so this file is asserting something', () => {
    expect(TOKENS.size).toBeGreaterThanOrEqual(EXPECTED_TOKENS.length)
  })

  it.each(EXPECTED_TOKENS)('defines %s in both themes', (token) => {
    for (const theme of THEMES) expect(valueOf(token, theme)).toMatch(/^#[0-9a-f]{6}$/)
  })

  // Without this the table could drift into decoration while the board used something else.
  it.each(EXPECTED_TOKENS.filter((token) => token !== '--color-board-legal'))(
    'is what the board actually draws with: %s',
    (token) => {
      expect(boardStyles).toContain(`var(${token})`)
    },
  )
})

describe.each(THEMES)('in the %s theme', (theme) => {
  const value = (token: string) => valueOf(token, theme)

  // The headline of AC 7: with colour removed, a white piece and a black one are not
  // the same object.
  it('keeps white and black pieces apart in greyscale', () => {
    expect(
      contrast(value('--color-piece-white-fill'), value('--color-piece-black-fill')),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('outlines each piece against its own body', () => {
    expect(
      contrast(value('--color-piece-white-fill'), value('--color-piece-white-stroke')),
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrast(value('--color-piece-black-fill'), value('--color-piece-black-stroke')),
    ).toBeGreaterThanOrEqual(3)
  })

  /**
   * Neither fill nor stroke can carry this alone — a white body disappears on a light
   * square and a black one on a dark square, which is precisely why pieces are outlined.
   * So the requirement is that one of the two reaches 3:1 on every surface.
   */
  describe.each(['white', 'black'])('a %s piece', (colour) => {
    it.each(SURFACES)('is legible on %s', (surface) => {
      const best = Math.max(
        contrast(value(`--color-piece-${colour}-fill`), value(surface)),
        contrast(value(`--color-piece-${colour}-stroke`), value(surface)),
      )
      expect(best).toBeGreaterThanOrEqual(3)
    })
  })

  it('reads its coordinates on both square colours', () => {
    for (const square of ['--color-board-light', '--color-board-dark']) {
      expect(contrast(value('--color-board-coordinate'), value(square))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('shows a square mark on both square colours', () => {
    for (const square of ['--color-board-light', '--color-board-dark']) {
      expect(contrast(value('--color-board-mark'), value(square))).toBeGreaterThanOrEqual(3)
    }
  })

  it('distinguishes the two board squares from each other', () => {
    expect(contrast(value('--color-board-light'), value('--color-board-dark'))).toBeGreaterThan(1.5)
  })
})

describe('the contrast maths', () => {
  // A sanity check on the function doing the asserting, against WCAG's own figures.
  it('agrees with the reference ratios', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 1)
  })
})

/**
 * **The last-ply highlight, and why it is a documented exception to §2 (2026-09-18).**
 *
 * §2's binding rule is "a shape or border difference, not only a tint" — and from #54
 * through #80 the last-ply mark held it with a ring. This ticket removes the ring: the
 * product decision is a plain background colour on both the square a ply left and the
 * square it reached, nothing drawn on top.
 *
 * That is a real narrowing of the signal a fully colour-blind or fully desaturated reader
 * gets — there is no second channel any more. What is not true is that the two squares
 * collapse to the same grey the way they would have before #80: the two tokens are chosen
 * so their **luminance**, not their hue, tells them apart, on the same terms §2 already
 * uses for "distinguishes the two board squares from each other". Measured with the
 * contrast function above, which is hue-free by construction:
 *
 * | pair (light / dark)                          | greyscale contrast |
 * | --------------------------------------------- | ------------------ |
 * | `highlight-from` against `highlight-to`       | see below          |
 *
 * This is weaker than a shape channel and the doc says so. It is the one place on the board
 * where colour is the only signal, and it is there because the person who owns the product
 * asked for exactly this look.
 */
describe('the last-ply highlight is a documented exception to the shape rule', () => {
  it.each(THEMES)('tells the two tints apart by luminance alone, in the %s theme', (theme) => {
    expect(
      contrast(
        valueOf('--color-board-highlight-from', theme),
        valueOf('--color-board-highlight-to', theme),
      ),
    ).toBeGreaterThan(1.5)
  })

  it('draws both squares in a token colour, and neither with a border', () => {
    expect(boardStyles).toContain('var(--color-board-highlight-from)')
    expect(boardStyles).toContain('var(--color-board-highlight-to)')
    expect(boardStyles).not.toContain('board__last-ply')
  })
})

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
  '--color-board-highlight',
  '--color-board-check',
  '--color-board-coordinate',
  '--color-piece-white-fill',
  '--color-piece-white-stroke',
  '--color-piece-black-fill',
  '--color-piece-black-stroke',
]

/**
 * Everything a piece can be drawn on top of.
 *
 * `--color-board-highlight` covers the square a ply left as well as the one it reached
 * (2026-09-18): no board state ever draws a piece on the square a ply left, but every
 * other surface here is checked whether or not the realistic case arises, and this one is
 * cheap to hold to the same bar.
 */
const SURFACES: readonly string[] = [
  '--color-board-light',
  '--color-board-dark',
  '--color-board-highlight',
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
 * **The last-ply highlight, and why it is a documented exception to §2 (2026-09-18, then
 * 2026-09-18 again).**
 *
 * §2's binding rule is "a shape or border difference, not only a tint" — and from #54
 * through #80 the last-ply mark held it with a ring. #88 removed the ring and kept the two
 * squares apart by luminance alone, as a narrower exception. This ticket removes that
 * distinction too, by product decision: both squares now share one gold token, so nothing
 * on the board says which end of the last move is which — only that a move happened
 * across these two squares.
 *
 * This is a further narrowing of the signal, on top of the one #88 already recorded: a
 * reader can no longer tell departure from arrival by any channel, colour or otherwise.
 * What survives is the same as #88 recorded — the `aria-live` move announcement never
 * depended on the visual highlight, so a screen-reader user is unaffected — and the two
 * squares are still distinguishable from a plain square (checked below), just not from
 * each other.
 */
describe('the last-ply highlight is a documented exception to the shape rule', () => {
  it.each(THEMES)('is the same token colour on both squares, in the %s theme', (theme) => {
    const highlight = valueOf('--color-board-highlight', theme)
    const plain = valueOf('--color-board-light', theme)
    expect(highlight).not.toBe(plain)
  })

  it('draws both squares in the one highlight token, and neither with a border', () => {
    const fromRule = boardStyles.match(/\.board__square--from\s*{[^}]*}/)?.[0] ?? ''
    const toRule = boardStyles.match(/\.board__square--to\s*{[^}]*}/)?.[0] ?? ''
    expect(fromRule).toContain('var(--color-board-highlight)')
    expect(toRule).toContain('var(--color-board-highlight)')
    expect(boardStyles).not.toContain('board__last-ply')
  })

  /**
   * A follow-up to #131, by user request: the home board's `marked` square (the one
   * currently selected — its legal destinations are no longer marked at all) now shares
   * this same exception and this same token, rather than the ring-turned-tint
   * `--color-board-mark` carried, which is retired. The two never draw on screen
   * together — a commit always clears the selection that produced a mark — so one colour
   * still reads as one meaning.
   */
  it('draws a marked square in the one highlight token too, and no board colour is unused', () => {
    const markedRule = boardStyles.match(/\.board__square--marked\s*{[^}]*}/)?.[0] ?? ''
    expect(markedRule).toContain('var(--color-board-highlight)')
    expect(boardStyles).not.toContain('--color-board-mark')
  })
})

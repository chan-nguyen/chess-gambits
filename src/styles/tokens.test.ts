import { describe, expect, it } from 'vitest'
import designSystem from '../../docs/design-system.md?raw'
import { themeAttribute } from './theme.ts'
import tokensCss from './tokens.css?raw'

/**
 * AC 1 and AC 6, over the shipped stylesheet rather than over an impression of it.
 *
 * Two directions are checked, and both matter. Every value in `docs/design-system.md` §2
 * reaches `tokens.css` — so a documented token cannot go unimplemented — and every custom
 * property in `tokens.css` appears in §2 — so a value cannot be invented at implementation
 * time, which is the thing that document exists to prevent.
 *
 * The contrast maths is a second copy of the one in `board-contrast.test.ts`. That is
 * deliberate: a gate that imports its own subject can be disabled by one edit, and the two
 * files check different palettes.
 */

const CSS = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '')

const LIGHT_SELECTOR = ':root {'
const DARK_MEDIA_SELECTOR = `:root:not([${themeAttribute}='light'])`
const DARK_ATTRIBUTE_SELECTOR = `:root[${themeAttribute}='dark']`

/** The body of the rule introduced by `selector`, braces matched rather than guessed. */
const blockOf = (selector: string): string => {
  const start = CSS.indexOf(selector)
  if (start === -1) throw new Error(`tokens.css has no ${selector} rule`)
  const open = CSS.indexOf('{', start)
  if (open === -1) throw new Error(`${selector} opens no block`)

  let depth = 0
  for (let index = open; index < CSS.length; index += 1) {
    if (CSS[index] === '{') depth += 1
    if (CSS[index] === '}') {
      depth -= 1
      if (depth === 0) return CSS.slice(open + 1, index)
    }
  }
  throw new Error(`${selector} is never closed`)
}

const declarationsIn = (block: string): ReadonlyMap<string, string> => {
  const declarations = new Map<string, string>()
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (name === undefined || value === undefined) continue
    declarations.set(name, value.trim())
  }
  return declarations
}

const LIGHT = declarationsIn(blockOf(LIGHT_SELECTOR))
const DARK_MEDIA = declarationsIn(blockOf(DARK_MEDIA_SELECTOR))
const DARK_ATTRIBUTE = declarationsIn(blockOf(DARK_ATTRIBUTE_SELECTOR))

/** `| `--token` | `#light` | `#dark` |`, in any of §2's three colour tables. */
const COLOUR_ROW = /^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/gim

/** `| `--token` | `value` |`, which is §2's scalar table and nothing else. */
const SCALAR_ROW = /^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/gm

type Themed = { readonly light: string; readonly dark: string }

const documentedColours = (): ReadonlyMap<string, Themed> => {
  const colours = new Map<string, Themed>()
  for (const [, name, light, dark] of designSystem.matchAll(COLOUR_ROW)) {
    if (name === undefined || light === undefined || dark === undefined) continue
    colours.set(name, { light, dark })
  }
  return colours
}

const documentedScalars = (): ReadonlyMap<string, string> => {
  const scalars = new Map<string, string>()
  for (const [, name, value] of designSystem.matchAll(SCALAR_ROW)) {
    if (name === undefined || value === undefined) continue
    scalars.set(name, value)
  }
  return scalars
}

const COLOURS = documentedColours()
const SCALARS = documentedScalars()

describe('the tokens the design system documents', () => {
  // A floor under the regexes, not a count of the palette: it fails when a table stops
  // being parsed, not when a token is retired or restored. #80 retired
  // `--color-board-highlight-from` (30 → 29); 2026-09-18 restored it (29 → 30); 2026-09-18
  // merged it with `--color-board-highlight-to` into `--color-board-highlight` (30 → 29);
  // a follow-up to #131 retired `--color-board-mark`, reusing `--color-board-highlight`
  // for the home board's mark instead of its own token (29 → 28).
  it('finds both tables, so this file is asserting something', () => {
    expect(COLOURS.size).toBeGreaterThanOrEqual(28)
    expect(SCALARS.size).toBeGreaterThanOrEqual(30)
  })

  it.each([...COLOURS.keys()])(
    'defines %s in the light theme with the documented value',
    (name) => {
      expect(LIGHT.get(name)).toBe(COLOURS.get(name)?.light)
    },
  )

  it.each([...COLOURS.keys()])(
    'defines %s in both dark blocks with the documented value',
    (name) => {
      expect(DARK_MEDIA.get(name)).toBe(COLOURS.get(name)?.dark)
      expect(DARK_ATTRIBUTE.get(name)).toBe(COLOURS.get(name)?.dark)
    },
  )

  it.each([...SCALARS.keys()])('defines %s with the documented value', (name) => {
    expect(LIGHT.get(name)).toBe(SCALARS.get(name))
  })

  /**
   * The other direction. Without this, a component author can add a token to `tokens.css`
   * that no document ever agreed to, which is exactly how a design system stops being one.
   */
  it('defines nothing the design system has not agreed to', () => {
    const documented = new Set([...COLOURS.keys(), ...SCALARS.keys()])
    expect([...LIGHT.keys()].filter((name) => !documented.has(name))).toStrictEqual([])
  })

  it('leaves --color-board-legal undefined, as §2 says', () => {
    // "v1 shows no legal moves, so nothing renders it." A value here would be decoration
    // pretending to be a decision.
    expect(LIGHT.has('--color-board-legal')).toBe(false)
    expect(COLOURS.has('--color-board-legal')).toBe(false)
  })

  it('redefines only colours in the dark blocks', () => {
    for (const block of [DARK_MEDIA, DARK_ATTRIBUTE]) {
      expect([...block.keys()].filter((name) => !COLOURS.has(name))).toStrictEqual([])
    }
  })
})

/**
 * Every custom property any stylesheet reads has to be one this file defines.
 *
 * This direction is the one that actually broke: `Board.css` shipped in #4 referring to
 * `--space-1`, `--radius-sm` and `--duration-base` months before anything defined them, so
 * the board drew with three properties that resolved to nothing at all. Nothing failed,
 * because a missing custom property is not an error in CSS — it is silence.
 */
const referencedTokens = (css: string): readonly string[] => [
  ...new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].flatMap(([, name]) => name ?? [])),
]

describe('every token a stylesheet reads', () => {
  const stylesheets: Readonly<Record<string, string>> = import.meta.glob('/src/**/*.css', {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  it.each(Object.entries(stylesheets))('is defined before %s asks for it', (_path, css) => {
    expect(referencedTokens(css).filter((name) => !LIGHT.has(name))).toStrictEqual([])
  })

  it('would catch a stylesheet reaching for one that does not exist', () => {
    expect(
      referencedTokens('.x { color: var(--color-invented) }').filter((name) => !LIGHT.has(name)),
    ).toStrictEqual(['--color-invented'])
  })
})

describe('the two dark blocks', () => {
  /**
   * CSS cannot name a declaration block and reuse it, so the dark palette is written
   * twice: once for the system preference and once for the explicit override. This is the
   * test that stops the second copy drifting from the first.
   */
  it('are identical, so the system preference and the override cannot disagree', () => {
    expect([...DARK_ATTRIBUTE.entries()]).toStrictEqual([...DARK_MEDIA.entries()])
  })

  it('let an explicit light choice win over a dark system preference', () => {
    const media = CSS.slice(CSS.indexOf('@media (prefers-color-scheme: dark)'))
    expect(media).toContain(`:root:not([${themeAttribute}='light'])`)
  })
})

describe('the page itself', () => {
  it('gives body an explicit background and colour', () => {
    expect(blockOf('body {')).toContain('background-color: var(--color-bg)')
    expect(blockOf('body {')).toContain('color: var(--color-text)')
  })

  it('backs html too, so nothing paints white behind a dark page', () => {
    expect(blockOf('html {')).toContain('background-color: var(--color-bg)')
  })

  it('tells the browser which schemes it supports, so native controls follow', () => {
    expect(blockOf(LIGHT_SELECTOR)).toContain('color-scheme: light dark')
    expect(blockOf(DARK_ATTRIBUTE_SELECTOR)).toContain('color-scheme: dark')
    expect(blockOf(`:root[${themeAttribute}='light']`)).toContain('color-scheme: light')
  })
})

/* ------------------------------------------------------------------ contrast, AC 6 */

const channel = (hex: string, offset: number): number => {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.2 relative luminance. A weighted sum of three channels, carrying no hue. */
const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)

const contrast = (a: string, b: string): number => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}

const BODY = 4.5
const LARGE = 3
const COMPONENT = 3

const SURFACES = ['--color-bg', '--color-surface', '--color-surface-raised']

/** Every token that is ever drawn as text. §2 rule 1: all of them clear 4.5:1. */
const TEXT_TOKENS = [
  '--color-text',
  '--color-text-muted',
  '--color-accent',
  '--color-mate',
  '--color-advantage',
  '--color-equal',
  '--color-worse',
  '--color-quality-best',
  '--color-quality-good',
  '--color-quality-inaccuracy',
  '--color-quality-mistake',
  '--color-quality-blunder',
]

type Pair = { readonly foreground: string; readonly background: string; readonly floor: number }

const pairsToCheck = (): readonly Pair[] => [
  ...TEXT_TOKENS.flatMap((foreground) =>
    SURFACES.map((background) => ({ foreground, background, floor: BODY })),
  ),
  // Headings and the site name are large text, and are held to the large-text floor.
  { foreground: '--color-text', background: '--color-bg', floor: LARGE },
  { foreground: '--color-accent', background: '--color-bg', floor: LARGE },
  // The one pair whose background is not a surface (§2 rule 2).
  { foreground: '--color-accent-contrast', background: '--color-accent', floor: BODY },
  // Non-text contrast, WCAG 1.4.11 (§2 rules 3 and 4).
  ...SURFACES.map((background) => ({ foreground: '--color-focus', background, floor: COMPONENT })),
  ...SURFACES.map((background) => ({
    foreground: '--color-border-strong',
    background,
    floor: COMPONENT,
  })),
  // A divider is not a component. Held to a perceptibility floor instead, and said so.
  { foreground: '--color-border', background: '--color-bg', floor: 1.5 },
]

/**
 * Returns a description of every pair that fails, rather than throwing on the first. The
 * failing-fixture tests below run this same function over a deliberately broken palette,
 * which is what makes this gate one that has been seen to fail.
 */
const failuresIn = (
  values: ReadonlyMap<string, string>,
  pairs: readonly Pair[],
): readonly string[] =>
  pairs.flatMap(({ foreground, background, floor }) => {
    const first = values.get(foreground)
    const second = values.get(background)
    if (first === undefined || second === undefined) {
      return [`${foreground} on ${background}: one of them is not defined`]
    }
    const ratio = contrast(first, second)
    return ratio >= floor
      ? []
      : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1, needs ${floor}:1`]
  })

describe.each([
  ['light', LIGHT],
  ['dark', DARK_ATTRIBUTE],
])('the %s theme clears WCAG 2.2 AA', (_theme, values) => {
  it('on every pair the product draws', () => {
    expect(failuresIn(values, pairsToCheck())).toStrictEqual([])
  })
})

describe('the contrast gate can fail', () => {
  /**
   * The point of these three. A gate nobody has tried to violate is a gate nobody knows
   * works, so each of the three floors above is shown rejecting a palette that misses it.
   */
  const broken = (overrides: Readonly<Record<string, string>>): ReadonlyMap<string, string> =>
    new Map([...LIGHT.entries(), ...Object.entries(overrides)])

  it('rejects body text that misses 4.5:1', () => {
    const failures = failuresIn(broken({ '--color-text-muted': '#8d8d8d' }), pairsToCheck())
    expect(failures).not.toStrictEqual([])
    expect(failures.join('\n')).toContain('--color-text-muted on --color-bg')
    expect(failures.join('\n')).toContain('needs 4.5:1')
  })

  it('rejects a focus ring that misses 3:1', () => {
    const failures = failuresIn(broken({ '--color-focus': '#f4f2ef' }), pairsToCheck())
    expect(failures.join('\n')).toContain('--color-focus on --color-bg')
    expect(failures.join('\n')).toContain('needs 3:1')
  })

  it('rejects text on the accent that misses 4.5:1', () => {
    const failures = failuresIn(broken({ '--color-accent-contrast': '#6d9aa3' }), pairsToCheck())
    expect(failures.join('\n')).toContain('--color-accent-contrast on --color-accent')
  })

  it('reports a token it cannot find rather than passing it', () => {
    const missing = new Map([...LIGHT.entries()].filter(([name]) => name !== '--color-focus'))
    expect(failuresIn(missing, pairsToCheck()).join('\n')).toContain('is not defined')
  })
})

describe('the contrast maths', () => {
  it("agrees with WCAG's own reference ratios", () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 1)
  })
})

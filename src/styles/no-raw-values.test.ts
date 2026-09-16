import { describe, expect, it } from 'vitest'

/**
 * AC 2. No component may use a raw colour, spacing, radius or duration value: every one
 * of them is a token, defined once in `tokens.css` and documented in
 * `docs/design-system.md` §2.
 *
 * This is the gate. It reads every shipped file under `src/` — stylesheets and components
 * alike, because a raw `#fff` in a `style` attribute is the same defect as one in a
 * stylesheet — and fails naming the file, the line and what it found.
 *
 * Two exclusions, both deliberate and both narrow:
 *
 * - **`tokens.css`**, which is where the values live. Excluding it is the point of having
 *   it.
 * - **Tests and fixtures**, which have to be able to write a raw value in order to check
 *   that something rejects it. This file is the clearest example: the fixtures at the
 *   bottom are raw values on purpose.
 */

const SHIPPED_SOURCES: Readonly<Record<string, string>> = import.meta.glob(
  '/src/**/*.{css,ts,tsx}',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
)

const isExcluded = (path: string): boolean =>
  path.endsWith('/tokens.css') || path.includes('.test.') || path.includes('fixtures')

const SCANNED = Object.entries(SHIPPED_SOURCES)
  .filter(([path]) => !isExcluded(path))
  .map(([path, text]) => ({ path: path.replace(/^\//, ''), text }))

/**
 * Comments are removed first: a comment that mentions `1px` is documentation, and the one
 * thing that must never happen to a gate is that explaining a decision trips it.
 */
const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

/**
 * Media conditions are removed too, and this one is a genuine limitation rather than a
 * convenience: CSS custom properties are not valid inside a media query, so a breakpoint
 * cannot be a token however much one would like it to be. `the breakpoints` below closes
 * the hole that opens here, by asserting that the only two lengths a media condition may
 * name are the two §2 documents.
 */
const withoutMediaConditions = (text: string): string => text.replace(/@media[^{]*/g, '@media ')

const PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'a hex colour', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'an rgb() colour', pattern: /\brgba?\(/ },
  { name: 'a px length', pattern: /\b\d+(?:\.\d+)?px\b/ },
]

/** Every raw value in one file, as a line a human can act on without reading this test. */
const rawValuesIn = (path: string, text: string): readonly string[] =>
  withoutMediaConditions(withoutComments(text))
    .split('\n')
    .flatMap((line, index) =>
      PATTERNS.filter(({ pattern }) => pattern.test(line)).map(
        ({ name }) => `${path}:${index + 1} uses ${name}: ${line.trim()}`,
      ),
    )

const scan = (
  files: readonly { readonly path: string; readonly text: string }[],
): readonly string[] => files.flatMap(({ path, text }) => rawValuesIn(path, text))

describe('no shipped file outside tokens.css uses a raw value', () => {
  it('scans the files it claims to scan', () => {
    const paths = SCANNED.map(({ path }) => path)
    expect(paths).toContain('src/styles/global.css')
    expect(paths).toContain('src/components/layout/Header.css')
    expect(paths).toContain('src/components/layout/Header.tsx')
    // The board is #4's, and it is held to this gate like everything else.
    expect(paths).toContain('src/components/board/Board.css')
    expect(paths).not.toContain('src/styles/tokens.css')
  })

  it('finds none', () => {
    expect(scan(SCANNED)).toStrictEqual([])
  })
})

describe('the breakpoints', () => {
  /**
   * The other half of the media-condition exclusion above. Every length a media condition
   * names has to be one of §2's two breakpoints, so the exclusion cannot be used to smuggle
   * a third one in.
   */
  const DOCUMENTED = ['768px', '1024px']

  it('are only the two the design system documents', () => {
    const used = SCANNED.flatMap(({ text }) =>
      [...withoutComments(text).matchAll(/@media[^{]*/g)].flatMap((match) => [
        ...(match[0].match(/\d+(?:\.\d+)?px/g) ?? []),
      ]),
    )

    expect([...new Set(used)].filter((length) => !DOCUMENTED.includes(length))).toStrictEqual([])
  })
})

describe('the gate can fail', () => {
  /**
   * The reason this block exists: a gate nobody has tried to violate is a gate nobody
   * knows works. Each pattern is shown rejecting a file that carries it, and the report is
   * checked for the file and the line, because a failure that does not say where is a
   * failure somebody has to reproduce before they can fix it.
   */
  const REJECTED: readonly { readonly what: string; readonly source: string }[] = [
    { what: 'a six-digit hex', source: '.card {\n  color: #ff0000;\n}' },
    { what: 'a three-digit hex', source: '.card {\n  color: #f00;\n}' },
    { what: 'an rgb() colour', source: '.card {\n  color: rgb(255, 0, 0);\n}' },
    { what: 'an rgba() colour', source: '.card {\n  color: rgba(255, 0, 0, 0.5);\n}' },
    { what: 'a px margin', source: '.card {\n  margin: 12px;\n}' },
    { what: 'a fractional px', source: '.card {\n  border-width: 1.5px;\n}' },
    {
      what: 'a hex in a component',
      source: 'const card = (\n  <p style={{ color: "#ff0000" }}>x</p>\n)',
    },
  ]

  it.each(REJECTED)('rejects $what', ({ source }) => {
    const findings = scan([{ path: 'src/components/bad.css', text: source }])

    expect(findings).not.toStrictEqual([])
    expect(findings[0]).toContain('src/components/bad.css:2')
  })

  it('names every file that carries one, not just the first', () => {
    const findings = scan([
      { path: 'src/a.css', text: '.a { color: #ff0000; }' },
      { path: 'src/b.css', text: '.b { margin: 4px; }' },
    ])

    expect(findings).toHaveLength(2)
    expect(findings.join('\n')).toContain('src/a.css')
    expect(findings.join('\n')).toContain('src/b.css')
  })

  it('accepts the same declarations written as tokens', () => {
    const source = '.card {\n  color: var(--color-text);\n  margin: var(--space-3);\n}'

    expect(scan([{ path: 'src/components/good.css', text: source }])).toStrictEqual([])
  })

  it('does not trip on a value that only appears in a comment', () => {
    const source =
      '/* was #ff0000 and 12px before the tokens landed */\n.card {\n  color: var(--color-text);\n}'

    expect(scan([{ path: 'src/components/good.css', text: source }])).toStrictEqual([])
  })

  it('catches a third breakpoint even though media conditions are excluded', () => {
    const used = [...'@media (min-width: 900px) { .a { color: red } }'.matchAll(/@media[^{]*/g)]

    expect(used.flatMap((match) => [...(match[0].match(/\d+px/g) ?? [])])).toStrictEqual(['900px'])
  })
})

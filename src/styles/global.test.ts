import { describe, expect, it } from 'vitest'
import globalCss from './global.css?raw'

/**
 * AC 5, and the half of §5 that a stylesheet can be held to on its own: all motion off
 * under `prefers-reduced-motion: reduce`, and a focus ring that no component removes.
 *
 * The browser-side half — that a real element really does compute to no transition under
 * the emulated preference — is `e2e/shell.spec.ts`, because only a browser can answer it.
 */

const STYLESHEETS: Readonly<Record<string, string>> = import.meta.glob('/src/**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, ' ')

/** The reduced-motion rule, or the reasons it does not do its job. */
const killSwitchProblems = (css: string): readonly string[] => {
  const at = withoutComments(css).indexOf('@media (prefers-reduced-motion: reduce)')
  if (at === -1) return ['no prefers-reduced-motion: reduce block at all']

  const block = withoutComments(css).slice(at)
  const problems: string[] = []
  if (!/\*,\s*\*::before,\s*\*::after/.test(block)) {
    problems.push('the block does not apply to every element')
  }
  for (const property of ['animation', 'transition']) {
    if (!new RegExp(`${property}:\\s*none\\s*!important`).test(block)) {
      problems.push(`${property} is not switched off with !important`)
    }
  }
  return problems
}

describe('motion under prefers-reduced-motion: reduce', () => {
  it('is switched off for every element, and cannot be overridden by a component', () => {
    expect(killSwitchProblems(globalCss)).toStrictEqual([])
  })

  /**
   * The gate, shown failing. Each of these is a stylesheet somebody could plausibly write
   * and believe was compliant.
   */
  it.each([
    ['a stylesheet with no reduced-motion block', 'body { color: red }'],
    [
      'a block that only covers one component',
      '@media (prefers-reduced-motion: reduce) { .board { animation: none !important } }',
    ],
    [
      'a block that a component can override',
      '@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none; transition: none } }',
    ],
  ])('rejects %s', (_case, css) => {
    expect(killSwitchProblems(css)).not.toStrictEqual([])
  })
})

describe('the focus ring', () => {
  it('is declared once, from tokens, and never removed', () => {
    expect(withoutComments(globalCss)).toContain(
      'outline: var(--focus-ring-width) solid var(--color-focus)',
    )
    expect(withoutComments(globalCss)).toContain('outline-offset: var(--focus-ring-offset)')
  })

  /**
   * §5: "`outline: none` without a replacement indicator is a review failure." A reviewer
   * is a person who can be tired; this is the same check made by a machine.
   */
  const removesOutline = (css: string): boolean =>
    /outline:\s*(none|0)\b/.test(withoutComments(css))

  it.each(Object.entries(STYLESHEETS))('is not removed by %s', (_path, css) => {
    expect(removesOutline(css)).toBe(false)
  })

  it('would catch a stylesheet that removed it', () => {
    expect(removesOutline('.button:focus { outline: none; }')).toBe(true)
    expect(removesOutline('.button:focus { outline: 0; }')).toBe(true)
  })
})

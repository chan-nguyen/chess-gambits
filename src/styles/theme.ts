import { readStored, writeStored } from '../lib/storage.ts'

/**
 * The persisted dark-mode override (docs/design-system.md §2).
 *
 * Three settings rather than two: without an explicit `system`, a visitor who tries dark
 * mode can never get back to following their operating system, because there would be no
 * way to say "no override" other than clearing site data by hand.
 *
 * Kept next to `tokens.css` because the two share one contract — the settings here are
 * exactly the `data-theme` values that file styles, and `tokens.test.ts` asserts it.
 */

export type ThemeSetting = 'system' | 'light' | 'dark'

export const themeSettings: readonly ThemeSetting[] = ['system', 'light', 'dark']

export const defaultThemeSetting: ThemeSetting = 'system'

/**
 * Where the override is remembered, and the attribute it is applied through.
 *
 * Both are also spelled out by hand in the pre-paint script in `index.html`, and this is
 * the explanation that script's comment points at. That script has to run before anything
 * paints, so it cannot be a module — a module script is deferred, and by the time one ran
 * the page would have painted in the wrong theme and then corrected itself in front of the
 * visitor. Being non-module, it can import nothing, so it repeats these two strings.
 *
 * `theme.test.ts` reads that script out of `index.html` and fails if the two spellings
 * ever drift apart. It is also the one `localStorage` access outside `src/lib/storage.ts`,
 * which is recorded as an exemption in `docs/security.md` B5 rather than left to be
 * noticed.
 */
export const themeStorageKey = 'chess-gambits.theme'
export const themeAttribute = 'data-theme'

const settingSet: ReadonlySet<string> = new Set(themeSettings)

export const isThemeSetting = (value: string): value is ThemeSetting => settingSet.has(value)

/** The remembered setting, or `system` if there is none or it has been tampered with. */
export const readThemeSetting = (): ThemeSetting =>
  readStored(themeStorageKey, isThemeSetting) ?? defaultThemeSetting

/**
 * Apply a setting to the document. `system` removes the attribute rather than setting a
 * third value, so the media query in `tokens.css` is what decides — one mechanism, not
 * two that can disagree.
 */
export const applyThemeSetting = (setting: ThemeSetting): void => {
  const root = document.documentElement
  if (setting === defaultThemeSetting) root.removeAttribute(themeAttribute)
  else root.setAttribute(themeAttribute, setting)
}

/** Remember a setting, so the next visit paints in it before any script runs. */
export const rememberThemeSetting = (setting: ThemeSetting): void =>
  writeStored(themeStorageKey, setting)

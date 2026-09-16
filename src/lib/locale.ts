/**
 * Locale is the first path segment on every route, so every URL is shareable with its
 * language intact (docs/design-system.md §1). It is a closed set of three, validated at
 * the boundary by hand: five closed enums and one string do not justify a schema library
 * against this project's bundle budget.
 *
 * This module is deliberately free of browser APIs, because the build script that emits
 * the route shells runs in Node and needs the same closed set. Anything that reaches for
 * `localStorage` lives in `locale-preference.ts`.
 */

export const locales = ['vi', 'en', 'fr'] as const

export type Locale = (typeof locales)[number]

/** Vietnamese is the source locale (docs/CONTEXT.md, *Annotation*). */
export const defaultLocale: Locale = 'vi'

/** Where a resolved locale is remembered. Here, not in `locale-preference.ts`, so the
 * end-to-end tests can name the key without importing a module that touches the DOM. */
export const storedLocaleKey = 'chess-gambits.locale'

const localeSet: ReadonlySet<string> = new Set(locales)

export const isLocale = (value: string): value is Locale => localeSet.has(value)

/**
 * The best locale for a visitor's language preferences. Matches on the primary subtag,
 * so `fr-CA` and `FR` both resolve to `fr`, and falls back to Vietnamese.
 */
export const preferredLocale = (languages: readonly string[]): Locale => {
  for (const language of languages) {
    const primary = language.split('-')[0]?.toLowerCase()
    if (primary !== undefined && isLocale(primary)) return primary
  }
  return defaultLocale
}

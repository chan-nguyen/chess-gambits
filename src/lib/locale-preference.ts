import { isLocale, preferredLocale, storedLocaleKey, type Locale } from './locale.ts'
import { readStored, writeStored } from './storage.ts'

/**
 * Which language `/` sends a visitor to, and remembering the answer. Separate from
 * `locale.ts` because this half touches `localStorage` and that half is shared with the
 * Node build script.
 */

/** The locale resolved on a previous visit, if there is one and it is still a locale. */
export const readStoredLocale = (): Locale | null => readStored(storedLocaleKey, isLocale)

/** Remember a resolved locale so the redirect from `/` is stable on a return visit. */
export const rememberLocale = (locale: Locale): void => writeStored(storedLocaleKey, locale)

/**
 * Where `/` should send a visitor: what was resolved last time if anything, otherwise
 * what their browser asks for, otherwise Vietnamese. Resolving remembers its own answer,
 * so the next visit does not re-resolve it.
 */
export const resolveLocale = (languages: readonly string[]): Locale => {
  const stored = readStoredLocale()
  if (stored !== null) return stored

  const preferred = preferredLocale(languages)
  rememberLocale(preferred)
  return preferred
}

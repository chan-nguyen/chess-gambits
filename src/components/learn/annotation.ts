import type { CompiledAnnotation } from '../../lib/content-types.ts'
import { defaultLocale, type Locale } from '../../lib/locale.ts'

/**
 * What a node says, in the visitor's language — and the truth about which language that
 * turned out to be (AC 4).
 *
 * This deliberately mirrors `useTranslated`'s `TranslatedText` rather than reusing it.
 * That hook reports fallback for an *interface* string, resolved by i18next out of a
 * locale catalogue. This is *content*, which arrives in one JSON object per node with
 * Vietnamese guaranteed and the other two optional (docs/CONTEXT.md, *Annotation*), and
 * i18next never sees it. Two mechanisms, one vocabulary: both end in `UntranslatedNotice`
 * and a `lang` attribute, so a visitor meets the same marker either way.
 */
export type LocalisedProse = {
  /** Never blank: the Vietnamese is required by the schema and is the last resort. */
  readonly text: string
  /** The locale that actually supplied the text, for the element's own `lang`. */
  readonly locale: Locale
  readonly untranslated: boolean
}

/**
 * An empty string counts as absent. A translator who clears a field has not translated it,
 * and rendering nothing at all would be the one outcome requirement F9 forbids.
 */
export const localiseAnnotation = (
  annotation: CompiledAnnotation,
  locale: Locale,
): LocalisedProse => {
  const text = annotation[locale]
  return text === undefined || text === ''
    ? { text: annotation.vi, locale: defaultLocale, untranslated: locale !== defaultLocale }
    : { text, locale, untranslated: false }
}

/** The words the live region needs, in the active locale. SAN itself is not among them. */
export type AnnouncementWords = {
  readonly capture: string
  readonly check: string
  readonly checkmate: string
}

/**
 * What the board's polite live region says when the position changes
 * (docs/design-system.md §5): the SAN played, and whether it captures, checks or mates.
 *
 * Read off the SAN rather than off the position, because this application has no rules
 * engine and must not grow one (ADR-0003): `x`, `+` and `#` are part of the notation the
 * content pipeline already verified against a real board, so trusting them here trusts a
 * check that has already happened rather than repeating it in the browser.
 */
export const announcementOf = (ply: string, words: AnnouncementWords): string => {
  const parts = [ply]
  if (ply.includes('x')) parts.push(words.capture)
  if (ply.endsWith('#')) parts.push(words.checkmate)
  else if (ply.endsWith('+')) parts.push(words.check)
  return parts.join(', ')
}

import { UntranslatedNotice } from './UntranslatedNotice.tsx'
import type { TranslationKey } from './translations.ts'
import { useTranslated, type TranslationValues } from './useTranslated.ts'

type TranslatedProps = {
  /** A key from the Vietnamese catalogue. A typo here is a compile error. */
  readonly id: TranslationKey
  /** Values for a string with `{{holes}}` in it. See `TranslationValues`. */
  readonly values?: TranslationValues
}

/**
 * A translated string, marked when it is not actually translated.
 *
 * The fallback branch wraps the text in its own `lang` (acceptance criterion 5). Without
 * it a screen reader set to French would pronounce Vietnamese with French phonetics, which
 * is not merely accented — it is unintelligible.
 *
 * For a string that ends up in an *attribute* rather than in content — an `aria-label`,
 * say — call `useTranslated` directly. There is nowhere in an attribute to put a visible
 * marker, and `lang` on the element would be inherited by children that are translated, so
 * those strings are marked by the visible text around them instead.
 */
export const Translated = ({ id, values }: TranslatedProps) => {
  const translated = useTranslated()(id, values)

  if (!translated.untranslated) return <>{translated.text}</>

  return (
    <>
      <span lang={translated.locale}>{translated.text}</span>
      <UntranslatedNotice />
    </>
  )
}

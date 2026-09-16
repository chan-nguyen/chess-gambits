import { useTranslation } from 'react-i18next'
import { defaultLocale, isLocale, type Locale } from '../lib/locale.ts'
import { translationNamespace, type TranslationKey } from './translations.ts'

/**
 * One string, and the truth about where it came from.
 *
 * **This is the mechanism the whole ticket turns on (acceptance criterion 4).** i18next's
 * `missingKeyHandler` and `saveMissing` do *not* fire when a key resolves through
 * `fallbackLng`: the resolver walks the entire fallback chain and reports "missing" only
 * when the key is absent from every language. A marker built on them would therefore never
 * appear, and the failure would be invisible — the page would look finished while
 * presenting Vietnamese text as French.
 *
 * `returnDetails` reports `usedLng`, the locale that actually satisfied the lookup, which
 * is an exact per-string signal: `usedLng === 'vi'` while the visitor is browsing `/fr/`
 * means this particular string is untranslated.
 */
export type TranslatedText = {
  /** The text to render. Never blank and never a raw key (acceptance criterion 3). */
  readonly text: string
  /** The locale that satisfied the lookup, for the element's own `lang` attribute. */
  readonly locale: Locale
  /** True when `locale` is not the active locale, so the text needs a visible marker. */
  readonly untranslated: boolean
}

export const useTranslated = (): ((key: TranslationKey) => TranslatedText) => {
  const { t, i18n } = useTranslation()

  /**
   * When the active locale's catalogue did not arrive at all, *every* string falls back and
   * marking each one individually tells the visitor nothing they cannot see: the answer is
   * "all of them", and `LocaleBundleNotice` states it once. So the per-string marker is
   * suppressed in that case only, and the page-level notice takes over.
   *
   * Read from the instance rather than from React state on purpose. It is the same object
   * `t` just consulted, so the marker cannot disagree with the text beside it, and there is
   * no render in which a stale status flashes a marker onto every string on the page.
   */
  const activeBundleMissing = !i18n.hasResourceBundle(i18n.language, translationNamespace)

  return (key) => {
    const details = t(key, { returnDetails: true })
    const used = isLocale(details.usedLng) ? details.usedLng : defaultLocale

    return {
      text: details.res,
      locale: used,
      untranslated: used !== i18n.language && !activeBundleMissing,
    }
  }
}

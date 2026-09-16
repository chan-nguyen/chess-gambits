import i18next, { type i18n as I18nInstance } from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'
import { defaultLocale, locales, type Locale } from '../lib/locale.ts'
import { translationNamespace } from './translations.ts'

/**
 * The i18next instance, and the lazy backend that feeds it.
 *
 * ADR-0006 chose this stack for one reason: it is the only candidate that falls back *and*
 * reports, per string, which locale satisfied the lookup. That report is `returnDetails`
 * (`useTranslated.ts`), and everything here exists to make it trustworthy.
 */

/** Fetches one locale's catalogue. Injectable so tests can hand over a doctored one. */
export type LocaleLoader = (locale: string) => Promise<unknown>

/**
 * One chunk per locale (acceptance criterion 2). The template literal is what makes that
 * true: Vite compiles it to a fixed map of `../locales/*.ts` and emits a separate chunk
 * for each, so nothing here is in the initial bundle and no visitor downloads all three.
 *
 * A visitor does, however, download **two**: i18next loads the whole fallback chain, so a
 * French visitor fetches `fr` *and* `vi`. That is not avoidable and not a defect — showing
 * Vietnamese fallback text requires having the Vietnamese text — but it is worth knowing
 * before reading ADR-0006's table, which counts two catalogues against Lingui.
 */
export const loadLocaleBundle: LocaleLoader = (locale) => import(`../locales/${locale}.ts`)

/**
 * A ready-to-use instance, already loading `locale`.
 *
 * `init` is not awaited: the caller watches `changeLanguage` instead, which settles for
 * both the first load and every later switch, so there is one code path rather than two.
 */
export const createI18n = (locale: Locale, load: LocaleLoader = loadLocaleBundle): I18nInstance => {
  const instance = i18next.createInstance()

  void instance
    .use(resourcesToBackend((language: string) => load(language)))
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: defaultLocale,
      /**
       * Every URL is attacker-controlled (docs/security.md B4). The locale segment is
       * already validated by `LocaleLayout` before it reaches here; this is the second
       * lock, and it keeps a stray value from ever becoming an `import()` specifier.
       */
      supportedLngs: [...locales],
      ns: [translationNamespace],
      defaultNS: translationNamespace,
      /**
       * React escapes every string it renders and this project never uses
       * `dangerouslySetInnerHTML` (docs/definition-of-done.md, *Never*), so i18next's own
       * HTML escaping would only produce double-escaped entities in the output.
       */
      interpolation: { escapeValue: false },
      /**
       * No suspense: the provider renders its own designed loading and failure states, and
       * a thrown promise would replace them with whatever boundary happened to be above.
       */
      react: { useSuspense: false },
    })

  return instance
}

/**
 * Which of the three situations the page is in, once a load has settled.
 *
 * Read off the instance rather than off the loader's promise, because a rejected promise
 * and a resolved-but-empty one are the same thing to a reader: the strings are not here.
 */
export type LocaleBundleStatus = 'loading' | 'ready' | 'fallback' | 'unavailable'

export const bundleStatus = (instance: I18nInstance, locale: Locale): LocaleBundleStatus => {
  if (instance.hasResourceBundle(locale, translationNamespace)) return 'ready'
  return instance.hasResourceBundle(defaultLocale, translationNamespace)
    ? 'fallback'
    : 'unavailable'
}

import type { ParseKeys } from 'i18next'
import type viTranslations from '../locales/vi.ts'

/**
 * The type contract for translation keys (acceptance criterion 6).
 *
 * `vi.ts` is the source locale, so its shape *is* the set of keys that exist. Augmenting
 * `CustomTypeOptions['resources']` with it makes `t('nav.catlogue')` a compile error
 * rather than a string that silently renders as its own key at runtime — the type safety
 * typesafe-i18n offers, without its release-blocking semantics (ADR-0006).
 *
 * The import is type-only, so nothing here puts the Vietnamese catalogue into the initial
 * bundle: the catalogues are reached exclusively through the lazy backend in `i18n.ts`.
 */

/** i18next resolves everything into one namespace; there is no second one to separate. */
export const translationNamespace = 'translation'

/** Every key the source locale defines, and therefore every key that may be asked for. */
export type Translations = typeof viTranslations

/**
 * What a non-source locale may supply: any subset, group by group and key by key.
 *
 * Deliberately *not* a recursive deep-partial. The catalogue is two levels by convention
 * (`vi.ts` says so), and a partial that only knows about two levels is one a reader can
 * hold in their head — and it still rejects a misspelt key, because an object literal
 * assigned to it is subject to excess-property checking.
 */
export type PartialTranslations = {
  readonly [Group in keyof Translations]?: {
    readonly [Key in keyof Translations[Group]]?: string
  }
}

/**
 * A key that exists. `ParseKeys` is i18next's own derivation from the augmented resources
 * below, so this alias tracks `vi.ts` automatically and cannot drift from it.
 */
export type TranslationKey = ParseKeys

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof translationNamespace
    resources: { translation: Translations }
  }
}

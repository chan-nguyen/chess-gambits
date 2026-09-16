import { useTranslation } from 'react-i18next'
import './LocaleBundleNotice.css'
import { defaultLocale } from '../lib/locale.ts'
import { useLocaleBundleStatus } from './locale-bundle-context.ts'

/**
 * A locale bundle that failed to load falls back to Vietnamese **and says so** (acceptance
 * criterion 7, docs/design-system.md §3 *Lazy-load failure states*).
 *
 * It reuses the untranslated vocabulary rather than inventing a second one for the same
 * idea: `untranslated.inVietnamese` is the same sentence the inline marker's explanation
 * uses, so a visitor who has met one recognises the other.
 *
 * Both strings necessarily resolve from Vietnamese here — the active catalogue is the thing
 * that did not arrive — so the element carries `lang="vi"` itself. There is no inline
 * marker on them, because in this state every string on the page fell back and marking
 * each one would restate what this sentence already says once.
 */
export const LocaleBundleNotice = () => {
  const status = useLocaleBundleStatus()
  const { t } = useTranslation()

  if (status !== 'fallback') return null

  return (
    <p className="locale-bundle-notice" role="status" lang={defaultLocale}>
      {t('untranslated.bundleFailed')} {t('untranslated.inVietnamese')}
    </p>
  )
}

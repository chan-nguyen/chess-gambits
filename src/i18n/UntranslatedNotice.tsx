import { useTranslation } from 'react-i18next'
import './UntranslatedNotice.css'

/**
 * The visible marker on a string that fell back to Vietnamese (docs/design-system.md §3,
 * requirement F9). Honest and unobtrusive: it names the situation in three words and never
 * interrupts the sentence it sits beside.
 *
 * The marker is *text*, not a colour or an icon, so it survives greyscale, a screen reader
 * and a stylesheet that failed to load — "no information conveyed by colour alone"
 * (docs/definition-of-done.md).
 *
 * It reads its own label with a plain `t` rather than through `useTranslated`, which would
 * be circular: a marker that needed marking would render a marker beside its own marker.
 * `untranslated.marker` is authored in all three locales precisely so it never has to.
 */
export const UntranslatedNotice = () => {
  const { t } = useTranslation()

  return <span className="untranslated-notice">{t('untranslated.marker')}</span>
}

import { useId, type RefObject } from 'react'
import './AnnotationPanel.css'
import { Translated } from '../../i18n/Translated.tsx'
import { UntranslatedNotice } from '../../i18n/UntranslatedNotice.tsx'
import type { LocalisedProse } from './annotation.ts'

/**
 * The current node's prose (docs/design-system.md §3), and the landing place for focus
 * after every navigation (AC 5).
 *
 * The heading is what a keyboard or screen-reader user hears when it takes focus, so it
 * names the position rather than the panel: "After 4.Qh5+" tells them what changed, where
 * "Annotation" tells them where they are on a page they did not move around in.
 *
 * `h2`, because the route owns the `h1` (docs/design-system.md §5).
 */
export type AnnotationPanelProps = {
  /** The current ply, already numbered, or null at the gambit root. */
  readonly label: string | null
  /** Null when this node has no annotation — a real state, not an impossible one. */
  readonly prose: LocalisedProse | null
  readonly headingRef: RefObject<HTMLHeadingElement | null>
}

export const AnnotationPanel = ({ label, prose, headingRef }: AnnotationPanelProps) => {
  const headingId = useId()

  return (
    <section className="annotation-panel" aria-labelledby={headingId}>
      {/*
       * `tabIndex={-1}` makes it focusable without adding a tab stop: it is a destination
       * for focus, never a step on the way to one.
       */}
      <h2 className="annotation-panel__heading" id={headingId} tabIndex={-1} ref={headingRef}>
        {label === null ? (
          <Translated id="learn.startingPosition" />
        ) : (
          <>
            <Translated id="learn.after" /> <span className="annotation-panel__ply">{label}</span>
          </>
        )}
      </h2>

      {prose === null ? (
        <p className="annotation-panel__empty">
          <Translated id="learn.noAnnotation" />
        </p>
      ) : (
        <p
          className="annotation-panel__prose"
          /*
           * Only on fallback. Setting `lang` unconditionally would be correct and useless;
           * setting it here is what stops a French screen reader pronouncing Vietnamese
           * with French phonetics, which is not an accent but noise.
           */
          lang={prose.untranslated ? prose.locale : undefined}
        >
          {prose.text}
          {prose.untranslated && (
            <>
              {' '}
              <UntranslatedNotice />
            </>
          )}
        </p>
      )}
    </section>
  )
}

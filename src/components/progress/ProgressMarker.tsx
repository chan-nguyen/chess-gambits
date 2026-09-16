import { useRef, useState } from 'react'
import './ProgressMarker.css'
import { Translated } from '../../i18n/Translated.tsx'

/**
 * Mark a branch learned, and unmark it (docs/design-system.md §3, AC 1).
 *
 * **Optimistic, and a `localStorage` failure is silent rather than a crash.** Nothing here
 * waits on anything: the state changes, the parent tries to store it, and whether that
 * succeeded is not a question this control asks. A private window or a full quota costs the
 * learner their marks on the next visit, which is an accepted, non-critical event (F10) —
 * and is a far better outcome than a control that reports a storage error at somebody trying
 * to learn a chess opening.
 *
 * **Unmarking is undoable rather than confirmed** (the binding decision behind AC 1).
 * Unmarking is the most destructive thing available here, and a confirmation dialogue for it
 * would be friction without safety: it interrupts the common case to protect against a
 * mistake that costs one click to repair. So the offer appears *after* the act, where it
 * costs nothing to anyone who meant it.
 *
 * The undo offer is state this component owns and the parent resets by remounting it with
 * the branch key as its `key`. That is what makes "undo" mean *this* branch and never the
 * one the learner has since navigated to.
 */
export type ProgressMarkerProps = {
  readonly marked: boolean
  readonly onChange: (marked: boolean) => void
}

export const ProgressMarker = ({ marked, onChange }: ProgressMarkerProps) => {
  const [undoable, setUndoable] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const toggle = (): void => {
    // Only an unmark leaves something to undo. Marking is not destructive, so offering to
    // undo it would be noise in the path the learner is actually on.
    setUndoable(marked)
    onChange(!marked)
  }

  const undo = (): void => {
    /**
     * Focus moves *before* the state change, not after. This button is about to be
     * unmounted, and focus on a removed element falls to `<body>` — which drops a keyboard
     * user to the top of the document as their reward for correcting a mistake. Moving it
     * first means React removes an element that no longer holds focus.
     */
    toggleRef.current?.focus()
    setUndoable(false)
    onChange(true)
  }

  return (
    <div className="progress-marker">
      {/*
       * One label, and `aria-pressed` carries the state. A control that changed its name
       * *and* its pressed state would say the same thing twice and disagree with itself
       * half the time: "Mark learned, pressed" is a sentence nobody can act on. The visible
       * state is border, background and weight together — never a hue on its own
       * (docs/definition-of-done.md, *no information conveyed by colour alone*).
       */}
      <button
        ref={toggleRef}
        type="button"
        className="progress-marker__toggle"
        aria-pressed={marked}
        onClick={toggle}
      >
        <Translated id="progress.learned" />
      </button>

      {/*
       * Present from the first render and empty until something happens, which is what makes
       * the announcement reliable: a live region inserted *with* its content is announced by
       * some screen readers and not others, while one that is already there and then filled
       * is announced by all of them. The sentence and the button share it, so what a screen
       * reader hears is "this branch is no longer marked learned, Undo, button" — the offer
       * and the way to take it, in one utterance.
       */}
      <p className="progress-marker__undo" role="status">
        {undoable && (
          <>
            <Translated id="progress.unmarked" />{' '}
            <button type="button" className="progress-marker__undo-action" onClick={undo}>
              <Translated id="progress.undo" />
            </button>
          </>
        )}
      </p>
    </div>
  )
}

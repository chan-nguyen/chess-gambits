import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import './LearningSurface.css'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { lineSearch } from '../../lib/line.ts'
import { defaultLocale, isLocale } from '../../lib/locale.ts'
import { Board } from '../board/Board.tsx'
import { AnnotationPanel } from './AnnotationPanel.tsx'
import { MoveList } from './MoveList.tsx'
import { MoveNavigator } from './MoveNavigator.tsx'
import { ShortcutToggle } from './ShortcutToggle.tsx'
import { announcementOf, localiseAnnotation } from './annotation.ts'
import { rememberShortcutSetting, readShortcutSetting, type ShortcutSetting } from './shortcuts.ts'
import { nextPath, plyLabel, previousPath, resolvePath } from './tree-path.ts'

/**
 * The core loop: look at the position, press next.
 *
 * Three things are wired together here and nowhere else — the URL, the keyboard, and where
 * focus lands — because all three answer the same question and would drift apart if they
 * were answered separately. The `line` parameter is the single source of truth: the arrow
 * keys navigate to a URL rather than setting state, so browser back and forward step
 * through the path for free (AC 3) and there is no second copy of "where am I" to go stale.
 */
export type LearningSurfaceProps = {
  readonly entry: CompiledEntry
  /** The plies the URL asked for. Already shape-checked by `parseLine`. */
  readonly requested: readonly string[]
}

/**
 * Whether a key press belongs to something else on the page.
 *
 * The board owns the arrow keys inside its own grid — they walk its roving tabindex from
 * square to square — so a global handler that also fired would move the cursor *and* leave
 * the position, which is two things from one press. Text fields are excluded for the usual
 * reason, which is emphatically **not** how AC 2 is satisfied: suppressing a shortcut
 * inside an input does not meet 2.1.4, the switch in `shortcuts.ts` does.
 */
const belongsToSomethingElse = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('[role="grid"]') !== null) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

export const LearningSurface = ({ entry, requested }: LearningSurfaceProps) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const translated = useTranslated()
  const labels = useBoardLabels()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [shortcuts, setShortcuts] = useState<ShortcutSetting>(readShortcutSetting)

  const locale = isLocale(i18n.language) ? i18n.language : defaultLocale
  const resolved = useMemo(() => resolvePath(entry.tree, requested), [entry.tree, requested])
  const { node, path, steps, strayedAt } = resolved

  const previous = previousPath(path)
  const next = nextPath(node, path)

  const go = useCallback(
    (target: readonly string[] | null): void => {
      if (target === null) return
      void navigate({ pathname, search: lineSearch(target) })
    },
    [navigate, pathname],
  )

  /**
   * Where the arrow keys go, kept in step with what has actually been painted.
   *
   * The listener reads this rather than closing over `previous` and `next` from the render
   * that created it. Those are right when the listener is made and wrong from the moment a
   * navigation starts until the *passive* effect that would replace it runs — which under
   * load is long enough for a real press to land. A 4x-throttled run pressed next six times
   * and then left once and went back two plies, which is the bug this shape removes rather
   * than narrows. `useLayoutEffect` runs in the same commit as the DOM change, so the
   * position the keyboard steps from and the position on the screen are never two
   * different things.
   */
  const targets = useRef<{
    previous: readonly string[] | null
    next: readonly string[] | null
  }>({ previous, next })

  useLayoutEffect(() => {
    targets.current = { previous, next }
  })

  useEffect(() => {
    if (shortcuts === 'off') return

    const onKeyDown = (event: KeyboardEvent): void => {
      // A modifier means the press was aimed at the browser, not at this page.
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return
      if (belongsToSomethingElse(event.target)) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      event.preventDefault()
      go(event.key === 'ArrowLeft' ? targets.current.previous : targets.current.next)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts, go])

  /**
   * AC 5. Focus lands on what changed, not at the top of the page.
   *
   * Keyed on the path rather than on a click handler, so it is true of every route to this
   * position: the two controls, the move list, an arrow key, and browser back and forward.
   * The first render is skipped — arriving on a page is not navigating within it, and
   * stealing focus on load would drop a screen-reader user past the heading they came for.
   */
  const pathKey = path.join('_')
  const previousKey = useRef<string | null>(null)
  useEffect(() => {
    if (previousKey.current !== null && previousKey.current !== pathKey) headingRef.current?.focus()
    previousKey.current = pathKey
  }, [pathKey])

  const prose = node.annotation === undefined ? null : localiseAnnotation(node.annotation, locale)
  const label = node.ply === undefined ? null : plyLabel(node.ply, node.fen)
  const announcement =
    node.ply === undefined
      ? ''
      : announcementOf(node.ply, {
          capture: translated('learn.capture').text,
          check: translated('learn.check').text,
          checkmate: translated('learn.checkmate').text,
        })

  return (
    <div className="learning-surface">
      {strayedAt !== null && (
        <p className="learning-surface__recovered" role="alert">
          <Translated id="learn.branchNotFound" />{' '}
          <span className="learning-surface__stray">{strayedAt}</span>
        </p>
      )}

      {/*
       * Board and controls in one block, in that order, at every width. §1 lists the
       * previous/next controls as part of the move context, and also states the rule that
       * decides the conflict: "at every width the board and the next/previous controls are
       * visible together without scrolling". A paragraph of annotation between them is
       * exactly what pushes them apart on a 360px phone, so the annotation follows.
       */}
      <div className="learning-surface__stage">
        <div className="learning-surface__board">
          <Board
            fen={node.fen}
            labels={labels}
            orientation={entry.side}
            announcement={announcement}
          />
        </div>
        <MoveNavigator previous={previous} next={next} />
      </div>

      <div className="learning-surface__context">
        <AnnotationPanel label={label} prose={prose} headingRef={headingRef} />
        <MoveList steps={steps} />
        <ShortcutToggle
          setting={shortcuts}
          onChange={(setting) => {
            setShortcuts(setting)
            rememberShortcutSetting(setting)
          }}
        />
      </div>
    </div>
  )
}

/**
 * What the board region shows while the compiled tree is still on the wire.
 *
 * It lives here rather than in the route so that it reserves the *same* box the board
 * will take — one stylesheet, one size, and no chance of the placeholder and the thing it
 * stands in for drifting to different heights, which is the whole failure CLS measures.
 */
export const PendingPosition = () => (
  <div className="learning-surface">
    <div className="learning-surface__stage">
      <div className="learning-surface__board learning-surface__board--pending" aria-busy="true">
        <p className="learning-surface__pending-text">
          <Translated id="learn.loading" />
        </p>
      </div>
    </div>
  </div>
)

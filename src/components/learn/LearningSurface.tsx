import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import './LearningSurface.css'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { defaultLocale, isLocale } from '../../lib/locale.ts'
import { Board } from '../board/Board.tsx'
import { AnnotationPanel } from './AnnotationPanel.tsx'
import { BranchChoices } from './BranchChoices.tsx'
import { MoveList } from './MoveList.tsx'
import { MoveNavigator } from './MoveNavigator.tsx'
import { OutcomeCard } from './OutcomeCard.tsx'
import { PlanChoices } from './PlanChoices.tsx'
import { ShortcutToggle } from './ShortcutToggle.tsx'
import { announcementOf, localiseAnnotation } from './annotation.ts'
import { lastPlyBetween } from './last-ply.ts'
import { plyMotionBetween } from './ply-motion.ts'
import {
  branchShortcutIndex,
  rememberShortcutSetting,
  readShortcutSetting,
  type ShortcutSetting,
} from './shortcuts.ts'
import { branchChoices, plyLabel, type BranchChoice } from './tree-path.ts'
import { addressKey, addressSearch, rootAddress, walkEntry, type Address } from './walk.ts'

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
  /**
   * How far into the defining line the URL asked for, or null for "at or past the gambit
   * root" — which is every URL published before `?prelude=` existed (#70, AC 3).
   */
  readonly prelude: number | null
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

export const LearningSurface = ({ entry, requested, prelude }: LearningSurfaceProps) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const translated = useTranslated()
  const labels = useBoardLabels()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [shortcuts, setShortcuts] = useState<ShortcutSetting>(readShortcutSetting)

  const locale = isLocale(i18n.language) ? i18n.language : defaultLocale

  /**
   * One walk, from the initial position through the defining line and into the tree (#70).
   *
   * The two halves are still two halves — `walk.ts` joins `tree-path.ts` rather than
   * replacing it — and everything below reads the join instead of the tree, so next and
   * previous cross it without this component knowing where it is.
   */
  const walk = useMemo(() => walkEntry(entry, prelude, requested), [entry, prelude, requested])
  const { node, next, previous, inPrelude } = walk
  const { path, strayedAt } = walk.resolved

  /**
   * The continuations that are rendered as choices — and therefore, exactly, the ones the
   * `1`-`9` keys reach.
   *
   * One list rather than two. A key cap drawn on a control that no key reaches, or a key
   * that moves the page with nothing on screen to say so, are the same defect from opposite
   * ends, and the only way to be sure neither happens is for the render and the keyboard to
   * read the same array.
   *
   * Which is why a learner node with a *single* prescribed move offers nothing here: that
   * move is `next`, it is not a choice, and `PlanChoices` would be announcing a decision
   * the gambit is not asking the learner to make. An opponent node with a single modelled
   * reply does offer it, because there the reply's quality, frequency and provenance are
   * the point even when there is only one of them (docs/CONTEXT.md, *The central
   * asymmetry*).
   */
  const choices = useMemo(() => {
    if (node === null) return []
    const ahead = branchChoices(node, path)
    return node.kind === 'opponent' || ahead.length > 1 ? ahead : []
  }, [node, path])

  const go = useCallback(
    (target: Address | null): void => {
      if (target === null) return
      void navigate({ pathname, search: addressSearch(target) })
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
    previous: Address | null
    next: Address | null
    choices: readonly BranchChoice[]
  }>({ previous, next, choices })

  useLayoutEffect(() => {
    targets.current = { previous, next, choices }
  })

  /**
   * Registered in a layout effect, in the same commit as the DOM it acts on.
   *
   * A passive effect would attach the listener in a later task, so between the position
   * appearing on screen and the keyboard becoming live there is a window in which a press
   * is silently dropped. That window is normally sub-frame and was never noticed — until
   * #9 put twelve preview boards at a branch point, which is a long enough commit that a
   * key pressed the instant the page appears lands before anything is listening. A learner
   * cannot type that fast, but the gap is real and it is the same reasoning `targets` above
   * is written for: what the keyboard does and what is on the screen are one commit, or
   * they are two things that disagree under load.
   */
  useLayoutEffect(() => {
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

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        go(event.key === 'ArrowLeft' ? targets.current.previous : targets.current.next)
        return
      }

      /*
       * AC 6. `1`-`9` select the first nine branches, and only where there is a branch to
       * select: a digit pressed at a node with one continuation must not become a second
       * "next", or the key would mean two different things depending on where the learner
       * happens to be standing. Past the ninth there is no key, by design — the rest are
       * reached by tab and by click, and `ChoiceLink` prints a key cap only where one
       * works, so nothing on screen promises a shortcut that does not exist.
       */
      const index = branchShortcutIndex(event.key)
      if (index === null) return
      const choice = targets.current.choices[index]
      if (choice === undefined) return

      event.preventDefault()
      go({ at: 'line', path: choice.path })
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
  const pathKey = addressKey(walk.here)
  const previousKey = useRef<string | null>(null)
  useEffect(() => {
    if (previousKey.current !== null && previousKey.current !== pathKey) headingRef.current?.focus()
    previousKey.current = pathKey
  }, [pathKey])

  /**
   * The ply that produced the position on screen, as two squares for `Board` to mark.
   *
   * Read between this node and the one before it rather than out of the node itself,
   * because a `CompiledNode` carries SAN and a FEN and SAN names no origin square
   * (`last-ply.ts` says why the pair is derived here rather than shipped on the wire).
   *
   * **The root is deliberately unmarked.** It is the position after the defining line —
   * where the learner arrives, not somewhere they stepped to — so there is no "what just
   * changed" for a highlight to answer, and marking the last ply of a line the page never
   * showed would point at a move the learner has not been told about.
   */
  const lastMove =
    walk.previousFen === null ? undefined : lastPlyBetween(walk.previousFen, walk.fen)

  /**
   * The same ply again, as every piece it moved and every piece it took, for the board to
   * animate (#72). Read from the same two positions and for the same reason the pair above
   * is, and separately from it because the two answers differ where it matters: at a castle
   * the highlight names the king's two squares by convention, and the animation has to move
   * the rook as well.
   *
   * **Stepping back animates without being told it is stepping back.** This is always the
   * ply that *reached* the position on screen, never the direction the learner travelled —
   * and it does not need to be. The piece that returns to its origin kept the key it was
   * given when it left, so React keeps the element and the board reads the move backwards
   * on its own. Nothing here knows which way the press went, which is why the two controls,
   * the arrow keys, the move list and browser back all behave the same.
   */
  const motion = useMemo(
    () => (walk.previousFen === null ? undefined : plyMotionBetween(walk.previousFen, walk.fen)),
    [walk.previousFen, walk.fen],
  )

  /**
   * Prose for the position. Inside the defining line there is no node and therefore no
   * annotation to localise — the plies that reach a gambit are the gambit's address, not its
   * lesson — so the panel says which half of the walk the learner is in rather than showing
   * the "no explanation yet" state, which here would be a complaint about content that is
   * not missing.
   */
  const prose =
    node === null || node.annotation === undefined
      ? null
      : localiseAnnotation(node.annotation, locale)
  const label = walk.ply === null ? null : plyLabel(walk.ply, walk.fen)
  const dismissed = node?.dismissed ?? []
  const announcement =
    walk.ply === null
      ? ''
      : announcementOf(walk.ply, {
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
            fen={walk.fen}
            labels={labels}
            orientation={entry.side}
            announcement={announcement}
            lastMove={lastMove}
            arrivedFrom={motion?.arrivedFrom}
            captured={motion?.captured}
          />
        </div>
        <MoveNavigator
          start={walk.atStart ? null : walk.start}
          root={walk.atRoot ? null : rootAddress}
          previous={previous}
          next={next}
        />
      </div>

      <div className="learning-surface__context">
        {/*
         * Inside the defining line the empty state says which half of the walk the learner
         * is in, rather than "no explanation yet". These plies reach the gambit; they are
         * its address rather than its lesson, and no annotation is coming for them — so the
         * ordinary empty state would be a promise the content pipeline will never keep.
         */}
        <AnnotationPanel
          label={label}
          prose={prose}
          empty={inPrelude ? 'learn.preludePly' : 'learn.noAnnotation'}
          headingRef={headingRef}
        />

        {/*
         * The answer to "what if my opponent plays something else?" (requirement F5).
         *
         * It sits below the annotation and outside the stage above, so it never competes
         * with the rule that keeps the board and the navigator on screen together — a
         * learner who has read the position scrolls to the replies, and a learner who has
         * not is not made to scroll past them first.
         *
         * An opponent node renders `BranchChoices` whenever it has anything to say, which
         * includes having *nothing modelled* but a catch-all: `dismissRest` is an answer to
         * every reply left over, and a node with one modelled child and thirty-four covered
         * by a catch-all is the ordinary case, not an edge one.
         */}
        {node !== null &&
          node.kind === 'opponent' &&
          (choices.length > 0 || dismissed.length > 0 || node.dismissRest !== undefined) && (
            <BranchChoices
              choices={choices}
              fen={node.fen}
              dismissed={dismissed}
              dismissRest={node.dismissRest}
              orientation={entry.side}
              locale={locale}
              judgement={entry.judgement}
              shortcuts={shortcuts}
            />
          )}

        {node !== null && node.kind === 'learner' && choices.length > 1 && (
          <PlanChoices
            choices={choices}
            fen={node.fen}
            orientation={entry.side}
            shortcuts={shortcuts}
          />
        )}

        {/*
         * What this line ends in (#11), between the choices and the move list — the slot #9
         * left, filled by a condition and a component and nothing else.
         *
         * `OutcomeCard` renders no element of its own: it switches to `MateOutcome`,
         * `AssessmentOutcome` or `UnexploredOutcome`, which share no shell. A proved forced
         * mate and an author's judgement are different kinds of claim, and a panel that drew
         * them as one thing in two colours would make the opinion look proved rather than
         * making the proof mean anything (docs/CONTEXT.md, *Provenance*).
         *
         * The position goes down with it because the mate arm plays its proved line *from*
         * this leaf, and `MateNet` anchors the SAN list against one board: the wire carries
         * the longest line of the net and never the net itself, so that is the only board
         * there is to draw.
         */}
        {node?.outcome !== undefined && (
          <OutcomeCard
            outcome={node.outcome}
            fen={node.fen}
            orientation={entry.side}
            locale={locale}
          />
        )}

        <MoveList steps={walk.steps} start={walk.start} />
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

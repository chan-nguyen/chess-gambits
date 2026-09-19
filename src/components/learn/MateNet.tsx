import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import './MateNet.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { Orientation } from '../board/board-model.ts'
import { BoardPreview } from './BoardPreview.tsx'
import { lastPlyBetween } from './last-ply.ts'
import { numberSequence } from './mate-sequence.ts'

/**
 * The refutation, as **one** board a reader can step to its real end, and a list of SAN
 * (docs/design-system.md §3, issue #121).
 *
 * Never one preview per reply. A defender node inside a net can have twenty-four legal
 * replies and twenty-four board instances on a 360px phone is not a design — which is why
 * `branchChoices` already refuses to turn a node carrying a mate into preview boards, one
 * check covering every caller.
 *
 * **What is actually on the wire, and what this therefore renders.** The net itself does
 * not reach the browser. A certificate holds every defender reply at every depth, it is
 * verified by replay in CI, and it stays a build input (ADR-0005) — a mate in 4 is tens of
 * thousands of nodes and shipping one would spend the whole bundle budget on a single leaf.
 * What the compiled leaf carries is `sequence`: the **longest** line in that net, the mate
 * as it goes when the defender holds out longest — and, since #121, `sequenceFens`: the FEN
 * after each of those plies, computed at build time the same way `prelude` is. So that is
 * what is drawn, and the sentence above it says exactly that rather than implying the list
 * is the net. Inventing the other branches from the one line the wire carries would be
 * fabricating a proof on a page whose only claim to attention is that it does not.
 *
 * The one thing the shape of the proof does change here is the wording. `provedBy: 'search'`
 * means the certificate had no defender node at all — the attacker mates at once and there
 * was nothing to enumerate — so calling that line "the longest defence" would describe a
 * choice the defender never had.
 *
 * **Stepping is local state, not the URL.** The main board's position is the one thing
 * `?line=` names (docs/CONTEXT.md), and this board plays a line *from* a leaf the URL
 * already identifies — a second `?line=`-shaped parameter naming a position inside a
 * position would make two things the single source of truth. So `step` lives in this
 * component the same way the old frozen preview's FEN always did; a learner cannot link
 * straight to "two plies into the mate", only to the leaf, which is unchanged from today.
 *
 * The board is the anchor the list is read against, and it earns its place on the surface
 * that already shows this position: on a phone the mate card is below the annotation and the
 * replies, and by the time `7.Bxf7+ 7...Ke7 8.Nd5#` is on screen the main board is not.
 */
export type MateNetProps = {
  /** The leaf's position — the one the proved line is played from. */
  readonly fen: string
  /** The longest line in the net, in plies from `fen`. */
  readonly sequence: readonly string[]
  /** The FEN after each ply of `sequence`, same length and same order. */
  readonly sequenceFens: readonly string[]
  /** Which half of ADR-0005's proof carried "mate within N". */
  readonly provedBy: 'search' | 'modelled-net'
  /** The learner's side at the bottom, as on the main board. */
  readonly orientation: Orientation
}

/** A press aimed at the browser rather than at this control. */
const isNavigationKey = (event: KeyboardEvent): boolean =>
  !event.defaultPrevented &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey &&
  (event.key === 'ArrowLeft' || event.key === 'ArrowRight')

export const MateNet = ({ fen, sequence, sequenceFens, provedBy, orientation }: MateNetProps) => {
  const listId = useId()
  const plies = numberSequence(fen, sequence)

  /**
   * `0` is the leaf itself, before any of `sequence` has been played. `n` (`1 <= n <=
   * sequence.length`) is the position after `sequence[n - 1]`, i.e. `sequenceFens[n - 1]`.
   * Reset by the `key={fen}` `MateOutcome` mounts this under — a learner who follows a link
   * from one mate leaf to another gets a fresh board, never the previous leaf's last step.
   */
  const [step, setStep] = useState(0)
  const atEnd = step === sequence.length

  const stepTo = (target: number): void => setStep(Math.min(Math.max(target, 0), sequence.length))

  /**
   * `ArrowLeft`/`ArrowRight` step this board exactly the way they step the page's own
   * position (`LearningSurface`'s `belongsToSomethingElse`) — but only while focus is inside
   * this control, and `stopPropagation` is how that stays true. Without it a press here would
   * also reach `LearningSurface`'s `window` listener and move the *main* board at the same
   * time, which is two positions changing from one key.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isNavigationKey(event)) return
    event.preventDefault()
    event.stopPropagation()
    stepTo(step + (event.key === 'ArrowRight' ? 1 : -1))
  }

  const boardFen = step === 0 ? fen : (sequenceFens[step - 1] ?? fen)
  const lastMove =
    step === 0
      ? undefined
      : lastPlyBetween(step === 1 ? fen : (sequenceFens[step - 2] ?? fen), boardFen)

  return (
    <div className="mate-net" onKeyDown={onKeyDown}>
      <p className="mate-net__note" id={listId}>
        <Translated id={provedBy === 'search' ? 'outcome.netImmediate' : 'outcome.netModelled'} />
      </p>

      <div className="mate-net__figure">
        {/*
         * Every other board on the site answers "what produced the position you are
         * looking at", and since #121 this one does too, once the reader has pressed next
         * at least once: `lastMove` marks the ply that reached the frame on screen, same as
         * the main board. At `step === 0` there is nothing yet to mark — this is the leaf
         * the URL already names, not a position the reader stepped to.
         */}
        <BoardPreview fen={boardFen} orientation={orientation} lastMove={lastMove} />

        {/*
         * An ordered list, because the order is the whole content: these plies are only a
         * refutation in this sequence. Keyed by index rather than by SAN — a line may
         * repeat a move, and a duplicate key would drop one of them. Each entry is also a
         * button that jumps the board straight to it, `aria-current` naming the one on
         * screen — a second way to the same place the previous/next controls reach one ply
         * at a time.
         */}
        <ol className="mate-net__plies" aria-describedby={listId}>
          {plies.map((numbered, index) => (
            <li className="mate-net__ply" key={`${index}-${numbered.ply}`}>
              <button
                type="button"
                className="mate-net__ply-button"
                aria-current={step === index + 1 ? 'step' : undefined}
                onClick={() => stepTo(index + 1)}
              >
                {numbered.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/*
       * Buttons, not `MoveNavigator`'s links: that control's whole reason to be links is
       * that every position on this page is a URL (§4), and `step` deliberately is not one
       * (see the type doc above). Disabled rather than `aria-disabled`, unlike
       * `MoveNavigator` — a native `disabled` button is exactly the right control when
       * there is no address for a screen reader to still offer, which a link at an edge
       * would misleadingly imply.
       */}
      <div className="mate-net__controls">
        <button
          type="button"
          className="mate-net__control"
          onClick={() => stepTo(step - 1)}
          disabled={step === 0}
        >
          <Translated id="outcome.stepPrevious" />
        </button>
        <button
          type="button"
          className="mate-net__control mate-net__control--next"
          onClick={() => stepTo(step + 1)}
          disabled={atEnd}
        >
          <Translated id="outcome.stepNext" />
        </button>
      </div>

      {/*
       * The accessible flag the final frame needs (#121). `role="status"` rather than a
       * plain paragraph so a screen reader announces it the moment `next` reaches it,
       * exactly once — not on every frame, which `atEnd` guarding the whole element is what
       * ensures.
       */}
      {atEnd && (
        <p className="mate-net__checkmate" role="status">
          <Translated id="outcome.mateReached" />
        </p>
      )}
    </div>
  )
}

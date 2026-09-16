import { useId } from 'react'
import './MateNet.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { Orientation } from '../board/board-model.ts'
import { BoardPreview } from './BoardPreview.tsx'
import { numberSequence } from './mate-sequence.ts'

/**
 * The refutation, as **one** board and a list of SAN (docs/design-system.md §3).
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
 * as it goes when the defender holds out longest. So that is what is drawn, and the sentence
 * above it says exactly that rather than implying the list is the net. Inventing the other
 * branches from the one line the wire carries would be fabricating a proof on a page whose
 * only claim to attention is that it does not.
 *
 * The one thing the shape of the proof does change here is the wording. `provedBy: 'search'`
 * means the certificate had no defender node at all — the attacker mates at once and there
 * was nothing to enumerate — so calling that line "the longest defence" would describe a
 * choice the defender never had.
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
  /** Which half of ADR-0005's proof carried "mate within N". */
  readonly provedBy: 'search' | 'modelled-net'
  /** The learner's side at the bottom, as on the main board. */
  readonly orientation: Orientation
}

export const MateNet = ({ fen, sequence, provedBy, orientation }: MateNetProps) => {
  const listId = useId()
  const plies = numberSequence(fen, sequence)

  return (
    <div className="mate-net">
      <p className="mate-net__note" id={listId}>
        <Translated id={provedBy === 'search' ? 'outcome.netImmediate' : 'outcome.netModelled'} />
      </p>

      <div className="mate-net__figure">
        <BoardPreview fen={fen} orientation={orientation} />

        {/*
         * An ordered list, because the order is the whole content: these plies are only a
         * refutation in this sequence. Keyed by index rather than by SAN — a line may
         * repeat a move, and a duplicate key would drop one of them.
         */}
        <ol className="mate-net__plies" aria-describedby={listId}>
          {plies.map((numbered, index) => (
            <li className="mate-net__ply" key={`${index}-${numbered.ply}`}>
              {numbered.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

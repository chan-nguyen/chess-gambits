import { Link, useLocation } from 'react-router'
import './MateNet.css'
import { Translated } from '../../i18n/Translated.tsx'
import { addressSearch } from './walk.ts'
import { numberSequence } from './mate-sequence.ts'

/**
 * The refutation, as a list of SAN, each ply a real link into the sequence
 * (docs/design-system.md §3, issue #121, revised by #123).
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
 * **Stepping is the URL, and this list is a row of links into it, same as `MoveList`.** This
 * used to be local `step` state with its own previous/next buttons, on the reasoning that
 * `?line=` already names one position and a second parameter naming a position inside it
 * would make two things the single source of truth. #123 is what removes that reasoning: a
 * mate-sequence position is "a FEN with no tree node" exactly the way a prelude position is
 * (`walk.ts`'s module doc, `docs/CONTEXT.md` *Prelude*), and it gets the same treatment — its
 * own `Address` variant and its own parameter (`src/lib/mate-step.ts`), joined into the real
 * `next`/`previous` the main board already presses. There is no board here any more, either:
 * the main board *is* the anchor now, since pressing next moves it through the sequence in
 * place, and a second board that only ever repeated what the main one was about to show would
 * be the thing #123 was filed to remove.
 */
export type MateNetProps = {
  /** The leaf's position — the one the proved line is played from, for numbering only. */
  readonly fen: string
  /** The leaf's own `line` path, so each ply can link to its own `mate` address. */
  readonly leaf: readonly string[]
  /** The longest line in the net, in plies from `fen`. */
  readonly sequence: readonly string[]
  /** Which half of ADR-0005's proof carried "mate within N". */
  readonly provedBy: 'search' | 'modelled-net'
  /** How many plies of `sequence` the walk has played: 0 at the leaf's own `line` address. */
  readonly step: number
}

export const MateNet = ({ fen, leaf, sequence, provedBy, step }: MateNetProps) => {
  const { pathname } = useLocation()
  const plies = numberSequence(fen, sequence)

  return (
    <div className="mate-net">
      <p className="mate-net__note">
        <Translated id={provedBy === 'search' ? 'outcome.netImmediate' : 'outcome.netModelled'} />
      </p>

      {/*
       * An ordered list, because the order is the whole content: these plies are only a
       * refutation in this sequence. Keyed by index rather than by SAN — a line may repeat a
       * move, and a duplicate key would drop one of them. Each entry is a real link to its own
       * `mate` address (§4: every position is a URL), `aria-current` naming the one on screen
       * — the same pattern `MoveList` already uses for the tree half of the walk.
       */}
      <ol className="mate-net__plies">
        {plies.map((numbered, index) => (
          <li className="mate-net__ply" key={`${index}-${numbered.ply}`}>
            <Link
              className="mate-net__ply-link"
              aria-current={step === index + 1 ? 'step' : undefined}
              to={{ pathname, search: addressSearch({ at: 'mate', leaf, ply: index + 1 }) }}
            >
              {numbered.label}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

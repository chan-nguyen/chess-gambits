import './FlipButton.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'

/**
 * Turn the board round (F2): the gambit page's and the analysis page's control.
 *
 * A button rather than a link like the navigation beside it: it toggles a view of this
 * position rather than going to another one, and `aria-pressed` says which way round the
 * board is, which a link cannot. An icon, with its label read but not drawn — FlipButton.css
 * says why that was measured rather than assumed.
 */
export type FlipButtonProps = {
  readonly flipped: boolean
  readonly onFlip: () => void
}

export const FlipButton = ({ flipped, onFlip }: FlipButtonProps) => {
  const translated = useTranslated()
  return (
    <button
      type="button"
      className="flip-button"
      aria-pressed={flipped}
      title={translated('board.flip').text}
      onClick={onFlip}
    >
      <svg className="flip-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" />
      </svg>
      <span className="visually-hidden">
        <Translated id="board.flip" />
      </span>
    </button>
  )
}

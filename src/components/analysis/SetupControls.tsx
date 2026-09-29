import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import './SetupControls.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { FlipButton } from '../learn/FlipButton.tsx'
import {
  canCastle,
  castlingRights,
  maxPiecesPerSide,
  readSetup,
  setupFen,
  setupProblem,
  startingFen,
  withCastling,
  withTurn,
  type CastlingRight,
  type Setup,
  type SetupProblem,
} from './setup-position.ts'

/**
 * Everything about the position being set up that is not where its pieces stand: whose move
 * it is, who may still castle, the FEN, and whether it can be analysed yet.
 *
 * **Analyse is never disabled, only unavailable** (`aria-disabled`, and the sentence that
 * says why beside it), for the reason `LineControls` gives at the edge of a line: a disabled
 * button is out of the tab order, so the one thing a keyboard user most needs to reach — why
 * it will not go — is the thing they could not find.
 */
export type SetupControlsProps = {
  readonly setup: Setup
  readonly flipped: boolean
  readonly onChange: (fen: string) => void
  readonly onFlip: () => void
  readonly onAnalyse: (fen: string) => void
  /** Where Cancel goes: the analysis page as it was before the editor opened. */
  readonly cancel: string
}

const CASTLING_LABELS: Readonly<Record<CastlingRight, TranslationKey>> = {
  K: 'analysis.setupWhiteShort',
  Q: 'analysis.setupWhiteLong',
  k: 'analysis.setupBlackShort',
  q: 'analysis.setupBlackLong',
}

const PROBLEMS: Readonly<Record<SetupProblem, TranslationKey>> = {
  'white-king': 'analysis.setupWhiteKing',
  'black-king': 'analysis.setupBlackKing',
  'pawn-on-edge': 'analysis.setupPawnOnEdge',
  'too-many-pieces': 'analysis.setupTooManyPieces',
  'opponent-in-check': 'analysis.setupOpponentInCheck',
  invalid: 'analysis.setupInvalid',
}

export const SetupControls = ({
  setup,
  flipped,
  onChange,
  onFlip,
  onAnalyse,
  cancel,
}: SetupControlsProps) => {
  const { pathname } = useLocation()
  const turnName = useId()
  const fenId = useId()
  const fenHintId = useId()
  const verdictId = useId()
  const fen = setupFen(setup)
  const problem = setupProblem(setup)
  const change = (next: Setup) => onChange(setupFen(next))

  /*
   * What is typed in the FEN field is kept as typed while it cannot be read, and while it
   * reads as the position on the board. Only a change that came from somewhere else — the
   * board, a checkbox, a reset — rewrites it, so typing a FEN out by hand is never
   * interrupted by the board reformatting it halfway through.
   */
  const [draft, setDraft] = useState(fen)
  const [draftFor, setDraftFor] = useState(fen)
  if (draftFor !== fen) {
    setDraftFor(fen)
    const typed = readSetup(draft)
    if (typed === null || setupFen(typed) !== fen) setDraft(fen)
  }
  const typed = readSetup(draft)

  const type = (text: string): void => {
    setDraft(text)
    const read = readSetup(text)
    if (read === null) return
    setDraftFor(setupFen(read))
    onChange(setupFen(read))
  }

  return (
    <div className="setup-controls">
      <fieldset className="setup-controls__group">
        <legend>
          <Translated id="analysis.setupTurn" />
        </legend>
        {(['white', 'black'] as const).map((turn) => (
          <label key={turn} className="setup-controls__choice">
            <input
              type="radio"
              name={turnName}
              checked={setup.turn === turn}
              onChange={() => change(withTurn(setup, turn))}
            />
            <Translated
              id={turn === 'white' ? 'analysis.setupWhiteToMove' : 'analysis.setupBlackToMove'}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="setup-controls__group">
        <legend>
          <Translated id="analysis.setupCastling" />
        </legend>
        <p className="setup-controls__hint">
          <Translated id="analysis.setupCastlingHint" />
        </p>
        {castlingRights.map((right) => {
          const possible = canCastle(setup.placement, right)
          return (
            <label key={right} className="setup-controls__choice">
              <input
                type="checkbox"
                checked={possible && setup.castling.has(right)}
                disabled={!possible}
                onChange={(event) => change(withCastling(setup, right, event.target.checked))}
              />
              <Translated id={CASTLING_LABELS[right]} />
            </label>
          )
        })}
      </fieldset>

      <div className="setup-controls__row">
        <button
          type="button"
          className="setup-controls__button"
          onClick={() => onChange(startingFen)}
        >
          <Translated id="analysis.setupStart" />
        </button>
        <button
          type="button"
          className="setup-controls__button"
          onClick={() => change({ ...setup, placement: new Map(), enPassant: null })}
        >
          <Translated id="analysis.setupClear" />
        </button>
        <FlipButton flipped={flipped} onFlip={onFlip} />
      </div>

      <div className="setup-controls__fen">
        <label htmlFor={fenId}>
          <Translated id="analysis.setupFen" />
        </label>
        <p className="setup-controls__hint" id={fenHintId}>
          <Translated id="analysis.setupFenHint" />
        </p>
        <input
          id={fenId}
          type="text"
          className="setup-controls__fen-input"
          aria-describedby={fenHintId}
          spellCheck={false}
          autoComplete="off"
          value={draft}
          onChange={(event) => type(event.target.value)}
        />
        <p className="setup-controls__problem" role="status">
          {typed === null && <Translated id="analysis.setupFenUnreadable" />}
        </p>
      </div>

      <p
        className={`setup-controls__verdict${problem === null ? '' : ' setup-controls__verdict--problem'}`}
        id={verdictId}
        role="status"
      >
        {problem === null ? (
          <Translated id="analysis.setupReady" />
        ) : (
          <Translated id={PROBLEMS[problem]} values={{ count: maxPiecesPerSide }} />
        )}
      </p>

      <div className="setup-controls__row">
        <button
          type="button"
          className="setup-controls__button setup-controls__button--primary"
          aria-disabled={problem !== null}
          aria-describedby={verdictId}
          onClick={() => {
            if (problem === null) onAnalyse(fen)
          }}
        >
          <Translated id="analysis.setupAnalyse" />
        </button>
        <Link
          className="setup-controls__button"
          to={{ pathname, search: cancel }}
          preventScrollReset
        >
          <Translated id="analysis.setupCancel" />
        </Link>
      </div>
    </div>
  )
}

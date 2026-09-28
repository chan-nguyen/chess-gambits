import { useId, useState } from 'react'
import './PgnImport.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { importPgn, type PgnProblem } from './analysis-line.ts'

/**
 * Paste a game and open it (#154). No `<form>`: the CSP says `form-action 'none'`, because
 * the site submits nothing anywhere, and this does not either — the moves go into the URL.
 *
 * A refusal is said in words and leaves the paste where it was, so the visitor can fix it.
 * The status line exists before there is anything in it, so a screen reader is already
 * listening when the first refusal arrives.
 */
export type PgnImportProps = {
  readonly onLoad: (moves: readonly string[]) => void
}

const PROBLEMS: Readonly<Record<PgnProblem, TranslationKey>> = {
  empty: 'analysis.pgnEmpty',
  invalid: 'analysis.pgnInvalid',
  'custom-start': 'analysis.pgnCustomStart',
  'too-long': 'analysis.pgnTooLong',
}

export const PgnImport = ({ onLoad }: PgnImportProps) => {
  const inputId = useId()
  const hintId = useId()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<PgnProblem | null>(null)

  const load = (): void => {
    const imported = importPgn(text)
    if (!imported.ok) {
      setProblem(imported.problem)
      return
    }
    setProblem(null)
    onLoad(imported.moves)
  }

  return (
    <div className="pgn-import">
      <label className="pgn-import__label" htmlFor={inputId}>
        <Translated id="analysis.pgnLabel" />
      </label>
      <p className="pgn-import__hint" id={hintId}>
        <Translated id="analysis.pgnHint" />
      </p>
      <textarea
        className="pgn-import__input"
        id={inputId}
        aria-describedby={hintId}
        rows={4}
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="pgn-import__actions">
        <button type="button" onClick={load}>
          <Translated id="analysis.pgnLoad" />
        </button>
      </p>
      <p className="pgn-import__problem" role="status">
        {problem !== null && <Translated id={PROBLEMS[problem]} />}
      </p>
    </div>
  )
}

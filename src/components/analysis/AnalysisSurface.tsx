import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import './AnalysisSurface.css'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { Translated } from '../../i18n/Translated.tsx'
import { flipParam, orient, parseFlip, withFlip } from '../../lib/flip.ts'
import { HomeBoard } from '../home/HomeBoard.tsx'
import { checkedKingSquare, gameEnd, replay } from '../home/chess-engine.ts'
import { movesParam } from '../home/moves-param.ts'
import { plyMotionBetween } from '../learn/ply-motion.ts'
import { ShortcutToggle } from '../learn/ShortcutToggle.tsx'
import {
  belongsToSomethingElse,
  readShortcutSetting,
  rememberShortcutSetting,
  type ShortcutSetting,
} from '../learn/shortcuts.ts'
import { AnalysisMoveList } from './AnalysisMoveList.tsx'
import { EnginePanel } from './EnginePanel.tsx'
import { EvalBar } from './EvalBar.tsx'
import { LineControls } from './LineControls.tsx'
import { PgnImport } from './PgnImport.tsx'
import { PositionSetup } from './PositionSetup.tsx'
import {
  analysisSearch,
  parseLine,
  parsePly,
  playAt,
  plyParam,
  setupParam,
  startParam,
  withSetup,
  type LinePosition,
} from './analysis-line.ts'
import { bestMoveArrow, whiteShare, type EvaluationSource } from './evaluation.ts'
import { readStart } from './setup-position.ts'
import { useAnalysis } from './use-analysis.ts'

/**
 * The analysis page (#154): a board anyone can play on, and what Stockfish thinks of it.
 *
 * **The URL is the whole state** (`analysis-line.ts`): the position the line starts from, the
 * line, how far into it the board stands, which way round — and, while it is open, the board
 * in the position editor, which takes the page's place until it is analysed or cancelled.
 * Everything below is derived from it on every render, the way `OpeningExplorer` derives the
 * home board, so the back button, a bookmark and a pasted link all land on exactly what was
 * on screen.
 *
 * The engine is a prop, not an import: the route passes the Stockfish worker, and the tests
 * pass a fake that answers at once (ADR-0010's seam, as amended by ADR-0012).
 */
export type AnalysisSurfaceProps = {
  readonly source: EvaluationSource
}

export const AnalysisSurface = ({ source }: AnalysisSurfaceProps) => {
  const [searchParams] = useSearchParams()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const translated = useTranslated()
  const [shortcuts, setShortcuts] = useState<ShortcutSetting>(readShortcutSetting)

  const start = useMemo(() => readStart(searchParams.get(startParam)), [searchParams])
  const requested = useMemo(() => parseLine(searchParams.get(movesParam)), [searchParams])
  const line = useMemo(() => replay(requested, start ?? undefined).plies, [requested, start])
  const ply = parsePly(searchParams.get(plyParam), line.length)
  const flipped = parseFlip(searchParams.get(flipParam))
  const editing = searchParams.get(setupParam)
  const position: LinePosition = useMemo(() => ({ start, line, ply }), [start, line, ply])

  const here = useMemo(() => replay(line.slice(0, ply), start ?? undefined), [line, ply, start])
  const fen = here.chess.fen()
  const check = useMemo(() => checkedKingSquare(here.chess) ?? undefined, [here])
  const ended = useMemo(() => gameEnd(here.chess), [here])
  // The ply that produced this position, for the pieces to slide (#72), stepping back as well as
  // forward, exactly as on the gambit page (`LearningSurface`). None at the start of a line.
  const motion = useMemo(() => {
    const before = here.chess.history({ verbose: true }).at(-1)?.before
    return before === undefined ? undefined : plyMotionBetween(before, here.chess.fen())
  }, [here])

  // Nothing is analysed while the editor has the page: its board is not a position yet.
  const analysis = useAnalysis(source, ended === null && editing === null ? fen : null)
  const evaluation = analysis.status === 'thinking' ? analysis.evaluation : null
  const best = evaluation?.lines[0]
  const arrow = bestMoveArrow(evaluation)
  // A finished game is the rules engine's answer, not Stockfish's: mate fills the bar for
  // whoever gave it, and any draw leaves it level.
  const share =
    ended === 'checkmate'
      ? here.chess.turn() === 'w'
        ? 0
        : 1
      : ended !== null
        ? 0.5
        : best === undefined
          ? null
          : whiteShare(best)

  const go = (next: LinePosition, nextFlipped = flipped): void => {
    void navigate(
      { pathname, search: analysisSearch(next, nextFlipped) },
      { preventScrollReset: true },
    )
  }
  const play = (san: string): void => go(playAt(position, san))
  const flip = (): void => go(position, !flipped)

  /** The ply that produced this position, spoken by the board's own live region. */
  const announcement = useMemo(() => {
    if (here.lastMove === null) return undefined
    const played = translated('home.movePlayed', { san: here.lastMove.san }).text
    if (ended === null) return played
    const outcome = translated(
      ended === 'checkmate'
        ? 'home.checkmate'
        : ended === 'stalemate'
          ? 'home.stalemate'
          : 'home.draw',
    ).text
    return `${played} ${outcome}`
  }, [here, ended, translated])

  /*
   * ← and → step through the line, and f flips, under the same switch and with the same
   * exclusions as the gambit page (`shortcuts.ts`). The listener reads where the keys go from
   * a ref kept in step with the committed render, for the reason `LearningSurface` gives:
   * a listener that closed over one render's targets would step from a position that is no
   * longer the one on screen.
   */
  const keys = useRef<{ previous: string | null; next: string | null; flip: string }>({
    previous: null,
    next: null,
    flip: '',
  })
  useLayoutEffect(() => {
    keys.current = {
      previous: ply === 0 ? null : analysisSearch({ ...position, ply: ply - 1 }, flipped),
      next: ply === line.length ? null : analysisSearch({ ...position, ply: ply + 1 }, flipped),
      flip: analysisSearch(position, !flipped),
    }
  })

  // The editor's board takes Enter and Space, and its FEN field takes letters: no page keys.
  const keysOn = shortcuts === 'on' && editing === null
  useLayoutEffect(() => {
    if (!keysOn) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.shiftKey || belongsToSomethingElse(event.target)) return
      const { previous, next, flip: flipTo } = keys.current
      const target =
        event.key === 'ArrowLeft'
          ? { search: previous }
          : event.key === 'ArrowRight'
            ? { search: next }
            : event.key === 'f'
              ? { search: flipTo }
              : null
      if (target === null) return
      event.preventDefault()
      // At an edge the press is taken and goes nowhere, rather than wrapping round.
      if (target.search !== null)
        void navigate({ pathname, search: target.search }, { preventScrollReset: true })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keysOn, navigate, pathname])

  const orientation = orient('white', flipped)

  if (editing !== null) {
    return (
      <PositionSetup
        fen={editing}
        flipped={flipped}
        orientation={orientation}
        onChange={(next) =>
          void navigate(
            { pathname, search: withSetup(search, next) },
            { replace: true, preventScrollReset: true },
          )
        }
        onFlip={(board) =>
          void navigate(
            { pathname, search: withFlip(withSetup(search, board), !flipped) },
            { preventScrollReset: true },
          )
        }
        onAnalyse={(analysed) => go({ start: readStart(analysed), line: [], ply: 0 })}
        cancel={withSetup(search, null)}
      />
    )
  }

  return (
    <div className="analysis-surface">
      <div className="analysis-surface__stage">
        <div className="analysis-surface__board-row">
          <EvalBar share={share} orientation={orientation} />
          <div className="analysis-surface__board">
            <HomeBoard
              chess={here.chess}
              lastMove={
                here.lastMove === null
                  ? undefined
                  : { from: here.lastMove.from, to: here.lastMove.to }
              }
              check={check}
              ended={ended}
              announcement={announcement}
              orientation={orientation}
              arrows={arrow === null ? undefined : [arrow]}
              motion={motion}
              onCommit={play}
            />
          </div>
        </div>
        <LineControls position={position} flipped={flipped} onFlip={flip} />
        <Link
          className="analysis-surface__setup"
          to={{ pathname, search: withSetup(search, fen) }}
          preventScrollReset
        >
          <Translated id="analysis.setupOpen" />
        </Link>
      </div>

      <div className="analysis-surface__side">
        <EnginePanel state={analysis} fen={fen} onPlay={play} />
        <AnalysisMoveList position={position} flipped={flipped} />
        <PgnImport onLoad={(moves) => go({ start: null, line: moves, ply: moves.length })} />
        <ShortcutToggle
          setting={shortcuts}
          hint="analysis.shortcutsHint"
          onChange={(setting) => {
            setShortcuts(setting)
            rememberShortcutSetting(setting)
          }}
        />
      </div>
    </div>
  )
}

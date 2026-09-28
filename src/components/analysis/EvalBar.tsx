import './EvalBar.css'
import type { Orientation } from '../board/board-model.ts'

/**
 * White's share of the position, as a bar beside the board: White's colour grows from
 * White's side of the board, so it reads the same way round as the pieces do.
 *
 * Drawn in SVG geometry rather than a sized element because the CSP allows no `style`
 * attribute (`tools/shells/csp.ts`), and a bar whose height is data would otherwise need one.
 * Decorative: the same figure is the panel's text, which is where a screen reader reads it.
 */
export type EvalBarProps = {
  /** From 0 (Black winning) to 1 (White winning); null while there is nothing to show. */
  readonly share: number | null
  readonly orientation: Orientation
}

export const EvalBar = ({ share, orientation }: EvalBarProps) => {
  const white = share ?? 0.5
  // A wrapper, because the row stretches a box but not an SVG: left to size itself, a
  // 1x1000 viewBox is a thousand times taller than it is wide (EvalBar.css).
  return (
    <div className="eval-bar" aria-hidden="true">
      <svg
        className="eval-bar__canvas"
        viewBox="0 0 1 1000"
        preserveAspectRatio="none"
        focusable="false"
      >
        <rect className="eval-bar__black" x="0" y="0" width="1" height="1000" />
        <rect
          className="eval-bar__white"
          x="0"
          y={orientation === 'white' ? Math.round((1 - white) * 1000) : 0}
          width="1"
          height={Math.round(white * 1000)}
        />
      </svg>
    </div>
  )
}

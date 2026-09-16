import './BoardPreview.css'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import type { Orientation } from '../board/board-model.ts'
import { Board } from '../board/Board.tsx'

/**
 * The small static board on a branch choice (docs/design-system.md §3, acceptance
 * criteria 1 and 9).
 *
 * Same renderer as the main board, no coordinates, and **out of the tab order** — which is
 * the whole reason this wrapper exists rather than a bare `Board`. A `Board` is a
 * `role="grid"` of 64 cells on one tab stop; that is right for the position a learner is
 * studying and wrong for a picture inside a link, where it would put a second tab stop
 * between the learner and the control they are trying to reach, one per reply.
 *
 * `inert` is what removes it, and it removes it properly: the cells stop being focusable
 * rather than being skipped by a handler that something else could route around.
 * `aria-hidden` says the same thing to assistive technology, which needs to hear it for a
 * second reason — the preview repeats what the link already says in SAN, so announcing 64
 * empty squares before "3...fxe5" would bury the answer in the question.
 *
 * The labels are passed through anyway. They cost nothing (`useBoardLabels` is memoised and
 * already mounted for the main board) and a preview that ever stops being `aria-hidden`
 * must not become an unlabelled grid on the same commit.
 */
export type BoardPreviewProps = {
  readonly fen: string
  readonly orientation: Orientation
}

export const BoardPreview = ({ fen, orientation }: BoardPreviewProps) => {
  const labels = useBoardLabels()

  return (
    <div className="board-preview" inert aria-hidden="true">
      <Board fen={fen} labels={labels} orientation={orientation} showCoordinates={false} />
    </div>
  )
}

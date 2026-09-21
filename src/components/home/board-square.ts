import { FILES, RANKS } from '../board/board-model.ts'
import type { FileLetter, RankNumber, Square } from '../board/board-model.ts'

/**
 * Narrowing a plain string into a `Square`, for values that crossed a JSON boundary — the
 * opening tree's `from`, `to` and `check` fields — and therefore arrive as `string`, not as
 * the closed union `Board` expects.
 *
 * `board-model.ts` has no such guard itself: its `Square` values are always constructed
 * from a `FileLetter` and a `RankNumber` it already holds (`squareAt`), never parsed back
 * out of one. This module is a consumer of that model, not a change to it.
 */
const isFileLetter = (value: string | undefined): value is FileLetter =>
  FILES.some((candidate) => candidate === value)

const isRankNumber = (value: string | undefined): value is RankNumber =>
  RANKS.some((candidate) => candidate === value)

export const isSquare = (value: string): value is Square =>
  value.length === 2 && isFileLetter(value[0]) && isRankNumber(value[1])

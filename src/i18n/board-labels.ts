import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardLabels } from '../components/board/board-model.ts'

/**
 * The board's spoken vocabulary in the active locale (`Board` takes it as a prop).
 *
 * Piece *names* are localised because they are what a screen reader says out loud: a
 * Vietnamese learner should hear "mã trắng", not "white knight". Piece *letters* are not,
 * and there is no key here for one — SAN is SAN in all three locales, so `Nf3` reads
 * exactly as every other chess resource writes it (docs/design-system.md §7, ADR-0006).
 *
 * Written out rather than derived from a template literal so that `Record<PieceKey, …>`
 * checks all twelve: adding a piece to the model without adding its name is then a compile
 * error rather than a square a screen reader cannot describe.
 */
export const useBoardLabels = (): BoardLabels => {
  const { t } = useTranslation()

  return useMemo(
    () => ({
      board: t('board.label'),
      emptySquare: t('board.emptySquare'),
      pieces: {
        whiteKing: t('board.whiteKing'),
        whiteQueen: t('board.whiteQueen'),
        whiteRook: t('board.whiteRook'),
        whiteBishop: t('board.whiteBishop'),
        whiteKnight: t('board.whiteKnight'),
        whitePawn: t('board.whitePawn'),
        blackKing: t('board.blackKing'),
        blackQueen: t('board.blackQueen'),
        blackRook: t('board.blackRook'),
        blackBishop: t('board.blackBishop'),
        blackKnight: t('board.blackKnight'),
        blackPawn: t('board.blackPawn'),
      },
    }),
    [t],
  )
}

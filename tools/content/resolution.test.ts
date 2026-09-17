// @vitest-environment node
import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { freeCaptures } from './resolution.ts'

/**
 * `freeCaptures` is half of the stopping rule (docs/CONTEXT.md, invariant 14), and the half a
 * reviewer never sees running. So the cases below are the specification of what "free" means
 * here — including the two places it deliberately disagrees with what a player would say.
 *
 * Positions are built by replaying moves rather than by pasting a FEN, for the reason the rest
 * of the pipeline derives positions instead of storing them: a FEN in a test is a position
 * nobody checked.
 */

const after = (...plies: readonly string[]): string => {
  const chess = new Chess()
  for (const ply of plies) chess.move(ply)
  return chess.fen()
}

describe('a capture nobody can take back', () => {
  it('finds nothing in the starting position, where no capture is legal at all', () => {
    expect(freeCaptures(after())).toStrictEqual([])
  })

  it('finds nothing when every capture can be recaptured', () => {
    // 1.e4 e5 2.Nf3 Nc6: Nxe5 is legal and ...Nxe5 answers it.
    expect(freeCaptures(after('e4', 'e5', 'Nf3', 'Nc6'))).toStrictEqual([])
  })

  it('finds the capture when the defender has no recapture', () => {
    // 1.e4 e5 2.Nf3 Nf6: nothing on the board can retake on e5.
    expect(freeCaptures(after('e4', 'e5', 'Nf3', 'Nf6'))).toStrictEqual(['Nxe5'])
  })

  it('finds every free capture, not merely the first', () => {
    // 1.d4 e5 2.e3: both pawns may take on d4 and the bishop can retake on neither.
    expect(freeCaptures(after('d4', 'e5', 'e3', 'exd4'))).toStrictEqual(['exd4', 'Qxd4'])
  })

  it('is about recapture and not about value, so it reports a capture that loses a piece', () => {
    /*
     * The deliberate false positive, recorded rather than fixed. After
     * 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 Nc6 5.h3 Bh5 6.Nxe5 Nxe5 7.Qxh5, ...Nxc4 takes a bishop
     * that nothing defends — and loses the knight to Qb5+, forking the king and c4. A static
     * exchange evaluation would know that and would be a second, weaker rules engine beside
     * `chess.js`. `unsettled` carries these instead, where a reviewer reads the argument.
     */
    const fen = after(
      'e4',
      'e5',
      'Nf3',
      'd6',
      'Bc4',
      'Bg4',
      'Nc3',
      'Nc6',
      'h3',
      'Bh5',
      'Nxe5',
      'Nxe5',
      'Qxh5',
    )
    expect(freeCaptures(fen)).toStrictEqual(['Nxc4'])

    const punished = new Chess(fen)
    punished.move('Nxc4')
    expect(punished.moves()).toContain('Qb5+')
  })

  it('reports a capture that gives mate, because nobody takes back from a finished game', () => {
    /*
     * Scholar's mate: after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6, Qxf7 is mate. Bxf7+ is listed beside
     * it and belongs there for the same mechanical reason — the queen on h5 covers f7, so
     * `Kxf7` is not legal and there is no recapture.
     */
    expect(freeCaptures(after('e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'))).toStrictEqual([
      'Qxf7#',
      'Bxf7+',
    ])
  })

  it('returns canonical SAN, so a message names the move the way the content files spell it', () => {
    const [only] = freeCaptures(after('e4', 'e5', 'Nf3', 'Nf6'))
    expect(only).toBe('Nxe5')
  })
})

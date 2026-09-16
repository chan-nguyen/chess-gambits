import { describe, expect, it } from 'vitest'
import { proveOffer } from './sacrifice.ts'

/**
 * Issue #36, AC 2. `side` is verified by replaying the line, never asserted.
 *
 * The cases below are the ones that decided the design. Issue #12 tried three heuristics
 * for deriving the sacrificing side and each of them got either the King's Gambit Declined
 * or the Halloween Gambit wrong, so both are here, and so is the reason no heuristic can
 * work: one line, two offers, two different sides.
 */

const KINGS_GAMBIT = ['e4', 'e5', 'f4'] as const
const FALKBEER = ['e4', 'e5', 'f4', 'd5'] as const
const HALLOWEEN = ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Nxe5'] as const
const SMITH_MORRA = ['e4', 'c5', 'd4', 'cxd4', 'c3'] as const
const BRENTANO = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'g5'] as const
const GIUOCO_PIANO = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] as const

describe('proving that a named ply gives material away', () => {
  it('reads White off the King&apos;s Gambit, where the pawn is simply there to be taken', () => {
    expect(proveOffer(KINGS_GAMBIT, 3, 'f4')).toStrictEqual({
      ok: true,
      side: 'white',
      deficit: 1,
    })
  })

  /**
   * The case that killed every heuristic. The Falkbeer line contains White's 2.f4 **and**
   * Black's 2...d5, both provable, and the entry is Black's. Taking the earlier offer, or
   * the larger one, or the first capture, all label this `white` — which would put a
   * learner studying a Black countergambit on the other side of the board.
   */
  it('reads either side off the King&apos;s Gambit Declined, according to which ply is named', () => {
    expect(proveOffer(FALKBEER, 3, 'f4')).toMatchObject({ ok: true, side: 'white' })
    expect(proveOffer(FALKBEER, 4, 'd5')).toMatchObject({ ok: true, side: 'black' })
  })

  /** A capture can be the sacrifice: the Halloween wins a pawn and loses a knight for it. */
  it('counts what the opponent can win back, so a capture that loses material is an offer', () => {
    expect(proveOffer(HALLOWEEN, 7, 'Nxe5')).toStrictEqual({ ok: true, side: 'white', deficit: 2 })
  })

  /**
   * And a quiet move can be the sacrifice. 3.c3 in the Smith-Morra takes nothing, hangs
   * nothing, and is the move that decides not to recapture on d4 — which is why counting
   * only what is en prise would miss it.
   */
  it('counts material already gone, so declining to recapture is an offer', () => {
    expect(proveOffer(SMITH_MORRA, 5, 'c3')).toStrictEqual({ ok: true, side: 'white', deficit: 1 })
  })

  /**
   * The Brentano is the reason this runs on a board rather than on a name. 3...g5 looks
   * like a pawn offer and is not one: 4.Nxg5 hangs the knight to 4...Qxg5, because Black's
   * own ...e5 opened that diagonal. A reviewer reading the moves can miss this; the board
   * cannot.
   */
  it('refuses a move that offers nothing, however gambit-like it looks', () => {
    const proof = proveOffer(BRENTANO, 6, 'g5')

    expect(proof.ok).toBe(false)
    if (proof.ok) return
    expect(proof.why).toContain('nothing was offered')
  })

  it('refuses a quiet developing move', () => {
    expect(proveOffer(GIUOCO_PIANO, 6, 'Bc5')).toMatchObject({ ok: false })
  })

  it('refuses a ply past the end of the line, naming the length', () => {
    const proof = proveOffer(KINGS_GAMBIT, 9, 'f4')

    expect(proof.ok).toBe(false)
    if (proof.ok) return
    expect(proof.why).toContain('3 plies long')
  })

  /**
   * The check that makes a broad rule safe. A rule names one ply for every row it admits,
   * so the move at that ply has to be the move the rule means — otherwise a row with a
   * different move order silently inherits a side nobody proved for it.
   */
  it('refuses a ply whose move is not the one named', () => {
    const proof = proveOffer(FALKBEER, 4, 'exf4')

    expect(proof.ok).toBe(false)
    if (proof.ok) return
    expect(proof.why).toBe('ply 4 is `d5`, not `exf4`')
  })

  it('refuses a line that is not legal', () => {
    expect(proveOffer(['e4', 'e5', 'Qz9'], 3, 'Qz9')).toMatchObject({ ok: false })
  })
})

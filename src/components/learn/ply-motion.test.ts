import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { plyMotionBetween } from './ply-motion.ts'

/**
 * `ply-motion.ts` reads a ply back out of the two positions either side of it, so the thing
 * worth asserting is that it agrees with the rules engine that produced them — the same
 * arrangement, and the same argument, as `last-ply.test.ts`: `chess.js` is a devDependency,
 * this is a test, the engine runs in CI and reaches no browser, and `board-tripwire.test.ts`
 * holds the other half of that.
 *
 * What is new here is the *shape* of the answer. `lastPlyBetween` returns one pair; this
 * returns every piece the ply moved and every piece it took, which is three claims the
 * narrower function never had to make:
 *
 * - a castle moves **two** pieces, and both have to be named, because an animation that
 *   slides only the king draws a move the position did not make;
 * - a capture names the piece that came off and the square it stood on, which for an
 *   *en passant* capture is neither of the mover's two squares;
 * - a promotion pairs a queen that arrived with a pawn that left, which is the one pairing
 *   that cannot be made by matching the piece.
 */

/**
 * What `chess.js` says happened, in the shape this module answers in — but keyed by plain
 * strings rather than by `Square` and `PieceKey`. The expectation is *built from the engine*,
 * so narrowing it to the domain types would mean asserting that the engine's squares are
 * squares, which is a claim about `chess.js` and not about the code under test. The
 * comparison below is between two records either way.
 */
type Expected = {
  readonly arrivedFrom: ReadonlyMap<string, string>
  readonly captured: ReadonlyMap<string, string>
}

const ROLES: Readonly<Record<string, string>> = {
  k: 'King',
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
  p: 'Pawn',
}

/** The rook's two squares for a castle, which the king's destination fixes exactly. */
const ROOK: Readonly<Record<string, readonly [string, string]>> = {
  g1: ['h1', 'f1'],
  c1: ['a1', 'd1'],
  g8: ['h8', 'f8'],
  c8: ['a8', 'd8'],
}

/**
 * The engine's own answer, assembled rather than restated: every field below comes from the
 * move object, so nothing here is a second opinion about what the move was.
 */
const expectedOf = (move: {
  from: string
  to: string
  flags: string
  color: string
  captured?: string | undefined
}): Expected => {
  const arrivedFrom = new Map<string, string>([[move.to, move.from]])
  const rook = move.flags.includes('k') || move.flags.includes('q') ? ROOK[move.to] : undefined
  if (rook !== undefined) arrivedFrom.set(rook[1], rook[0])

  const captured = new Map<string, string>()
  if (move.captured !== undefined) {
    // An *en passant* capture takes a pawn from the mover's file of arrival on its own rank.
    const square = move.flags.includes('e') ? `${move.to[0] ?? ''}${move.from[1] ?? ''}` : move.to
    const colour = move.color === 'w' ? 'black' : 'white'
    captured.set(square, `${colour}${ROLES[move.captured] ?? '?'}`)
  }

  return { arrivedFrom, captured }
}

/**
 * Both maps as plain objects with their keys in a fixed order, so a failure prints the
 * squares rather than `Map(2)` and so the sweep below can compare two of these as strings.
 * Sorted because the two sides build their maps in different orders and a castle has two
 * entries: without this the comparison would report a disagreement that is only an order.
 */
const readable = (motion: {
  arrivedFrom: ReadonlyMap<string, string>
  captured: ReadonlyMap<string, string>
}): Readonly<Record<string, Readonly<Record<string, string>>>> => {
  const sorted = (entries: ReadonlyMap<string, string>): Readonly<Record<string, string>> =>
    Object.fromEntries([...entries].sort(([one], [other]) => (one < other ? -1 : 1)))
  return { arrivedFrom: sorted(motion.arrivedFrom), captured: sorted(motion.captured) }
}

type Step = {
  readonly before: string
  readonly after: string
  readonly san: string
  readonly flags: string
  readonly expected: Expected
}

const walk = (plies: readonly string[]): readonly Step[] => {
  const chess = new Chess()
  return plies.map((san) => {
    const before = chess.fen()
    const move = chess.move(san)
    return { before, after: chess.fen(), san, flags: move.flags, expected: expectedOf(move) }
  })
}

const check = (steps: readonly Step[]): void => {
  for (const step of steps) {
    expect(readable(plyMotionBetween(step.before, step.after)), step.san).toStrictEqual(
      readable(step.expected),
    )
  }
}

/** The same deterministic generator `last-ply.test.ts` uses, and for the same reason. */
const sequence = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('reading every piece a ply moved off the two positions around it', () => {
  const AWKWARD: readonly { readonly name: string; readonly line: readonly string[] }[] = [
    {
      name: 'castling short, where the rook has to move too',
      line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'],
    },
    {
      name: 'castling long, on the other side and in the other colour',
      line: ['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'Nf3', 'O-O-O'],
    },
    {
      name: 'en passant, where the pawn taken is on neither of the mover’s squares',
      line: ['e4', 'Nf6', 'e5', 'd5', 'exd6'],
    },
    {
      name: 'a capturing promotion, where a queen arrives and a pawn left',
      line: ['d4', 'e5', 'dxe5', 'f6', 'exf6', 'Ne7', 'fxg7', 'Nf5', 'gxh8=Q'],
    },
    {
      name: 'a promotion that captures nothing, so the pairing has no taken piece beside it',
      line: ['a4', 'b5', 'axb5', 'a6', 'bxa6', 'Nc6', 'a7', 'Rb8', 'a8=Q'],
    },
  ]

  it.each(AWKWARD)('names the right squares for $name', ({ line }) => {
    check(walk(line))
  })

  it.each([
    ['e4', 'e5', 'Nf3', 'f6', 'Nxe5', 'fxe5', 'Qh5+', 'Ke7', 'Qxe5+', 'Kf7', 'Bc4+'],
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'O-O'],
    ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5', 'cxb5', 'a6', 'bxa6', 'Bxa6'],
    ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
  ])('agrees with the engine along the lines this product ships (%s)', (...line) => {
    check(walk(line))
  })

  /**
   * The breadth, and the same dice-loading `last-ply.test.ts` argues for: uniformly random
   * play reaches an *en passant* capture about once in seven thousand moves, so the sweep is
   * biased toward the moves with a branch behind them. The corpus is asserted as well as
   * swept, because a sweep that happened to contain no castling proves nothing about
   * castling and looks exactly like one that did.
   */
  describe('forty random legal games, weighted toward the awkward moves', () => {
    const SPECIAL: readonly string[] = ['k', 'q', 'e', 'p']
    const next = sequence(20_260_917)
    const steps: Step[] = []

    for (let game = 0; game < 40; game += 1) {
      const chess = new Chess()
      for (let ply = 0; ply < 120; ply += 1) {
        const legal = chess.moves({ verbose: true })
        if (legal.length === 0) break
        const awkward = legal.filter((move) => SPECIAL.some((flag) => move.flags.includes(flag)))
        const pool = awkward.length > 0 && next() < 0.5 ? awkward : legal
        const chosen = pool[Math.floor(next() * pool.length)]
        if (chosen === undefined) break
        const before = chess.fen()
        const move = chess.move(chosen.san)
        steps.push({
          before,
          after: chess.fen(),
          san: move.san,
          flags: move.flags,
          expected: expectedOf(move),
        })
      }
    }

    const withFlag = (flag: string): readonly Step[] =>
      steps.filter((step) => step.flags.includes(flag))

    it('contains the moves this is worth sweeping for', () => {
      expect(steps.length).toBeGreaterThan(2_000)
      expect(withFlag('k').length, 'no castling short').toBeGreaterThan(0)
      expect(withFlag('q').length, 'no castling long').toBeGreaterThan(0)
      expect(withFlag('e').length, 'no en passant').toBeGreaterThan(0)
      expect(withFlag('p').length, 'no promotion').toBeGreaterThan(0)
      expect(withFlag('c').length, 'no capture').toBeGreaterThan(0)
      // A promotion that takes a piece and one that does not are different pairings.
      expect(
        withFlag('p').filter((step) => !step.flags.includes('c')).length,
        'every promotion in the corpus was a capture',
      ).toBeGreaterThan(0)
    })

    it('names the right squares for every move in it', () => {
      const wrong = steps.filter(
        (step) =>
          JSON.stringify(readable(plyMotionBetween(step.before, step.after))) !==
          JSON.stringify(readable(step.expected)),
      )
      const report = wrong
        .slice(0, 5)
        .map(
          (step) =>
            `${step.san} (${step.flags}) from ${step.before}\n` +
            `  read     ${JSON.stringify(readable(plyMotionBetween(step.before, step.after)))}\n` +
            `  expected ${JSON.stringify(readable(step.expected))}`,
        )
        .join('\n')
      expect(wrong.length, `${wrong.length} of ${steps.length} disagreed:\n${report}`).toBe(0)
    })
  })

  /**
   * Nothing rather than a guess. An empty motion draws the position and animates nothing,
   * which is a board that does not slide rather than a piece sliding in from a square that
   * nothing was ever on.
   */
  describe('refuses to invent a ply', () => {
    const START = new Chess().fen()

    it('when a FEN is not one', () => {
      expect(readable(plyMotionBetween('not a position', START))).toStrictEqual({
        arrivedFrom: {},
        captured: {},
      })
      expect(readable(plyMotionBetween(START, 'not a position'))).toStrictEqual({
        arrivedFrom: {},
        captured: {},
      })
      expect(readable(plyMotionBetween('', ''))).toStrictEqual({ arrivedFrom: {}, captured: {} })
    })

    it('when the two positions are the same', () => {
      expect(readable(plyMotionBetween(START, START))).toStrictEqual({
        arrivedFrom: {},
        captured: {},
      })
    })
  })

  /**
   * The probe. Every assertion above is a comparison against the engine, and a comparison
   * that has quietly started comparing something to itself passes forever — so this is the
   * one place a wrong answer is written down on purpose, and the comparison is shown
   * rejecting it.
   */
  it('reports a motion that names the wrong origin', () => {
    const [step] = walk(['e4'])
    expect(step).toBeDefined()
    const read = readable(plyMotionBetween(step?.before ?? '', step?.after ?? ''))
    expect(read).toStrictEqual({ arrivedFrom: { e4: 'e2' }, captured: {} })
    expect(read).not.toStrictEqual({ arrivedFrom: { e4: 'd2' }, captured: {} })
  })
})

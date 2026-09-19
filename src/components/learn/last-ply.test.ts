import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { lastPlyBetween } from './last-ply.ts'

/**
 * `last-ply.ts` reads a ply back out of the two positions either side of it, so the thing
 * worth asserting is that it agrees with the rules engine that produced them.
 *
 * `chess.js` is a **devDependency** and this is a test, so importing it here is the same
 * arrangement `tools/` already has and ADR-0003's tripwire already allows: the engine runs
 * in CI and reaches no browser. `board-tripwire.test.ts` asserts both halves — no shipped
 * board module imports it, and it is absent from the runtime dependencies in
 * `package.json`. What it buys is that the interesting moves are not hand-written FENs
 * somebody believed were right: every position below was played, and every expected pair of
 * squares is the engine's own answer.
 */

/** The move `chess.js` says was played, in the shape `Board` takes. */
type Played = { readonly from: string; readonly to: string }

/**
 * A deterministic generator, so a failing run is a run anyone can repeat. `Math.random`
 * here would mean a gate that fails on someone else's machine and passes on the next
 * attempt, which is worse than no gate.
 */
const sequence = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Step = {
  readonly before: string
  readonly after: string
  readonly played: Played
  readonly san: string
  readonly flags: string
}

/** Play one line from the standard start position, keeping every position it passed. */
const walk = (plies: readonly string[]): readonly Step[] => {
  const chess = new Chess()
  return plies.map((san) => {
    const before = chess.fen()
    const move = chess.move(san)
    return {
      before,
      after: chess.fen(),
      played: { from: move.from, to: move.to },
      san,
      flags: move.flags,
    }
  })
}

describe('reading a ply back off the two positions around it', () => {
  /**
   * The moves that are not a piece leaving one square for another, spelled out rather than
   * left to the sweep below to stumble across — a reader should be able to see that
   * castling, *en passant* and promotion were considered.
   */
  const AWKWARD: readonly { readonly name: string; readonly line: readonly string[] }[] = [
    {
      name: 'castling short, where two of the mover’s pieces move at once',
      line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'],
    },
    {
      name: 'castling long, on the other side and in the other colour',
      line: ['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'Nf3', 'O-O-O'],
    },
    {
      name: 'en passant, where the captured pawn is on neither of the two squares',
      line: ['e4', 'Nf6', 'e5', 'd5', 'exd6'],
    },
    {
      name: 'a capturing promotion, where a different piece arrives than the one that left',
      line: ['d4', 'e5', 'dxe5', 'f6', 'exf6', 'Ne7', 'fxg7', 'Nf5', 'gxh8=Q'],
    },
  ]

  it.each(AWKWARD)('names the right two squares for $name', ({ line }) => {
    const steps = walk(line)
    for (const step of steps) {
      expect(lastPlyBetween(step.before, step.after), step.san).toStrictEqual(step.played)
    }
  })

  /**
   * The gambit lines this product actually ships, through the same check. Three of the
   * entries under `content/` are taught and every board on their pages is drawn from a pair
   * of positions like these.
   */
  const OPENINGS: readonly (readonly string[])[] = [
    ['e4', 'e5', 'Nf3', 'f6', 'Nxe5', 'fxe5', 'Qh5+', 'Ke7', 'Qxe5+', 'Kf7', 'Bc4+'],
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4'],
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+'],
    ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
  ]

  it.each(OPENINGS)('agrees with the engine along %s', (...line) => {
    for (const step of walk(line)) {
      expect(lastPlyBetween(step.before, step.after), step.san).toStrictEqual(step.played)
    }
  })

  /**
   * The breadth. Forty games of legal moves, every one of them checked — an opening
   * repertoire is a narrow slice of chess, and an endgame with three pieces left is where a
   * diff between two positions would be expected to get confused if it were going to.
   *
   * The choice is **deliberately biased** toward castling, *en passant* and promotion: half
   * the time, if one is legal, one is played. Uniformly random play reaches an *en passant*
   * capture about once in seven thousand moves, so an unbiased sweep large enough to
   * contain a few of them costs twenty-five seconds and still leaves whether it did to
   * chance. Loading the dice is the cheaper way to reach the three branches that exist for
   * these moves, and nothing here depends on the distribution being natural.
   *
   * The corpus is asserted as well as swept, because a sweep that happened to contain no
   * castling and no promotion would pass this file while proving nothing about those
   * branches, and would look exactly like a sweep that did.
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
        const move = pool[Math.floor(next() * pool.length)]
        if (move === undefined) break
        const before = chess.fen()
        chess.move(move.san)
        steps.push({
          before,
          after: chess.fen(),
          played: { from: move.from, to: move.to },
          san: move.san,
          flags: move.flags,
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
      // A promotion that captures and one that does not are different shapes of diff.
      expect(
        withFlag('p').filter((step) => !step.flags.includes('c')).length,
        'every promotion in the corpus was a capture',
      ).toBeGreaterThan(0)
    })

    it('names the right two squares for every move in it', () => {
      const wrong = steps.filter((step) => {
        const read = lastPlyBetween(step.before, step.after)
        return read?.from !== step.played.from || read.to !== step.played.to
      })
      const report = wrong
        .slice(0, 5)
        .map((step) => `${step.san} (${step.flags}) from ${step.before}`)
        .join('\n')
      expect(wrong.length, `${wrong.length} of ${steps.length} disagreed:\n${report}`).toBe(0)
    })
  })

  /**
   * Nothing rather than a guess. `Board` draws no highlight for an absent `lastMove`, so
   * every one of these is a board without a mark — which is the recoverable failure
   * `docs/design-system.md` §4 asks for, rather than a mark on a square nothing moved to.
   */
  describe('refuses to invent a ply', () => {
    const START = new Chess().fen()

    it('when the two positions are the same', () => {
      expect(lastPlyBetween(START, START)).toBeUndefined()
    })

    it('when a FEN is not one', () => {
      expect(lastPlyBetween('not a position', START)).toBeUndefined()
      expect(lastPlyBetween(START, 'not a position')).toBeUndefined()
      expect(lastPlyBetween('', '')).toBeUndefined()
    })

    it('when the FEN does not say whose move it is', () => {
      const [placement] = START.split(' ')
      expect(lastPlyBetween(placement ?? '', START)).toBeUndefined()
    })

    it('when more than one ply separates the two positions', () => {
      const steps = walk(['e4', 'e5', 'Nf3'])
      const first = steps[0]
      const last = steps[2]
      expect(first).toBeDefined()
      expect(last).toBeDefined()
      expect(lastPlyBetween(first?.before ?? '', last?.after ?? '')).toBeUndefined()
    })
  })
})

/**
 * **AC 5, and the reason this ticket exists at all.**
 *
 * The highlight was complete and switched off for four waves because `lastMove` was an
 * optional prop that no caller passed, and a test that only checked `Board` draws a
 * highlight when given one went on passing throughout. So the assertion cannot be about
 * `Board`: it has to be about every place a board is mounted.
 *
 * Two things enforce that, and they fail on different mistakes. The type does the first
 * half — `BoardPreview` requires `lastMove` even though the value may be undefined, so a
 * preview cannot be mounted without the question being answered. This does the other half,
 * over `Board` itself and over any component that grows a board later: a mount that does
 * not mention the prop is a mount nobody decided about, and it fails here by name.
 */
describe('every board the site mounts is told which ply produced its position (AC 5)', () => {
  const SOURCES: Readonly<Record<string, string>> = import.meta.glob('/src/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  const isShipped = (path: string): boolean =>
    !path.includes('.test.') && !path.includes('fixtures')

  /** Comments out, so explaining a board can never be mistaken for mounting one. */
  const code = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

  const MOUNT = /<(BoardPreview|Board)\b[^>]*>/g

  /** Every `<Board>`/`<BoardPreview>` in a file, as one line a reader can act on. */
  const mountsIn = (path: string, text: string): readonly { where: string; jsx: string }[] =>
    [...code(text).matchAll(MOUNT)].map((match) => ({
      where: `${path}: ${match[0].replace(/\s+/g, ' ')}`,
      jsx: match[0],
    }))

  const MOUNTS = Object.entries(SOURCES)
    .filter(([path]) => isShipped(path))
    .flatMap(([path, text]) => mountsIn(path.replace(/^\//, ''), text))

  it('finds the boards it claims to check', () => {
    const files = MOUNTS.map(({ where }) => where.split(':')[0])
    expect(files).toContain('src/components/learn/LearningSurface.tsx')
    expect(files).toContain('src/components/learn/BoardPreview.tsx')
    expect(files).toContain('src/components/learn/ChoiceLink.tsx')
    // `MateNet` mounted one here from #121 until #123 removed it: the main board is the
    // anchor now, and a second board that only repeated it is exactly what #123 was filed to
    // remove (`MateNet.tsx`'s own doc comment). Three is the current, real count, not a
    // number chosen to make this pass — dropping below it again should still fail here.
    expect(MOUNTS.length).toBeGreaterThanOrEqual(3)
  })

  it('passes lastMove at every one of them', () => {
    const silent = MOUNTS.filter(({ jsx }) => !jsx.includes('lastMove')).map(({ where }) => where)
    expect(
      silent,
      `a board is mounted without deciding what ply produced its position:\n${silent.join('\n')}`,
    ).toStrictEqual([])
  })

  /**
   * The probe. Every assertion above is a search that finds nothing, and a search that has
   * quietly stopped searching finds nothing too.
   */
  it('reports a board mounted without it', () => {
    const offender = mountsIn('example.tsx', '<Board fen={fen} labels={labels} />')
    expect(offender).toHaveLength(1)
    expect(offender.filter(({ jsx }) => !jsx.includes('lastMove'))).toHaveLength(1)
  })
})

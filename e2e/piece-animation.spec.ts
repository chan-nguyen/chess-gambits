import { expect, test, type Page } from '@playwright/test'
import { EVANS_ENTRY, MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * #72: a piece slides from the square it left to the square it reached.
 *
 * **Everything here watches pieces move.** This project has deleted two gates for measuring
 * something adjacent to the thing they claimed to measure, so the rule this file holds to is
 * that no assertion may be satisfiable by a stylesheet declaration. It never reads
 * `transition`, never reads `animation`, never asks `document.getAnimations()` and never
 * looks for a class. It samples where every piece on the board is painted, once per frame,
 * for longer than the animation lasts, and asserts things about the path.
 *
 * The position is read from the element's **computed** transform rather than from its
 * attribute, which is the whole difference: the attribute is the square the FEN puts the
 * piece on and never changes during the slide, and the computed value is where the browser
 * is currently drawing it. One unit is one square, because the board's SVG is an 8x8
 * viewBox — `(4, 6)` is e2 with White at the bottom.
 *
 * The clicks happen **inside the page**, in the same evaluation as the sampler, so no part
 * of any path is Playwright's round trip and no frame between the press and the first sample
 * is lost to it.
 *
 * Published content is used rather than a fixture wherever the assertion is about motion:
 * the real route, the real loader, the real compiled file. The fixture appears once, for the
 * rapid-press check, because that one needs a FEN this file can state independently of
 * whatever `content/` happens to hold.
 */

const EVANS = `vi/${routeSegments.catalogue}/italian-game-evans-gambit`
const SETTLE = { timeout: 10_000 }

/** Long enough to contain a `--duration-base` animation twice over. */
const WATCH_MS = 450

/** A square in the board's own coordinates, White at the bottom: `a8` is `(0, 0)`. */
const at = (square: string): { readonly x: number; readonly y: number } => {
  const [file, rank] = [square[0] ?? '', square[1] ?? '']
  return { x: 'abcdefgh'.indexOf(file), y: 8 - Number(rank) }
}

type Spot = { readonly t: number; readonly x: number; readonly y: number; readonly opacity: number }

/** Every frame one element was seen in, in order. One entry per `<use>`, not per square. */
type Track = {
  /** The piece is one this ply took, drawn where it stood while the mover comes for it. */
  readonly gone: boolean
  /** It belongs to a branch preview rather than to the board the learner is standing on. */
  readonly preview: boolean
  readonly spots: readonly Spot[]
}

const NOWHERE: Track = { gone: false, preview: false, spots: [] }

/**
 * Press a control and report where **every piece on the page** was painted, once a frame,
 * for `WATCH_MS`. One press, every board: the learner's and all the branch previews, watched
 * by the same instrument in the same window, which is what makes AC 3 an observation rather
 * than a hope.
 *
 * Tracked by element identity rather than by index, because a ply can add a piece to the
 * drawing (the one it took, held under the mover) and remove one, and an index would then
 * mean a different piece in the frames after the commit than in the frames before it.
 */
const watch = (page: Page, control: string): Promise<readonly Track[]> =>
  page.evaluate(
    async ({ selector, ms }) => {
      const seen = new Map<Element, Spot[]>()
      const gone = new Set<Element>()
      const preview = new Set<Element>()
      const started = performance.now()

      const sample = (): void => {
        const t = Math.round(performance.now() - started)
        for (const piece of document.querySelectorAll('.board__piece')) {
          const style = getComputedStyle(piece)
          const matrix = new DOMMatrix(style.transform)
          const spots = seen.get(piece) ?? []
          if (!seen.has(piece)) seen.set(piece, spots)
          if (piece.classList.contains('board__piece--gone')) gone.add(piece)
          if (piece.closest('.board-preview') !== null) preview.add(piece)
          spots.push({ t, x: matrix.e, y: matrix.f, opacity: Number(style.opacity) })
        }
      }

      const link = document.querySelector(selector)
      if (!(link instanceof HTMLElement)) throw new Error(`no control matching ${selector}`)
      link.click()

      await new Promise<void>((resolve) => {
        const tick = (): void => {
          sample()
          if (performance.now() - started > ms) return resolve()
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })

      return [...seen.entries()].map(([piece, spots]) => ({
        gone: gone.has(piece),
        preview: preview.has(piece),
        spots,
      }))
    },
    { selector: control, ms: WATCH_MS },
  )

/** The board the learner is standing on. Previews are asked for by name where they matter. */
const onTheBoard = (tracks: readonly Track[]): readonly Track[] =>
  tracks.filter((track) => !track.preview)

const NEXT = 'a[rel="next"]'
const PREVIOUS = 'a[rel="prev"]'

/**
 * **Drawn between two squares**, which is the observable this whole file turns on.
 *
 * Not "drawn somewhere else than last frame". A piece that moved without animating is drawn
 * at one square and then at another, and a sampler cannot tell that apart from a slide by
 * comparing two frames — the first frame can also land before React has committed, so even a
 * still board can show a piece at two squares. Being drawn at a *fraction* of a square is
 * something only an animation does, and it is true or false of a single sample.
 *
 * The tolerance is generous enough that the last few frames of an ease curve, which are
 * within a hundredth of the destination, count as arrived rather than as in flight.
 */
const between = (spot: Spot): boolean =>
  Math.abs(spot.x - Math.round(spot.x)) > 0.02 || Math.abs(spot.y - Math.round(spot.y)) > 0.02

/** The pieces that were seen in flight. An empty list is a board that did not animate. */
const animating = (tracks: readonly Track[]): readonly Track[] =>
  tracks.filter((track) => track.spots.some(between))

/** Every place a piece was drawn that is not a square, for a failure to print. */
const inFlight = (tracks: readonly Track[]): readonly (readonly [number, number])[] =>
  tracks.flatMap((track) =>
    track.spots.filter(between).map((spot): readonly [number, number] => [spot.x, spot.y]),
  )

const where = ({ spots }: Track, index: number): { x: number; y: number } => {
  const spot = spots.at(index)
  return {
    x: Math.round((spot?.x ?? Number.NaN) * 1000) / 1000,
    y: Math.round((spot?.y ?? Number.NaN) * 1000) / 1000,
  }
}

/**
 * The claim that a jump cannot satisfy, stated once and used by every slide below.
 *
 * Four things, and each rules out a different wrong animation: it ends on the destination
 * (not somewhere else), it was seen at three or more places (not teleported), every place it
 * was seen is on the straight line between the two squares (it did not detour or start from
 * a stale square), and it was seen at least a fifth of the way from each end (it did not
 * merely wobble a pixel before arriving).
 */
const slid = (track: Track, from: string, to: string): readonly string[] => {
  const start = at(from)
  const end = at(to)
  const span = Math.hypot(end.x - start.x, end.y - start.y)
  const problems: string[] = []

  const last = track.spots.at(-1)
  if (last === undefined || Math.hypot(last.x - end.x, last.y - end.y) > 0.001) {
    problems.push(`it finished at ${JSON.stringify(where(track, -1))} rather than on ${to}`)
  }

  const places = new Set(track.spots.map((spot) => `${spot.x.toFixed(3)},${spot.y.toFixed(3)}`))
  if (places.size < 3) {
    problems.push(`it was drawn in ${places.size} place(s), so nothing was animated`)
  }

  // Distance from the segment, via the triangle's area. Zero on the line between the squares.
  const strayed = track.spots.filter((spot) => {
    const area = Math.abs(
      (end.x - start.x) * (start.y - spot.y) - (start.x - spot.x) * (end.y - start.y),
    )
    return area / span > 0.02
  })
  if (strayed.length > 0) {
    problems.push(`${strayed.length} sample(s) were off the line from ${from} to ${to}`)
  }

  const between = track.spots.filter(
    (spot) =>
      Math.hypot(spot.x - start.x, spot.y - start.y) > span / 5 &&
      Math.hypot(spot.x - end.x, spot.y - end.y) > span / 5,
  )
  if (between.length === 0) {
    problems.push(`it was never drawn between ${from} and ${to}, only at the ends`)
  }

  return problems
}

test.describe('a ply slides the piece that played it (AC 1)', () => {
  test('forward, out of the initial position', async ({ page }) => {
    await page.goto(`${EVANS}?prelude=0`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    const sliding = animating(onTheBoard(await watch(page, NEXT)))

    expect(sliding, 'exactly one piece is drawn in flight for 1.e4').toHaveLength(1)
    expect(slid(sliding[0] ?? NOWHERE, 'e2', 'e4')).toStrictEqual([])
  })

  test('backward, undoing the ply that reached this position', async ({ page }) => {
    await page.goto(`${EVANS}?line=Bxb4_c3_Ba5_d4_exd4`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    const sliding = animating(onTheBoard(await watch(page, PREVIOUS)))

    expect(
      sliding,
      'exactly one piece is drawn in flight stepping back over 7...exd4',
    ).toHaveLength(1)
    expect(slid(sliding[0] ?? NOWHERE, 'd4', 'e5')).toStrictEqual([])
  })

  /**
   * The join #70 put in front of the tree. Stepping across it changes the board like any
   * other ply, so it has to animate like one — and it is the step most likely not to, because
   * the two positions come from different halves of the walk.
   */
  test('across the join between the defining line and the tree, in both directions', async ({
    page,
  }) => {
    await page.goto(`${EVANS}?prelude=6`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    const forwards = animating(onTheBoard(await watch(page, NEXT)))
    expect(
      forwards,
      'exactly one piece is in flight for 4.b4, the last ply of the defining line',
    ).toHaveLength(1)
    expect(slid(forwards[0] ?? NOWHERE, 'b2', 'b4')).toStrictEqual([])

    await expect(page).toHaveURL(
      new RegExp(`${routeSegments.catalogue}/italian-game-evans-gambit$`),
    )

    const backwards = animating(onTheBoard(await watch(page, PREVIOUS)))
    expect(backwards, 'exactly one piece is in flight stepping back out of the root').toHaveLength(
      1,
    )
    expect(slid(backwards[0] ?? NOWHERE, 'b4', 'b2')).toStrictEqual([])
  })

  test('castling slides the rook as well as the king', async ({ page }) => {
    await page.goto(`${EVANS}?line=Bxb4_c3_Ba5_d4_exd4`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    const sliding = animating(onTheBoard(await watch(page, NEXT)))

    expect(sliding, 'a castle moves two pieces and both are drawn moving').toHaveLength(2)
    // By where each finished, which is exact; where each started is a frame into the slide.
    const king = sliding.find((track) => where(track, -1).x === at('g1').x)
    const rook = sliding.find((track) => track !== king)
    expect(slid(king ?? NOWHERE, 'e1', 'g1')).toStrictEqual([])
    expect(slid(rook ?? NOWHERE, 'h1', 'f1')).toStrictEqual([])
  })

  test('a capture keeps the taken piece until the mover lands on it', async ({ page }) => {
    await page.goto(`${EVANS}?line=Bxb4_c3_Ba5_d4`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    const tracks = onTheBoard(await watch(page, NEXT))
    const taken = tracks.filter((track) => track.gone)
    const sliding = animating(tracks)

    expect(sliding, 'the capturing pawn slides').toHaveLength(1)
    expect(slid(sliding[0] ?? NOWHERE, 'e5', 'd4')).toStrictEqual([])

    expect(taken, 'the pawn on d4 is still drawn after it has been taken').toHaveLength(1)
    const ghost = taken[0] ?? NOWHERE
    expect(where(ghost, 0), 'it stays on the square it stood on').toStrictEqual(at('d4'))

    /*
     * The two halves of "when the mover arrives, not before". The mover's own path is the
     * clock: while it is still short of d4 the taken pawn must be fully drawn, and by the
     * time the mover has landed it must be gone. Reading the clock off the animation rather
     * than off a duration is what keeps this from being a test of `--duration-base`.
     */
    const arrival = sliding[0]?.spots.find(
      (spot) => Math.hypot(spot.x - at('d4').x, spot.y - at('d4').y) < 0.001,
    )
    expect(arrival, 'the mover never arrived').toBeDefined()

    const early = ghost.spots.filter((spot) => spot.t < (arrival?.t ?? 0) - 32)
    expect(early.length, 'nothing was sampled while the mover was still in flight').toBeGreaterThan(
      2,
    )
    expect(
      early.filter((spot) => spot.opacity < 1),
      'the taken pawn faded before the mover reached it',
    ).toStrictEqual([])

    expect(ghost.spots.at(-1)?.opacity, 'the taken pawn is still drawn after the move').toBe(0)
  })
})

test.describe('prefers-reduced-motion: reduce (AC 2)', () => {
  test.use({ reducedMotion: 'reduce' })

  /**
   * Nothing here names a stylesheet, and that is the point: the rule under test is the
   * `!important` block in `src/styles/global.css`, `Board.css` deliberately carries no second
   * copy of it for the pieces, and deleting the global block is what turns this red.
   */
  test('no piece is ever drawn between two squares, and nothing is held over', async ({ page }) => {
    await page.goto(`${EVANS}?line=Bxb4_c3_Ba5_d4`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    const tracks = onTheBoard(await watch(page, NEXT))

    expect(tracks.length, 'no pieces were watched at all').toBeGreaterThan(20)
    expect(
      inFlight(tracks),
      'a piece was drawn between two squares with the preference on',
    ).toStrictEqual([])

    const taken = tracks.filter((track) => track.gone)
    expect(taken, 'the capture still happened, so there is a taken piece to check').toHaveLength(1)
    expect(
      taken[0]?.spots.filter((spot) => spot.opacity > 0),
      'the taken piece was drawn, so a learner sees a pawn that is no longer there',
    ).toStrictEqual([])
  })

  test('the board still reaches the position it is meant to', async ({ page }) => {
    await page.goto(`${EVANS}?line=Bxb4_c3_Ba5_d4`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)
    await page.locator(NEXT).click()

    await expect(page.getByRole('gridcell', { name: 'd4, tốt đen' }).first()).toBeVisible(SETTLE)
  })
})

test.describe('branch preview boards (AC 3)', () => {
  /**
   * The press is chosen so that previews are on screen **before and after** it, which is the
   * only arrangement in which one could animate at all: React keeps the `ChoiceLink` and the
   * `Board` inside it across the navigation and hands them a different position, and a piece
   * whose transform changed under a transition would slide. Every press in published content
   * lands on a node with no choices — an opponent node's children are learner nodes — so the
   * fixture is served for this one. `EVANS_ENTRY`'s root offers four replies and its first,
   * `Ba5`, is the learner node with two plans that #9 added for exactly this kind of reason.
   *
   * The instrument is the one that watched the main board slide, over the same press, and the
   * main board is asserted to have moved during it. Without that half this would pass on a
   * build where nothing animated anywhere.
   */
  test('do not animate while the board the learner is on does', async ({ page }) => {
    await serveEntry(page, EVANS_ENTRY)
    await page.goto(`vi/${routeSegments.catalogue}/${EVANS_ENTRY.id}`)
    await expect(page.getByRole('heading', { name: vi.learn.branchHeading })).toBeVisible(SETTLE)
    expect(
      await page.locator('.board-preview').count(),
      'no previews before the press, so nothing could be reused across it',
    ).toBeGreaterThan(2)

    const tracks = await watch(page, NEXT)
    const inPreviews = tracks.filter((track) => track.preview)

    expect(
      await page.locator('.board-preview').count(),
      'no previews after the press either, so no preview survived it',
    ).toBeGreaterThan(1)
    expect(
      animating(onTheBoard(tracks)),
      'the main board did not animate either, so this press proves nothing',
    ).toHaveLength(1)
    expect(inPreviews.length, 'no preview pieces were watched').toBeGreaterThan(20)
    expect(inFlight(inPreviews), 'a preview board animated').toStrictEqual([])
  })
})

/**
 * AC 6, over the fixture rather than over published content.
 *
 * The assertion is against a FEN this file can state, and `learn-fixtures.ts` is where a FEN
 * is available in TypeScript without compiling `content/` — which also makes the expected
 * position independent of whatever the published trees happen to hold next month.
 */
/** The squares a FEN fills, so a painted board can be compared against the position itself. */
const occupiedIn = (fen: string): readonly string[] =>
  (fen.split(' ')[0] ?? '').split('/').flatMap((row, index) => {
    const rank = 8 - index
    let file = 0
    const squares: string[] = []
    for (const character of row) {
      const skip = Number.parseInt(character, 10)
      if (Number.isNaN(skip)) {
        squares.push(`${'abcdefgh'[file] ?? '?'}${rank}`)
        file += 1
      } else {
        file += skip
      }
    }
    return squares
  })

test.describe('four fast presses (AC 6)', () => {
  const FOURTH = MAPPED_ENTRY.prelude[4]?.fen ?? ''

  test('leave a board that matches the position, with nothing stranded', async ({ page }) => {
    expect(FOURTH, 'the fixture has no fourth prelude position').not.toBe('')
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`vi/${routeSegments.catalogue}/${MAPPED_ENTRY.id}?prelude=0`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    const painted = await page.evaluate(async () => {
      const control = (): Element | null => document.querySelector('a[rel="next"]')
      const href = (): string | null => control()?.getAttribute('href') ?? null

      /*
       * One press a frame, which is as fast as a press can land: the controls step from the
       * position on screen, so a second press in the same frame as the first is aimed at a
       * control that has not moved on yet and navigates nowhere. Four presses about 16ms
       * apart are still four presses well inside one 200ms slide, which is the case AC 6 is
       * about. The bail-out is so a build where next stops working fails as a wrong board
       * rather than as a hung page.
       */
      for (let landed = 0, frames = 0; landed < 4 && frames < 60; frames += 1) {
        const before = href()
        const link = control()
        if (link instanceof HTMLElement) link.click()
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (href() !== before) landed += 1
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000))

      const canvas = document.querySelector('.learning-surface__board .board__canvas')
      return [...(canvas?.querySelectorAll('.board__piece') ?? [])]
        .filter((piece) => getComputedStyle(piece).opacity !== '0')
        .map((piece) => {
          const matrix = new DOMMatrix(getComputedStyle(piece).transform)
          return { x: matrix.e, y: matrix.f }
        })
    })

    await expect(page).toHaveURL(/prelude=4$/)

    const stranded = painted.filter(
      ({ x, y }) => Math.abs(x - Math.round(x)) > 0.001 || Math.abs(y - Math.round(y)) > 0.001,
    )
    expect(stranded, 'a piece was left between two squares').toStrictEqual([])

    const squares = painted
      .map(({ x, y }) => `${'abcdefgh'[Math.round(x)] ?? '?'}${8 - Math.round(y)}`)
      .sort()
    expect(squares).toStrictEqual([...occupiedIn(FOURTH)].sort())
  })
})

/**
 * **A jump over several plies at once** (review addition).
 *
 * Every case above moves the board one ply. `MoveList` and the game-start control do not:
 * they land on a position several plies away, and the motion is still derived from the ply
 * that *reached* it, so a piece whose key happens to match across the two renders slides for
 * a move nobody played. Measured on published content, a five-ply jump back produces exactly
 * one such slide.
 *
 * That artefact is cosmetic and is not what this asserts. The property worth a gate is the
 * one AC 6 establishes for fast presses and nothing establishes for jumps: however the board
 * gets there, **it settles on the position and leaves nothing between two squares.** A jump
 * is the case most likely to break it, because the arrival and the departure it pairs are
 * genuinely unrelated — and it is the one route through the board that no test took.
 */
test.describe('a jump over several plies', () => {
  const START = MAPPED_ENTRY.prelude[0]?.fen ?? ''

  test('settles on the position it landed on, with nothing stranded', async ({ page }) => {
    expect(START, 'the fixture has no initial position').not.toBe('')
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`vi/${routeSegments.catalogue}/${MAPPED_ENTRY.id}?prelude=4`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    // Four plies back to move one, in one click, which is the jump nothing else covers.
    await page.getByRole('link', { name: vi.learn.toStart }).click()
    await expect(page).toHaveURL(/prelude=0/, SETTLE)

    const painted = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))

      return [...document.querySelectorAll('.board__canvas .board__piece')].flatMap((piece) => {
        if (!(piece instanceof SVGElement)) return []
        const matrix = /matrix\(([^)]+)\)/.exec(getComputedStyle(piece).transform)
        const parts = (matrix?.[1] ?? '').split(',').map(Number)
        const x = parts[4] ?? Number.NaN
        const y = parts[5] ?? Number.NaN
        const faded = getComputedStyle(piece).opacity === '0'

        return [{ x, y, faded }]
      })
    })

    const here = painted.filter((piece) => !piece.faded)

    expect(
      here.filter((piece) => !Number.isInteger(piece.x) || !Number.isInteger(piece.y)),
      'a piece was left between two squares after the jump',
    ).toStrictEqual([])

    expect(
      here
        .map(({ x, y }) => `${'abcdefgh'[x] ?? '?'}${8 - y}`)
        .sort()
        .join(' '),
      'the board does not match the position it jumped to',
    ).toBe([...occupiedIn(START)].sort().join(' '))
  })
})

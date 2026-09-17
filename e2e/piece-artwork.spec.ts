import { expect, test, type Page } from '@playwright/test'
import { MAIN_LINE, MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import { lineSearch } from '../src/lib/line.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * **The artwork itself, measured — not the string it is stored as.**
 *
 * This file exists because of what the alternative would have been. A test that greps
 * `piece-sprite.tsx` for a path, or counts `<symbol>` elements, certifies the sprite
 * without ever seeing it: it stays green when a piece is drawn in the wrong place, when
 * two roles collapse into the same silhouette, and when a shape turns into a scribble.
 * This repository has deleted two tests for exactly that, and the vendoring in #71 produced
 * that failure for real — normalising a leading relative moveto by uppercasing its `m`
 * turned the knight's implicit linetos absolute and drew a tangle. Every string assertion
 * about the sprite passed. The board was visibly broken.
 *
 * So the measurement is geometric. `SVGGeometryElement.isPointInFill` answers, for a real
 * point in a real path, whether the ink is there — the browser's own fill rule over the path
 * the page actually holds, not over a copy of it. Sampling a grid of those points gives a
 * coarse silhouette per role, which is enough to ask the two questions the ticket is about:
 * is each piece *there*, and can a learner tell it from the other five.
 *
 * **Sampled twice, because the sizes are what the ticket is about.** `SAMPLES.board` is
 * the main board, `SAMPLES.preview` is the twelve device pixels a square gets inside a 96px
 * branch preview (`BoardPreview.css`, `--space-10`). A set can be beautiful at the first
 * and mush at the second, which is the case the acceptance criteria name and the reason
 * `celtic` was chosen over `chessnut`.
 *
 * What this file deliberately does **not** repeat: that the sprite is inlined and never
 * fetched (`Board.test.tsx`, requirement N8), that the piece tokens separate in greyscale
 * (`board-contrast.test.ts`), and that no colour literal reaches a shipped file
 * (`src/styles/no-raw-values.test.ts`, which scans `piece-sprite.tsx` along with the rest).
 */

/** The grid each silhouette is sampled on, per surface. */
const SAMPLES = { board: 24, preview: 12 } as const

/**
 * How much of its box a piece may fill.
 *
 * A floor and a ceiling, because the two ways a shape fails are opposite: a path that did
 * not draw measures 0, and one that blew out — an unclosed subpath, a mangled transform —
 * swallows the square. The shipped set measures 0.18 (pawn) to 0.42 (king).
 */
const COVERAGE = { min: 0.1, max: 0.6 } as const

/**
 * How much of the box two roles must differ over to count as telling apart.
 *
 * Six per cent of the square, at both resolutions. The tightest pair the shipped set has is
 * the bishop against the pawn, at 11% on the board and 9% in a preview.
 */
const DISTINCT_FRACTION = 0.06

const ROLES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'] as const

/**
 * How far a piece's centre of ink may sit from the middle of its square, and how close its
 * ink may come to the edge.
 *
 * This is not decoration. A path drawn in the wrong coordinate space still has plausible
 * coverage and is still unlike the other five — the `m`-to-`M` bug above measured 0.32
 * coverage and was *further* from every other role than the real knight — so neither of the
 * assertions above could see it. What it was, was jammed into the left of the box: centre of
 * ink at 0.23 instead of 0.50, running off the left edge. A chess piece stands in the middle
 * of its square, clear of all four sides, and that is a claim about the artwork that a
 * mangled path cannot satisfy. The shipped set sits at 0.494 to 0.516.
 */
const CENTRE_TOLERANCE = 0.08

/**
 * How much of the reference silhouette a role must still match.
 *
 * The three properties above say a piece is *there*, *its own shape* and *in the right
 * place*. None of them says it is still the piece Maurizio Monge drew: a corruption that
 * kept its coverage, its distinctness and its centre would pass all three. So each role is
 * also held against a picture of itself, sampled off this same geometry when the set was
 * vendored and committed below.
 *
 * It is a change detector and it is meant to be: the artwork is vendored, so it does not
 * drift on its own, and a pull request that changes what a piece looks like should have to
 * say so. Not exact, because `isPointInFill` flattens curves and a cell sitting on an edge
 * could in principle fall the other way on a future Chromium; a whole percent of the box is
 * far more slack than that needs and far less than any real change costs. Regenerate a
 * reference by printing the silhouette this file samples — never by copying the number out
 * of a failure.
 *
 * What it does **not** check is whether the artwork is any *good* at 96px. Nothing
 * automated does. `e2e/greyscale-review.spec.ts` photographs it and
 * `docs/design-system.md` §5 names the person who decides.
 */
const FIDELITY = 0.99

/**
 * Each role as it was vendored, at `SAMPLES.board`, row-major, `#` for ink.
 *
 * Readable on purpose — reflowed to 24 characters a line these are a crown, a coronet,
 * a tower, a mitre, a horse's head and a pawn, and a reviewer can see which one broke.
 */
const REFERENCE: Readonly<Record<(typeof ROLES)[number], string>> = {
  king: '...................................##......................##...................#..##..#................########................########...................##..............####....##....####......##################.......#################.......################.........###############.........##############...........############............############.............##########..............##########..............##########..............##########............##############.........################........################.........##############.............................',
  queen:
    '........................................................#.....##...............###....###.........##....#.....##...###....##....#.....#....###.....##...##....#....#........#....#...##....#........##...#...##...##........##...##..##..##.........###.###.###..##..........##############..........##############..........#############............############.............##########..............##########..............##########.............###########...........###############.........################........################....................................................',
  rook: '.............................................................................###..####...###.........###..####...###.........###############.........##############..........###############..........############.............##########..............##########...............#########...............#########...............#########...............########................########................########................#########...............#########............##############.........################.........###############............######..................................',
  bishop:
    '...................................##.....................####....................####...................####...................#####..#................####..###..............#####..###...............########................########................########.................######...................####...................#####....................####....................####...................#####...................######.................#########.............#############..........###############.........###############..........############..............................',
  knight:
    '........................................................#.#.....................####...................#######.................########...............###########.............###########............#############...........##############.........###############.........########.######........######...#######........####....########........###....#########..............##########..............##########..............##########..............##########.............###########...........###############.........###############..........#############............................',
  pawn: '..................................................................................................................................###....................######..................######.................#######..................######...................####...................######..................######...................####....................###.....................####....................####...................#####...................######................##########.............############............############......................................................',
}

/** A role's silhouette: one bit per sample cell, row-major. */
type Silhouette = readonly boolean[]

/**
 * Sample every body path in the main board's sprite, keyed by the role its symbol names.
 *
 * Read off the rendered page rather than off the source, so what is measured is what the
 * component put in the document — including the viewBox it chose, which is the coordinate
 * system the samples are laid out in.
 */
const silhouettes = (page: Page, grid: number): Promise<Record<string, Silhouette>> =>
  page.evaluate((samples) => {
    const found: Record<string, boolean[]> = {}
    const board = document.querySelector('.learning-surface__board .board__canvas')
    for (const path of board?.querySelectorAll('.board__piece-body') ?? []) {
      const symbol = path.closest('symbol')
      if (symbol === null || !(path instanceof SVGGeometryElement)) continue
      const box = symbol.viewBox.baseVal
      const role = symbol.id.slice(symbol.id.lastIndexOf('-') + 1)
      const cells: boolean[] = []
      for (let row = 0; row < samples; row += 1) {
        for (let column = 0; column < samples; column += 1) {
          const x = box.x + ((column + 0.5) * box.width) / samples
          const y = box.y + ((row + 0.5) * box.height) / samples
          cells.push(path.isPointInFill(new DOMPoint(x, y)))
        }
      }
      found[role] = cells
    }
    return found
  }, grid)

const coverage = (shape: Silhouette): number => shape.filter((inked) => inked).length / shape.length

/** The fraction of the box on which two silhouettes disagree. */
const difference = (a: Silhouette, b: Silhouette): number =>
  a.filter((inked, cell) => inked !== b[cell]).length / a.length

/** A silhouette as something a reviewer can look at, for a failure message. */
const picture = (cells: string): string =>
  (cells.match(new RegExp(`.{1,${SAMPLES.board}}`, 'g')) ?? []).join('\n')

const open = async (page: Page): Promise<void> => {
  await serveEntry(page, MAPPED_ENTRY)
  await page.goto(`vi/gambits/${MAPPED_ENTRY.id}${lineSearch(MAIN_LINE.slice(0, 2))}`)
  await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
}

const PAIRS = ROLES.flatMap((first, index) =>
  ROLES.slice(index + 1).map((second) => ({ first, second })),
)

test.describe('the piece artwork, read off its own geometry', () => {
  for (const [surface, grid] of Object.entries(SAMPLES)) {
    test.describe(`at ${surface} resolution (${grid} samples a square)`, () => {
      test('draws all six roles, none blank and none a filled block', async ({ page }) => {
        await open(page)
        const shapes = await silhouettes(page, grid)

        expect(Object.keys(shapes).sort()).toStrictEqual([...ROLES].sort())
        for (const role of ROLES) {
          const shape = shapes[role]
          expect(shape, `${role} was not sampled`).toBeDefined()
          expect(coverage(shape ?? []), `${role} fills too little of its square`).toBeGreaterThan(
            COVERAGE.min,
          )
          expect(coverage(shape ?? []), `${role} fills too much of its square`).toBeLessThan(
            COVERAGE.max,
          )
        }
      })

      test('keeps the six roles apart from one another', async ({ page }) => {
        await open(page)
        const shapes = await silhouettes(page, grid)

        for (const { first, second } of PAIRS) {
          const a = shapes[first] ?? []
          const b = shapes[second] ?? []
          expect(
            difference(a, b),
            `the ${first} and the ${second} are the same shape at ${surface} size`,
          ).toBeGreaterThan(DISTINCT_FRACTION)
        }
      })
    })
  }

  test('stands each piece in the middle of its square and clear of the edges', async ({ page }) => {
    await open(page)
    const grid = SAMPLES.board
    const shapes = await silhouettes(page, grid)

    for (const role of ROLES) {
      const shape = shapes[role] ?? []
      const inked = shape.flatMap((ink, cell) => (ink ? [cell % grid] : []))
      expect(inked.length, `${role} has no ink to place`).toBeGreaterThan(0)

      const centre = inked.reduce((sum, column) => sum + column + 0.5, 0) / inked.length / grid
      expect(
        Math.abs(centre - 0.5),
        `the ${role} does not stand in the middle of its square`,
      ).toBeLessThan(CENTRE_TOLERANCE)

      expect(Math.min(...inked), `the ${role} runs off the left of its square`).toBeGreaterThan(0)
      expect(Math.max(...inked), `the ${role} runs off the right of its square`).toBeLessThan(
        grid - 1,
      )
    }
  })

  test('still draws the set that was vendored', async ({ page }) => {
    await open(page)
    const shapes = await silhouettes(page, SAMPLES.board)

    for (const role of ROLES) {
      const drawn = (shapes[role] ?? []).map((ink) => (ink ? '#' : '.')).join('')
      const reference = REFERENCE[role]
      expect(drawn.length, `${role} was not sampled`).toBe(reference.length)

      const matching = [...reference].filter((cell, index) => cell === drawn[index]).length
      expect(
        matching / reference.length,
        `the ${role} is no longer the shape that was vendored:\n${picture(drawn)}`,
      ).toBeGreaterThanOrEqual(FIDELITY)
    }
  })

  /**
   * The probe, on the same terms as the one in `greyscale-review.spec.ts`.
   *
   * Everything above is a claim about numbers this file computes, and a measurement that
   * quietly returned nothing would make most of them vacuous rather than red. So: the
   * sampler must see ink where ink is, see none where it is not, and score a shape against
   * itself as identical. If `isPointInFill` stopped answering, this is what says so.
   */
  test('the sampler can tell a shape from no shape', async ({ page }) => {
    await open(page)
    const shapes = await silhouettes(page, SAMPLES.board)
    const pawn = shapes['pawn'] ?? []

    expect(pawn.length).toBe(SAMPLES.board * SAMPLES.board)
    expect(difference(pawn, pawn), 'a shape differs from itself').toBe(0)

    const nothing = await page.evaluate((samples) => {
      const svg = document.querySelector('.learning-surface__board .board__canvas')
      const empty = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      empty.setAttribute('d', 'M0 0')
      svg?.append(empty)
      const cells: boolean[] = []
      for (let cell = 0; cell < samples * samples; cell += 1) {
        const x = ((cell % samples) + 0.5) / samples
        const y = (Math.floor(cell / samples) + 0.5) / samples
        cells.push(empty.isPointInFill(new DOMPoint(x, y)))
      }
      empty.remove()
      return cells
    }, SAMPLES.board)

    expect(coverage(nothing), 'the sampler reported ink in an empty path').toBe(0)
    expect(coverage(pawn), 'the sampler reported no ink in the pawn').toBeGreaterThan(0)
  })
})

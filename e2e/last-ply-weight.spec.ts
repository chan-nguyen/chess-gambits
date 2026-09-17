import { expect, test, type Page } from '@playwright/test'
import { MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import { lineSearch } from '../src/lib/line.ts'
import { darkeningOf, decodePng, edgeRunsOf, interiorOf, type At, type Frame } from './board-ink.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * **How heavy the last-ply marks are, measured on the rendered board (issue #80).**
 *
 * Every existing assertion about this highlight was green while the board drew an empty
 * square as a filled olive block inside a three-pixel near-black dashed ring — the loudest
 * object on the screen, standing for a square with nothing on it. They were green because
 * each of them read a declaration: a class name is applied, a token is referenced, two
 * computed styles differ. None of those changes when the line gets three times thicker.
 *
 * So this file does not read declarations. It photographs the board, decodes the PNG and
 * counts pixels (`./board-ink.ts`), and every claim it makes is a comparison between two
 * things in the same frame rather than a number somebody picked.
 *
 * **Two conditions at once, and they are the point of the ticket.** #72 gave the board
 * motion, so a learner pressing *next* watches the piece travel and the marks only repeat
 * what they saw. The marks exist for the two cases where that never happens: a `?line=` URL
 * opened cold, and `prefers-reduced-motion: reduce`. Every test below is both at the same
 * time — a fresh `goto` of a deep link in a context with the preference on — because that is
 * the learner for whom the mark is the only thing saying which piece moved.
 */

const CANVAS = '.learning-surface__board .board__canvas'
const LINE = ['fxe5']

/** The squares the board is drawing, read off the SVG rather than assumed from the FEN. */
type Geometry = {
  readonly from: At
  readonly to: At
  /** Every square with a piece on it and no last-ply ring — what a real piece weighs. */
  readonly pieces: readonly At[]
  /** Every empty, untinted, unmarked square of the same shade as the departed one. */
  readonly plain: readonly At[]
}

/**
 * `x === 0` and `y === 7` are dropped throughout: those are the squares the board draws a
 * rank number or a file letter on, and a glyph is ink that has nothing to do with a mark.
 */
const geometryOf = async (page: Page, canvas: string = CANVAS): Promise<Geometry> => {
  const read = await page.evaluate((canvas) => {
    const svg = document.querySelector(canvas)
    if (svg === null) throw new Error(`no ${canvas} on the page`)

    const key = (x: number, y: number): string => `${x},${y}`
    // A taken piece is a `use` too, and under reduced motion it is held at `opacity: 0`.
    // Counting its square as occupied would offer a piece that weighs nothing as the
    // faintest one on the board, which is a bar anything clears.
    const pieces = new Set(
      [...svg.querySelectorAll('use')]
        .filter((use) => !use.classList.contains('board__piece--gone'))
        .flatMap((use) => {
          const found = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(use.getAttribute('transform') ?? '')
          const [, x, y] = found ?? []
          return x === undefined || y === undefined ? [] : [key(Number(x), Number(y))]
        }),
    )

    /** The ring's own square: it is drawn inset, and the inset is less than half a square. */
    const ringAt = (selector: string) => {
      const ring = svg.querySelector(selector)
      if (ring === null) return undefined
      const x = Math.round(Number(ring.getAttribute('x')))
      const y = Math.round(Number(ring.getAttribute('y')))
      return { x, y }
    }

    const squares = [...svg.querySelectorAll('.board__square')].map((rect) => {
      const x = Number(rect.getAttribute('x'))
      const y = Number(rect.getAttribute('y'))
      return {
        x,
        y,
        light: rect.classList.contains('board__square--light'),
        // The base classes are `board__square` and its shade. A third one is a tint,
        // whatever a later ticket decides to call it.
        tinted: rect.classList.length > 2,
        piece: pieces.has(key(x, y)),
      }
    })

    return { from: ringAt('.board__last-ply--from'), to: ringAt('.board__last-ply--to'), squares }
  }, canvas)

  const { from, to } = read
  if (from === undefined || to === undefined) throw new Error('the board marks no last ply')

  const named = (at: At): boolean =>
    (at.x === from.x && at.y === from.y) || (at.x === to.x && at.y === to.y)
  const readable = read.squares.filter((square) => square.x > 0 && square.y < 7 && !named(square))
  const shade = read.squares.find((square) => square.x === from.x && square.y === from.y)?.light

  return {
    from,
    to,
    pieces: readable.filter((square) => square.piece && !square.tinted),
    plain: readable.filter((square) => !square.piece && !square.tinted && square.light === shade),
  }
}

const open = async (page: Page): Promise<void> => {
  await serveEntry(page, MAPPED_ENTRY)
  await page.goto(`vi/gambits/${MAPPED_ENTRY.id}${lineSearch(LINE)}`)
  await expect(page.locator(`${CANVAS} .board__last-ply`)).toHaveCount(2)
}

const frameOf = async (page: Page, canvas: string = CANVAS): Promise<Frame> =>
  decodePng(await page.locator(canvas).first().screenshot())

const desaturate = (page: Page): Promise<void> =>
  page.evaluate(() => {
    document.documentElement.style.filter = 'grayscale(1)'
  })

/** The lightest real piece in the frame — the bar an empty square has to get under. */
const faintestPiece = (frame: Frame, geometry: Geometry): number =>
  Math.min(...geometry.pieces.map((at) => darkeningOf(frame, at)))

const THEMES: readonly ('light' | 'dark')[] = ['light', 'dark']

for (const colorScheme of THEMES) {
  test.describe(`the last-ply marks in the ${colorScheme} theme`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' })

    test('the board it measures is the one the ticket describes', async ({ page }) => {
      await open(page)
      const frame = await frameOf(page)
      const geometry = await geometryOf(page)

      // 3...fxe5 leaves f6 and lands on e5, and neither is on an edge that carries a
      // coordinate. If a fixture change moves them, every measurement below moves with it.
      expect({ ...geometry.from }).toStrictEqual({ x: 5, y: 2 })
      expect({ ...geometry.to }).toStrictEqual({ x: 4, y: 3 })
      expect(geometry.plain.length).toBeGreaterThan(0)
      expect(geometry.pieces.length).toBeGreaterThan(8)
      expect(Math.abs(frame.width - frame.height)).toBeLessThanOrEqual(1)
    })

    /**
     * AC 1, first half, and the defect itself. A tint is a surface; the square a ply left
     * has nothing standing on it, so filling it drew a body where there is no piece.
     */
    test('leaves the departed square its own wood, pixel for pixel', async ({ page }) => {
      await open(page)
      const frame = await frameOf(page)
      const { from, plain } = await geometryOf(page)

      for (const square of plain) {
        expect(
          interiorOf(frame, from).equals(interiorOf(frame, square)),
          `the middle of the departed square differs from an ordinary ${square.x},${square.y}`,
        ).toBe(true)
      }
    })

    /**
     * AC 1, second half. "Reads as occupied" is not a feeling here: before #80 the empty
     * square carried **more** dark line than the knight beside it did, so the bar is that
     * it now carries less than the faintest piece anywhere in the same frame.
     */
    test('draws less dark line on the empty square than the faintest piece', async ({ page }) => {
      await open(page)
      const frame = await frameOf(page)
      const geometry = await geometryOf(page)

      const departed = darkeningOf(frame, geometry.from)
      const bar = faintestPiece(frame, geometry)
      expect(
        departed,
        `the empty square darkens itself by ${(departed * 100).toFixed(1)}%, ` +
          `the faintest piece darkens its own square by ${(bar * 100).toFixed(1)}%`,
      ).toBeLessThan(bar)
    })

    /**
     * AC 2. Nothing has animated: this page was opened at its `?line=` URL, in a context
     * that asks for reduced motion. Both marks are on the board anyway, and both are ink a
     * camera can see rather than a class a test can read.
     */
    test('marks both squares with nothing animating', async ({ page }) => {
      await open(page)
      const frame = await frameOf(page)
      const geometry = await geometryOf(page)

      expect(darkeningOf(frame, geometry.from)).toBeGreaterThan(0.01)
      expect(edgeRunsOf(frame, geometry.to)).toBe(1)
    })

    /**
     * AC 3, counted rather than read off `stroke-dasharray`. Desaturated, the tints are
     * within 1.3:1 of an ordinary square (`board-contrast.test.ts`), so the interruption in
     * one ring and the continuity of the other are the whole of what tells them apart.
     */
    test('tells the two rings apart by shape on a desaturated board', async ({ page }) => {
      await open(page)
      await desaturate(page)
      const frame = await frameOf(page)
      const geometry = await geometryOf(page)

      expect(edgeRunsOf(frame, geometry.from)).toBeGreaterThanOrEqual(3)
      expect(edgeRunsOf(frame, geometry.to)).toBe(1)
    })
  })
}

/**
 * **The probes.** Each one puts the defect back through the CSSOM and watches the matching
 * assertion above go red. Written through `element.style` rather than `setAttribute('style')`,
 * which #19's Content Security Policy refuses silently — a refused attribute changes nothing
 * and leaves a probe that proves nothing.
 *
 * One theme is enough: they are testing the instrument, not the palette.
 */
test.describe('the measurements can fail', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

  test('reports a fill behind the empty square', async ({ page }) => {
    await open(page)
    const geometry = await geometryOf(page)

    await page.evaluate(
      ({ canvas, at }) => {
        const square = [...document.querySelectorAll(`${canvas} .board__square`)].find(
          (rect) =>
            Number(rect.getAttribute('x')) === at.x && Number(rect.getAttribute('y')) === at.y,
        )
        if (square instanceof SVGElement) square.style.fill = 'rgb(201, 206, 110)'
      },
      { canvas: CANVAS, at: geometry.from },
    )

    const frame = await frameOf(page)
    const plain = geometry.plain[0]
    if (plain === undefined) throw new Error('no ordinary square to compare against')
    expect(interiorOf(frame, geometry.from).equals(interiorOf(frame, plain))).toBe(false)
  })

  test('reports a ring as heavy as the one #80 removed', async ({ page }) => {
    await open(page)

    await page.evaluate((canvas) => {
      for (const ring of document.querySelectorAll(`${canvas} .board__last-ply`)) {
        if (ring instanceof SVGElement) ring.style.strokeWidth = '0.045'
      }
      const from = document.querySelector(`${canvas} .board__last-ply--from`)
      if (from instanceof SVGElement) from.style.strokeDasharray = '0.18 0.12'
    }, CANVAS)

    const frame = await frameOf(page)
    const geometry = await geometryOf(page)
    expect(darkeningOf(frame, geometry.from)).toBeGreaterThan(faintestPiece(frame, geometry))
  })

  test('reports two solid rings as one shape', async ({ page }) => {
    await open(page)
    await desaturate(page)
    expect(edgeRunsOf(await frameOf(page), (await geometryOf(page)).from)).toBeGreaterThanOrEqual(3)

    await page.evaluate((canvas) => {
      const from = document.querySelector(`${canvas} .board__last-ply--from`)
      if (from instanceof SVGElement) from.style.strokeDasharray = 'none'
    }, CANVAS)

    expect(edgeRunsOf(await frameOf(page), (await geometryOf(page)).from)).toBe(1)
  })
})

/**
 * **The choice boards, where the departed square's ring is the whole of the signal.**
 *
 * Everything above measures the main board under conditions that switch motion off. A
 * branch's previews need no such setup: they *cannot* animate. `BoardPreview.css` pins
 * `transition: none` on their pieces and no caller passes them `arrivedFrom`, so for these
 * boards AC 2 is not a case to check — it is the only way they are ever read. And the
 * departed square has nothing else: no tint since #80, and no piece by definition.
 *
 * They stay legible at 96px because `BoardPreview.css` overrides the stroke to 0.1 user
 * units, and #80 turned that override from a detail into the load-bearing thing: against the
 * old 0.045 base it was 2.2x, against 0.016 it is 6.25x. Remove it and a preview ring is a
 * fifth of a CSS pixel — a smudge with no dashes in it — while every other assertion in this
 * file and every unit test in the repository stays green, because each of them reads the
 * main board or reads a declaration. That is the same shape of blind spot #80 itself was.
 *
 * **Only the departed square is measured here, and deliberately.** At 96px the arrival
 * ring lands as a single antialiased row about 20% darker than what is under it, which is
 * under `edgeRunsOf`'s cut-off — so a count of its runs would be reading the instrument
 * rather than the board. That square is not the one at risk: it carries a tint and a piece
 * as well. The departed square's ring reads cleanly at this size (its dashes reach 86%
 * darker with the gaps at 0%), and it is the square with nothing else to say it.
 */
test.describe('a branch choice preview, at the size the marks are hardest at', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

  const PREVIEW = '.board-preview .board__canvas'

  /** The branch node itself: no line, so the root's replies are drawn as choices. */
  const openBranch = async (page: Page): Promise<void> => {
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`vi/gambits/${MAPPED_ENTRY.id}`)
    await expect(page.locator(`${PREVIEW} .board__last-ply`).first()).toBeVisible()
  }

  test('is the board this describe claims it is', async ({ page }) => {
    await openBranch(page)
    const frame = await frameOf(page, PREVIEW)

    // 96px of preview, drawn by the same renderer as the 646px board above.
    expect(frame.width).toBeLessThan(150)
    expect(Math.abs(frame.width - frame.height)).toBeLessThanOrEqual(1)
    expect(await page.locator('.board-preview').count()).toBeGreaterThan(1)
  })

  test('leaves the departed square its own wood here too', async ({ page }) => {
    await openBranch(page)
    const frame = await frameOf(page, PREVIEW)
    const { from, plain } = await geometryOf(page, PREVIEW)

    for (const square of plain) {
      expect(
        interiorOf(frame, from).equals(interiorOf(frame, square)),
        `the middle of the departed square differs from an ordinary ${square.x},${square.y}`,
      ).toBe(true)
    }
  })

  /**
   * AC 3 at 96px. Two runs rather than the main board's three: the edge the count reads is
   * 0.7 of a square, which is about 8px here, and the preview's dash period is 4.4px — so a
   * dashed ring shows two marks along it. One run, or none, is a ring that has stopped being
   * dashed, and at this size there is nothing else on that square to say a ply left it.
   */
  test('still breaks the dashed ring on the departed square, desaturated', async ({ page }) => {
    await openBranch(page)
    await desaturate(page)
    const frame = await frameOf(page, PREVIEW)
    const { from } = await geometryOf(page, PREVIEW)

    expect(
      edgeRunsOf(frame, from),
      'the dashed ring on the departed square has stopped being dashed',
    ).toBeGreaterThanOrEqual(2)
  })
})

import { expect, test, type Page } from '@playwright/test'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'
const analysis = `${basePath}vi/${routeSegments.analysis}`

/**
 * The analysis board slides its pieces as the gambit page's does (#72), and its move list is
 * readable when the moves are long.
 *
 * The slide is watched the way `piece-animation.spec.ts` watches it and for the same reason:
 * where every piece is *painted*, once a frame, read from the computed transform. Nothing here
 * reads a stylesheet, so a `transition` declaration cannot satisfy it. A piece is in flight if
 * it was seen at a fraction of a square, which only an animation produces.
 */

const WATCH_MS = 450

type Frame = {
  readonly x: number
  readonly y: number
  readonly shown: boolean
  readonly gone: boolean
}

/** Every piece on the board, tracked by element, from now until `finish` is called. */
const record = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const seen = new Map<Element, Frame[]>()
    let live = true
    const tick = (): void => {
      if (!live) return
      for (const piece of document.querySelectorAll('.analysis-surface .board__piece')) {
        const style = getComputedStyle(piece)
        const matrix = new DOMMatrix(style.transform)
        const frames = seen.get(piece) ?? []
        if (!seen.has(piece)) seen.set(piece, frames)
        frames.push({
          x: matrix.e,
          y: matrix.f,
          shown: Number(style.opacity) > 0,
          gone: piece.classList.contains('board__piece--gone'),
        })
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    Reflect.set(window, 'finishRecording', () => {
      live = false
      return [...seen.values()]
    })
  })

const finish = async (page: Page): Promise<readonly (readonly Frame[])[]> => {
  await page.waitForTimeout(WATCH_MS)
  return page.evaluate(() => Reflect.get(window, 'finishRecording')())
}

const inFlight = (track: readonly Frame[]): boolean =>
  track.some(({ x, y }) => Math.abs(x - Math.round(x)) > 0.02 || Math.abs(y - Math.round(y)) > 0.02)

/** The squares a track ends on, `a8` being `(0, 0)`. */
const end = (track: readonly Frame[]): string => {
  const last = track.at(-1)
  return `${'abcdefgh'[Math.round(last?.x ?? Number.NaN)] ?? '?'}${8 - Math.round(last?.y ?? Number.NaN)}`
}

/** The centre of a square on screen, where a real mouse presses it. */
const centre = async (page: Page, square: string): Promise<{ x: number; y: number }> => {
  const box = await page.locator(`.analysis-surface [data-square="${square}"]`).boundingBox()
  if (box === null) throw new Error(`no square ${square}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const open = async (page: Page, moves: string): Promise<void> => {
  await page.goto(`${analysis}?moves=${moves}`)
  await expect(page.locator('.analysis-surface .board__piece').first()).toBeVisible()
}

/** Every piece the ply took and the board still drew after the mover had landed. */
const strays = (tracks: readonly (readonly Frame[])[]): number =>
  tracks.filter((track) => track.some(({ gone, shown }) => gone && shown)).length

test('stepping through the line slides the piece, in both directions', async ({ page }) => {
  await open(page, 'e4_e5_Nf3_Nc6')

  await record(page)
  await page.getByRole('link', { name: vi.analysis.previous }).click()
  const back = (await finish(page)).filter(inFlight)
  expect(back.map(end), 'the knight goes back from c6 to b8').toStrictEqual(['b8'])

  await record(page)
  await page.getByRole('link', { name: vi.analysis.next }).click()
  const forward = (await finish(page)).filter(inFlight)
  expect(forward.map(end), 'and forward again').toStrictEqual(['c6'])
})

test('a move played by clicking slides the piece, and keeps the one it took until it lands', async ({
  page,
}) => {
  await open(page, 'e4_d5')

  await page.locator('.analysis-surface [data-square="e4"]').click()
  await record(page)
  await page.locator('.analysis-surface [data-square="d5"]').click()
  const tracks = await finish(page)

  expect(tracks.filter(inFlight).map(end), 'the pawn slides to d5').toStrictEqual(['d5'])
  expect(strays(tracks), 'the taken pawn is drawn while it does').toBe(1)
})

test('a move dropped by the mouse is not slid again, and no taken piece comes back', async ({
  page,
}) => {
  await open(page, 'e4_d5')
  const from = await centre(page, 'e4')
  const to = await centre(page, 'd5')

  await record(page)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  const tracks = await finish(page)

  await expect(page).toHaveURL(/moves=e4_d5_exd5$/)
  expect(strays(tracks), 'a pawn was drawn on d5 that had already been taken').toBe(0)
  // The piece in the hand follows the mouse for the eight steps and is the only thing seen
  // between squares: the dropped piece is not slid from e4 again once the position arrives.
  expect(tracks.filter(inFlight)).toHaveLength(1)
})

test('every row of the move list is readable, long moves and castling included', async ({
  page,
}) => {
  await open(
    page,
    'd4_d5_e4_dxe4_Nc3_Nf6_f3_exf3_Qxf3_Qxd4_Be3_Qb4_O-O-O_Bg4_Nb5_Na6_Qxb7_Qe4_Qxa6_Bxd1_Kxd1_Rd8%2B_Bd2_Rxd2%2B_Kxd2_Qf4%2B',
  )

  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 })
    /*
     * The boxes of the numbers and the moves themselves, not of the rows that hold them: a row
     * that was too narrow for what was in it kept the width of its column, and it was the
     * text that ran out under the next row.
     */
    const marks = await page
      .locator('.analysis-moves__number, .analysis-moves__move')
      .evaluateAll((items) =>
        items.map((item) => {
          const { left, right, top, bottom } = item.getBoundingClientRect()
          // One box per move, unless it broke across lines (`O-O-O` at its hyphens).
          return {
            text: item.textContent ?? '',
            left,
            right,
            top,
            bottom,
            boxes: item.getClientRects().length,
          }
        }),
      )

    expect(marks.length, `at ${width}px`).toBe(13 + 26)
    for (const [index, one] of marks.entries()) {
      expect(one.boxes, `${one.text} broke across lines at ${width}px`).toBe(1)
      for (const other of marks.slice(index + 1)) {
        const apart =
          one.right <= other.left ||
          other.right <= one.left ||
          one.bottom <= other.top ||
          other.bottom <= one.top
        expect(apart, `${one.text} and ${other.text} overlap at ${width}px`).toBe(true)
      }
    }
  }
})

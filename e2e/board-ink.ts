import { inflateSync } from 'node:zlib'

/**
 * **A rendered board, read back as pixels.**
 *
 * This exists because of what #80 was: a highlight whose every assertion was green while
 * the thing on screen was wrong. `Board.test.tsx` checked that the class was applied,
 * `board-contrast.test.ts` checked that the colour it resolved to was a documented token,
 * and `e2e/move-navigation.spec.ts` checked that the two rings' computed styles differed.
 * All three are true of a hairline and of a three-pixel block of near-black around an empty
 * square, and this repository has already deleted two gates for certifying without looking.
 *
 * So the measure here is **ink**: the fraction of a square's pixels darker than `INK` on the
 * WCAG relative-luminance scale. Two properties make it the right one.
 *
 * - **It is hue-free**, on exactly the argument `board-contrast.test.ts` makes about
 *   luminance, so every number below is a greyscale number whether or not the page was
 *   desaturated first.
 * - **It is comparable across squares in the same frame.** A mark's weight means nothing on
 *   its own; it means something against the pieces beside it. "The empty square carries less
 *   dark line than the faintest piece on the board" is a claim that fails when the mark is
 *   too heavy and does not depend on a number somebody chose.
 *
 * The decoder is thirty lines of `node:zlib` rather than a dependency. Chromium's screenshots
 * are 8-bit truecolour, non-interlaced PNG, which is the one shape it has to read; anything
 * else throws rather than guessing.
 */

export type Frame = { readonly width: number; readonly height: number; readonly rgb: Buffer }

/** A square by its board indices: x counts files from the left edge, y ranks from the top. */
export type At = { readonly x: number; readonly y: number }

const byte = (buffer: Buffer, index: number): number => buffer[index] ?? 0

/** The five PNG filters, undone in place against the row above and the pixel to the left. */
const unfilter = (raw: Buffer, width: number, height: number): Buffer => {
  const stride = width * 3
  const rgb = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = byte(raw, y * (stride + 1))
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 3 ? byte(rgb, y * stride + x - 3) : 0
      const up = y > 0 ? byte(rgb, (y - 1) * stride + x) : 0
      const corner = x >= 3 && y > 0 ? byte(rgb, (y - 1) * stride + x - 3) : 0
      const value = byte(raw, y * (stride + 1) + 1 + x)
      const guess = left + up - corner
      const [dl, du, dc] = [Math.abs(guess - left), Math.abs(guess - up), Math.abs(guess - corner)]
      const paeth = dl <= du && dl <= dc ? left : du <= dc ? up : corner
      const deltas = [0, left, up, (left + up) >> 1, paeth]
      rgb[y * stride + x] = (value + (deltas[filter] ?? 0)) & 0xff
    }
  }
  return rgb
}

export const decodePng = (png: Buffer): Frame => {
  const parts: Buffer[] = []
  let width = 0
  let height = 0
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'IHDR') {
      width = png.readUInt32BE(offset + 8)
      height = png.readUInt32BE(offset + 12)
      const shape = [byte(png, offset + 16), byte(png, offset + 17), byte(png, offset + 20)]
      if (shape.join() !== [8, 2, 0].join()) {
        throw new Error(`expected 8-bit truecolour non-interlaced PNG, got ${shape.join('/')}`)
      }
    }
    if (type === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + length))
    offset += 12 + length
  }
  if (width === 0) throw new Error('no IHDR: this is not a PNG')
  return { width, height, rgb: unfilter(inflateSync(Buffer.concat(parts)), width, height) }
}

const linear = (value: number): number => {
  const scaled = value / 255
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.2 relative luminance, which carries no hue — see the header. */
const luminanceAt = (frame: Frame, x: number, y: number): number => {
  const index = (y * frame.width + x) * 3
  return (
    0.2126 * linear(byte(frame.rgb, index)) +
    0.7152 * linear(byte(frame.rgb, index + 1)) +
    0.0722 * linear(byte(frame.rgb, index + 2))
  )
}

/**
 * How much darker than its own plain colour a pixel has to be before it counts as a line
 * somebody drew rather than the antialiasing of one. Only `edgeRunsOf` needs a cut-off;
 * `darkeningOf` has none, which is the point of it.
 */
const INK = 0.6

/** The frame holds exactly the 8x8 board, so a square is a width-eighth of it. */
const edge = (frame: Frame): number => frame.width / 8

/** The pixel box of one square, as integers so two squares round the same way. */
const boxOf = (frame: Frame, at: At) => {
  const size = edge(frame)
  const span = Math.round(size)
  return { x0: Math.round(at.x * size), y0: Math.round(at.y * size), span }
}

/**
 * A square's own colour, taken as the median luminance of its pixels.
 *
 * The median rather than a token, because the square may legitimately be tinted, and
 * because reading the answer out of the stylesheet would be the certifying-without-looking
 * this file exists to avoid. Nothing the board draws on a square covers half of it — the
 * fullest piece in the set is well under that — so the middle value is the square.
 */
const plainOf = (frame: Frame, at: At): number => {
  const { x0, y0, span } = boxOf(frame, at)
  const values: number[] = []
  for (let y = y0; y < y0 + span; y += 1) {
    for (let x = x0; x < x0 + span; x += 1) values.push(luminanceAt(frame, x, y))
  }
  values.sort((one, other) => one - other)
  return values[Math.floor(values.length / 2)] ?? 0
}

/**
 * **How much dark a square has had added to it**, as a fraction of its own brightness:
 * the mean over its pixels of how far each one falls below the square's plain colour.
 *
 * A threshold was the obvious first implementation and it was wrong twice over. A hairline
 * that half-covers a pixel either crosses the cut-off or does not, so the number jumped with
 * the board's size; and because the dark theme's dark square is itself close to any absolute
 * cut-off, the same line measured half again as heavy there as in the light theme. This is
 * linear in how much of a pixel the line covers and is normalised to the square underneath,
 * so a mark measures the same in both themes and at any size — which is what makes comparing
 * two squares in the same frame mean something.
 */
export const darkeningOf = (frame: Frame, at: At): number => {
  const plain = plainOf(frame, at)
  if (plain <= 0) return 0
  const { x0, y0, span } = boxOf(frame, at)
  let darkening = 0
  for (let y = y0; y < y0 + span; y += 1) {
    for (let x = x0; x < x0 + span; x += 1) {
      darkening += Math.max(0, plain - luminanceAt(frame, x, y)) / plain
    }
  }
  return darkening / (span * span)
}

/**
 * The middle 40% of a square, as bytes.
 *
 * Wide enough to catch any fill behind the square and narrow enough to miss everything that
 * is legitimately drawn near its edges: the last-ply ring at a 0.06 inset, and the rank and
 * file coordinates in the top-left and bottom-right corners.
 */
export const interiorOf = (frame: Frame, at: At): Buffer => {
  const size = edge(frame)
  // A fixed span rather than two rounded edges, so two squares always return the same
  // number of bytes and `equals` compares them rather than their rounding.
  const span = Math.round(0.4 * size)
  const [x0, y0] = [Math.round((at.x + 0.3) * size), Math.round((at.y + 0.3) * size)]
  const rows: Buffer[] = []
  for (let y = y0; y < y0 + span; y += 1) {
    rows.push(frame.rgb.subarray((y * frame.width + x0) * 3, (y * frame.width + x0 + span) * 3))
  }
  return Buffer.concat(rows)
}

/**
 * How many separate runs of ink the top edge of a square's last-ply ring breaks into: one
 * for a solid ring, several for a dashed one.
 *
 * This is the shape channel counted in pixels rather than read off `stroke-dasharray`. The
 * row is the inkiest one in the band the ring is drawn in, so it does not depend on where
 * antialiasing put the line, and the span stops short of both corners so that the ring's
 * own vertical sides are not joined onto the ends.
 */
export const edgeRunsOf = (frame: Frame, at: At): number => {
  const size = edge(frame)
  const dark = plainOf(frame, at) * INK
  const isInk = (x: number, y: number): boolean => luminanceAt(frame, x, y) < dark
  const [x0, x1] = [Math.round((at.x + 0.15) * size), Math.round((at.x + 0.85) * size)]
  const inkIn = (y: number): number => {
    let ink = 0
    for (let x = x0; x < x1; x += 1) if (isInk(x, y)) ink += 1
    return ink
  }
  const runsIn = (y: number): number => {
    let runs = 0
    // `x === x0` opens a run rather than continuing one, so a ring that is already inked
    // where the span starts is counted once instead of not at all.
    for (let x = x0; x < x1; x += 1) {
      if (isInk(x, y) && (x === x0 || !isInk(x - 1, y))) runs += 1
    }
    return runs
  }
  const rows = []
  for (let y = Math.round((at.y + 0.02) * size); y <= Math.round((at.y + 0.11) * size); y += 1) {
    rows.push({ y, ink: inkIn(y) })
  }
  const best = rows.reduce((one, other) => (other.ink > one.ink ? other : one), { y: 0, ink: -1 })
  return best.ink === 0 ? 0 : runsIn(best.y)
}

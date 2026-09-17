import { PIECE_ROLES, shapeId } from './board-model'
import type { PieceRole } from './board-model'

/**
 * The twelve pieces as one inline sprite.
 *
 * Inlined, never fetched: a network request for a piece would breach requirement N8
 * (zero third-party requests) outright, and there is no URL here to fetch from.
 *
 * Six `<symbol>` shapes rather than twelve. A piece's *role* is carried by its
 * silhouette and its *colour* by fill and stroke, which `<use>` inherits into the
 * referenced shape — so `whiteKnight` and `blackKnight` share one outline and differ by
 * a light body with a dark outline against a dark body with a light one. That inverts
 * cleanly in greyscale, which is what `board-contrast.test.ts` asks for, and it halves
 * the sprite.
 *
 * **Origin and licence.** The shapes are Maurizio Monge's `celtic` set from
 * https://github.com/maurimo/chess-art, MIT, vendored from the copy lichess distributes at
 * `public/piece/celtic` and listed as an MIT exception in that project's `COPYING.md`.
 * The copyright and permission notice the MIT licence requires is reproduced in `NOTICE`
 * and credited on the About page. It was chosen over `chessnut` (Apache 2.0),
 * `rhosgfx` (CC0), `spatial` and `fantasy` (both MIT, same author) on legibility at the
 * 12px-a-square the branch previews render; `cburnett` and `merida` are GPLv2+ and the
 * whole sadsnake1 family is CC BY-NC-SA, so neither was available. `NOTICE` records the
 * comparison.
 *
 * **What was changed, and why it had to be.** Monge draws each piece as a *boundary* path,
 * a *main* path with the same geometry, and decorative line work; the set is built to be
 * recoloured, and its own source ships `#ff0000` and `#00ff00` as stroke and fill
 * placeholders. So: `boundary` and the blurred drop shadow are dropped — the first is
 * duplicate geometry that the board's own outline already draws, the second is thirty-two
 * Gaussian blurs on a page that mounts twenty boards — every colour is removed so fill and
 * stroke come from the design tokens, and each role's decorative paths are concatenated
 * into one.
 *
 * Concatenating needs one care. A path that opens with a relative moveto — the knight's
 * body and the rook's first decorative path — starts from wherever the path before it
 * ended once it is no longer first, so each of those is prefixed with `M0 0` to pin it
 * back to the origin. Not by uppercasing the `m`: a moveto's implicit trailing coordinate
 * pairs are linetos of the same kind, so that would turn every one of them absolute and
 * destroy the shape. It looks right in a diff and draws a scribble.
 *
 * Shapes are drawn on Monge's 933-unit grid rather than the conventional 45-unit one,
 * which is why `Board.css` sets a stroke width in the hundreds of a piece box rather than
 * the tenths it used to. `<symbol>` scales each one into a single board square.
 *
 * The two halves of an entry are separated by `|`, which SVG path data cannot contain.
 * One string per role rather than two records keeps the sprite inside the line budget
 * ADR-0003's tripwire sets for the whole board (`board-tripwire.test.ts`).
 */
const SHAPES: Readonly<Record<PieceRole, string>> = {
  king: 'M422 56c-7 24 3 53 2 83l-94-4v93l92-4-5 105-43-3C189 247 38 189 177 445c13 23 75 75 39 110 14 37 45 29 63 72 7 19 11 92-29 117-6 3-66 18-70 24-33 41-15 110 45 114 42 2 453 3 497-2 67-7 77-77 46-116-4-6-57-14-72-25-27-20-41-87-34-112 9-39 45-36 55-68-57-41 31-83 45-110 133-252 2-202-189-122l-48 1-5-104 91 4v-93l-93 4c-3-28 10-63 2-83z|M696 880c67-7 81-68 50-107-4-6-52-9-67-20-27-20-42-101-36-126 10-39 36-36 46-68-47-45 31-74 45-100 133-253 41-194-171-119l-52-1-5-130 87 4 2-67-90 2c-6-29 11-58 3-82m-91 146-75-1M258 560c152 17 275 15 382 0M311 728h242zm-56 65h429zM376 335c-55-13-170-60-216-59-13 0-21 4-22 13m72 176c58 71 494 59 555-95',
  queen:
    'M593 82c-29 0-53 22-53 48 0 17 10 32 25 41-43 105-76 239-108 240-44 0-70-137-99-236 15-8 26-24 26-41 0-27-24-48-53-48s-52 21-52 48c0 23 18 42 42 46 10 109 28 237-10 259-39 23-84-108-150-212 8-9 13-20 13-32 0-26-23-48-52-48s-52 22-53 48c-2 41 44 48 53 48 50 127 52 174 80 292 10 39 46 39 63 81 8 19 11 93-28 117-6 4-65 19-69 24-32 41-15 110 45 114 43 3 450 4 493-1 67-8 78-78 47-116-5-6-56-14-71-25-27-20-40-88-34-113 10-39 47-35 56-68 38-140 36-179 97-305h4c29 0 53-21 53-48 0-26-24-48-53-48s-53 22-53 48c0 13 6 24 14 32-76 95-128 230-165 209-44-25-10-144 5-260 23-5 39-24 39-46 0-26-23-48-52-48|M284 578h317zm12 140h243zm-55 74h428zM590 440c-53-47-15-146-2-264 22-6 39-24 39-46 0-27-24-39-53-39m111 780c67-7 78-68 47-107-5-6-56-13-71-24-27-20-40-107-34-132 10-39 44-35 54-68 42-140 38-170 99-296h4c29 0 55-21 55-47 0-27-24-39-53-39',
  rook: 'M775 112H649v81l-114 9v-80l-131 1v81l-109-11v-81l-117 3c-12 98 48 121 7 191l101 53c5 107 28 247 19 315-35 27 32 53-55 71-10 2-58 9-62 14-32 41-15 110 45 114 43 3 432 3 476-2 67-7 77-77 46-116-4-6-42-12-59-15-78-13-19-43-54-62-11-74 9-210 20-320l104-51c-32-77 20-88 9-195|M0 0m239 277 389 2zm100 81h215zm0 331h243Zm-80 86h429ZM670 871c67-7 100-61 69-99-5-6-43-16-60-19-78-13-21-56-56-75-11-74 11-223 23-333l99-51c-28-59 21-100 9-182',
  bishop:
    'M468 50c-34 0-62 23-62 52 0 8 2 16 6 23-71 20-122 79-122 164 3 78 42 150 105 194-63 25-3 53-3 118-46 83-62 91-140 149-6 4-52 9-57 14-32 42-15 110 46 114 42 3 417 4 460-1 67-7 78-78 47-116-5-6-52-12-59-16-61-33-139-82-160-144 0-65 71-93 8-118 65-45 102-110 109-194 4-46-21-92-60-125l-65 146c-6 15-23 21-38 15-15-7-22-24-15-39l67-153a197 197 0 0 0-13-5c5-8 8-17 8-26 0-29-28-52-62-52|M413 510h105zm-20 200h145zm-100 80h355zM350 410c40 48 237 35 287-129M685 867c67-7 77-49 46-88-5-6-52-11-58-15-62-34-139-92-160-153 0-66 70-113 7-137 65-45 102-110 110-195 4-46-5-52-44-85',
  knight:
    'M0 0m394 44-24 83-59-68-4 89c-91 91-38 111-172 316-9 13-25 24-29 42-15 80 88 60 106 69 71-57 100-58 137-98 42 15 108-3 147-45-26 77-136 132-169 267 39 37 0 74-47 71-52 12-34 109 19 109l452-3c63 0 72-92 30-108-40 0-58-41-26-69 4-74 3-143-12-214-2-7 2-22 10-24-6-23-30-45-40-69-5-11-18-17 19-18-11-22-61-58-76-78-6-7 25-13 19-19-35-37-85-50-109-68-8-6 23-15 14-21-33-21-102-48-145-65z|M336 282c-28 2-50 16-65 41M310 316c12 8 25 5 22-12M155 501c-13-5-23 17-15 17M508 405c10-13 9-19 11-27M644 699H370zm64 64H360zM723 876c63 0 78-76 36-92-39 0-58-60-25-88 3-74 3-143-13-213-2-7 2-23 11-24-7-24-31-36-41-60-5-12-18-17 20-19-12-21-61-57-77-77-5-7 25-13 19-20-34-36-84-49-109-68-8-6 23-14 15-20-33-22-81-55-124-72',
  pawn: 'M464 200c-72 1-130 58-135 124-2 33 46 89 74 106-138 31-3 71-3 128 0 40-53 66-24 91-16 64-63 88-119 114-28 35-13 95 39 98 37 3 307 3 345-1 59-6 68-67 41-101-57-17-119-42-131-108 30-26-32-53-32-93 0-57 150-90 7-128 27-17 72-73 73-106 1-65-66-125-135-124|M618 864c58-7 67-58 40-92-57-18-118-52-131-118 30-25-31-52-31-93 0-57 150-90 6-127 28-18 72-74 73-107 2-65-58-120-127-119M417 466h94zm-9 162h112zm-99 153h320z',
}

/** Monge's grid. Not the conventional 45-unit one — see above. */
const VIEW_BOX = '0 0 933 933'

export const PieceSprite = ({ spriteId }: { readonly spriteId: string }) => (
  <>
    {PIECE_ROLES.map((role: PieceRole) => {
      const [body, detail] = SHAPES[role].split('|')
      return (
        <symbol key={role} id={shapeId(spriteId, role)} viewBox={VIEW_BOX}>
          <path className="board__piece-body" d={body} />
          <path className="board__piece-detail" d={detail} />
        </symbol>
      )
    })}
  </>
)

# 0003. Render the board ourselves, in SVG

A ~64-rect SVG board, written here, renders every position. `react-chessboard` was chosen first and
then reversed on evidence: this board never accepts a dragged piece in v1, so a drag-and-drop library
is 21.9 KB of machinery for a capability the product does not have — and the accessibility model the
project actually requires has to be built by hand either way.

## Status

accepted — **supersedes the original choice of `react-chessboard`**, reversed 2026-09-16 after an
adversarial review.

## Why the first answer was wrong

The original ADR compared board libraries on drag support, arrows, flipping and touch handling, and
picked `react-chessboard` 5.12.1 (MIT) over `@lichess-org/chessground` (GPL-3.0-or-later) on licence.
The licence analysis stands and is unchanged. The comparison did not.

Three things the review made plain:

- **Nothing in requirements F1–F15 lets a learner move a piece.** The tree prescribes every move.
  `Board`'s own specification is that a derived FEN comes in. The drag system is unused, and so is
  the promotion dialogue whose absence the original ADR listed as a known cost.
- **The accessibility floor is not what a drag library provides.** `design-system.md` requires every
  square reachable, the current square announced with its piece, and a live region for each move.
  That is a `role="grid"` of 64 cells with roving tabindex — not focusable draggables. Building an
  accessible layer on top of a library whose 21.9 KB is drag machinery is the worst of both.
  Separately, `@dnd-kit`'s own screen-reader announcements are English strings, which on a Vietnamese
  or French page is an i18n failure as well as an accessibility one.
- **The budget does not have the room.** Measured: Vite + React baseline 67.8 KB, i18next stack
  23.4 KB, React Router ~15–20 KB. That is ~107–111 KB of a 200 KB budget before any product code,
  with boundary validation, catalogue search, tree layout and the Vietnamese string bundle still to
  come. 21.9 KB spent on unused drag handling is the easiest 11% to recover.

There is also a compounding cost the original missed. Requirement F5 renders one preview board per
branch choice, so a node with several replies mounts several boards at once — each one a `DndContext`
with its own listeners. An SVG board is 64 rects and up to 32 piece references, and mounting twenty
is unremarkable.

## What we build

- 64 `<rect>` squares plus `<use>` references into one inline sprite of twelve piece shapes.
- Semantics first: `role="grid"`, one row per rank, roving tabindex, each cell labelled with its
  square and occupant in the active locale, one polite live region per board group.
- Flip is a transform. Highlights, check indication and teaching arrows are overlay elements.
- Coordinates and sizing are CSS; the board is a square that scales to its container.
- Piece shapes come from a permissively licensed open set, inlined at build time — which also
  guarantees requirement N8, because there is no URL to fetch from.

Roughly 2 KB shipped, and no runtime dependency.

## Considered options

| Option                          | Licence              | gzip      | Gives us the accessible grid | Drag we do not need |
| ------------------------------- | -------------------- | --------- | ---------------------------- | ------------------- |
| **Own SVG board**               | ours                 | **~2 KB** | Yes, by construction         | None                |
| react-chessboard 5.12.1         | MIT                  | 21.9 KB   | No — must be built anyway    | 21.9 KB of it       |
| cm-chessboard 8.14.0            | MIT                  | 8.4 KB    | No                           | Some                |
| @lichess-org/chessground 10.1.1 | **GPL-3.0-or-later** | 12.1 KB   | No                           | Some                |

**Why this one:** the requirement is to _display_ positions accessibly and render many at once. That
is a small, well-understood rendering problem, and every library on the list solves a larger problem
we do not have while leaving the accessibility work undone.

**Why not the others:** chessground remains the best board and remains GPL-3.0-or-later, which would
force the whole application under the GPL — a public repository is not GPL compliance, and
relicensing later needs every contributor's consent. react-chessboard and cm-chessboard are both fine
libraries bought for the wrong problem.

## Consequences

- **We own a board renderer.** That is a real maintenance obligation, taken deliberately. It is
  bounded: no move generation, no rules, no drag, no animation beyond a CSS transition.
- **v2's practice mode needs click-to-move, not drag** — a learner taps a piece then a square. That
  is straightforward on an SVG grid, and it is the interaction a touch device wants anyway.
- Piece-name localisation is now ours to do, which is correct: `design-system.md` says SAN is never
  localised, but a screen reader saying "white knight on f3" must speak the learner's language.
- **Tripwire:** if the board exceeds roughly 400 lines or starts growing rules logic, that is the
  signal it was the wrong call. `cm-chessboard` (MIT, 8.4 KB) is the pre-selected fallback and
  swapping it in is a single-component change.
- The licence question returns if an engine is ever _shipped_ to the browser: Stockfish is GPL-3.0
  and lichess's WASM build AGPL-3.0. ADR-0010 keeps that decision open; ADR-0005 shows the engine is
  useful in the build without shipping anything.

## What would change this

The board growing beyond its bounded remit, or v2 requiring drag interaction after all.

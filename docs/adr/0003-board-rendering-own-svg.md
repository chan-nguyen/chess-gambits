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

**Amended by #71: roughly 4 KB.** The 2 KB above was measured against six hand-drawn
silhouettes, which #71 replaced with Maurizio Monge's `celtic` set (MIT — see `NOTICE`)
because the hand-drawn ones did not look like a chess set to a learner. Measured on the
built bundle, the vendored sprite costs **1.78 KB gzipped**, so the board is now about 4 KB
rather than 2 KB. The comparison the table below rests on is unaffected — it is still a
third of `cm-chessboard` and a fifth of `react-chessboard`, and it still buys the accessible
grid neither of them provides — and the enforced number, the 200 KB route budget in
`docs/performance-budgets.md`, moved from 132.5 KB to 134.9 KB.

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
- **Tripwire, as amended by #79:** two conditions, and they are not the same kind of signal. **Any
  rules logic** in `src/components/board/` — move generation, a legality test, check detection,
  `chess.js` — means the bet was wrong; `cm-chessboard` (MIT, 8.4 KB) is the pre-selected fallback
  and swapping it in is a single-component change. **Separately**, the board's shipped code passing
  **450 lines** with comments and blanks stripped is a signal to measure and decide, not to swap.
  `board-tripwire.test.ts` enforces both. The number was 400; the section below says why it moved
  and why only the rules half is a swap trigger.
- The licence question returns if an engine is ever _shipped_ to the browser: Stockfish is GPL-3.0
  and lichess's WASM build AGPL-3.0. ADR-0010 keeps that decision open; ADR-0005 shows the engine is
  useful in the build without shipping anything.

## Amended by #79: the count was measuring the board's existence, not its growth

The count arrived — 399 of 400 — and was spent on deciding rather than on whoever needed the next
two lines. Three things were measured before deciding anything, with the tripwire's own
`codeLineCount`, which strips comments and blanks.

**The board has grown ten lines in its life.** Not the two features' worth of headroom the ticket
assumed:

| Commit    | What landed                     | Code lines    |
| --------- | ------------------------------- | ------------- |
| `666feac` | the board's first commit (#26)  | **389**       |
| `5784491` | the `celtic` artwork (#71)      | 389 (+0)      |
| `a3a03e4` | the slide between squares (#72) | **399** (+10) |

The artwork cost nothing measurable: it replaced path data in place, and all of its growth was the
comment block and `NOTICE`, which the tripwire strips by design. The motion cost ten lines for a
full animation. So the board was _written_ at 389 against a limit of 400, and 400 was chosen before
the board existed. A budget with eleven lines of resolution never measured growth; it reported that
the thing had been built. That is what arrived, and it is not the signal this ADR wanted.

**The rules half has not been tripped, checked rather than assumed.** There is no move generation,
no legality test, no check detection — `check` is a `Square` the caller supplies — no SAN and no
`chess.js`. `parseFen` reads the placement field and nothing else. `nextFocus` navigates an 8×8 grid
and would work on a spreadsheet. And the condition is doing real work rather than sitting idle: #72
put `plyMotionBetween` under `learn/` instead of `board/` _because_ of it, and its header says so.
That is the tripwire changing a design, which is the most a tripwire can do.

**The fallback would not relieve the count anyway.** About 72 of the 399 lines are the accessibility
model — `squareOf`, the roving-tabindex state, `handleKeyDown`, `nextFocus`, `BoardLabels`,
`squareLabel`, the `role="grid"` and the live region — which the table above already records that no
candidate provides, so they survive any swap; the vendored sprite's 27 lines most likely survive it
too. "Past 400 lines, swap to `cm-chessboard`" therefore asks us to take on a dependency and 8.4 KB
to delete perhaps 150 lines of rendering while keeping around 100 and writing a wrapper. A number
cannot be a swap trigger when the swap is not what it would fix.

### The decision

- **The own-SVG board stands**, reconsidered rather than assumed — see below.
- **The line condition is now 450 code lines** across `Board.tsx`, `board-model.ts` and
  `piece-sprite.tsx`, comments and blanks stripped, measured together because a limit on one file is
  evaded by opening a second. **Why 450:** it is the board as built plus fifty, and fifty is five
  times the most expensive change this board has ever absorbed (#72's motion, ten lines for a slide
  animation). At the rate the board has actually grown, that is a great deal of presentation work.
  Reaching it inside a few tickets would mean the _rate_ had changed, which is the thing worth being
  told about. 400 could only ever tell us the board had been written.
- **The line condition is a review trigger, not a swap trigger.** Tripping it means: measure again,
  write down what grew and whether it is presentation or rules, and decide — which is what #79 is.
  The swap trigger is the rules condition, unchanged and unqualified.
- **No code changed.** The board renders exactly as it did; only the number and the words moved.

The tripwire's second assertion, which measured `Board.tsx` alone by its lines _as written_, is
retired with this amendment. Its only distinct failure mode was a long comment in that one file,
which contradicts the rule the same test states three lines above it — that explaining a decision
must never be the thing that trips the wire. ADR-0003 bounds the board's code, and one assertion now
says so.

### The library, reconsidered because this ADR asked for it

- **Licences re-read from the npm registry on 2026-09-17, not recalled.**
  `@lichess-org/chessground` is now **10.2.0 and still GPL-3.0-or-later**; `cm-chessboard` 8.14.0 and
  `react-chessboard` 5.12.1 are both still MIT. The reason chessground was rejected is unchanged, and
  a version bump did not change it.
- **#71 found the same copyleft shape one layer down, in the artwork.** lichess's default `cburnett`
  is GPLv2+ and the whole sadsnake1 family is CC BY-NC-SA, which is why the MIT `celtic` set was
  vendored instead (`NOTICE`). **Not checked here, and to be checked before any swap:** which piece
  set `cm-chessboard` ships and under what licence. Its _code_ is MIT; its _assets_ are a separate
  question and this amendment does not pretend to have answered it.
- **All three original reasons still hold.** Nothing in F1–F15 lets a learner move a piece, so the
  drag machinery is still unused; the accessibility floor still has to be built by hand on top of any
  of them; and F5 still mounts one board per reply. #71 and #72 do not weaken any of them — both were
  presentation, and between them they cost ten lines.

### What was rejected

- **Refactor to buy headroom.** The tripwire names the shipped modules and asserts the directory
  contains exactly those, so a fourth module in `board/` brings its own imports and props into the
  same total and makes it worse. The only refactor that buys headroom is moving board code out of
  `board/`, which evades a measurement rather than answering it — and #72 already moved everything
  that honestly belonged under `learn/`. It would also have left the ADR's question unanswered.
- **Leave 400 and let the next ticket trip it.** #80 edits `Board.tsx` next and may well make the
  mark rendering simpler. Either way, discovering an architectural checkpoint mid-task, with other
  work in hand, is the worst way to meet one.

## What would change this

The board growing beyond its bounded remit, or v2 requiring drag interaction after all.

## Amended by #131: chess.js is now a runtime dependency, and that is the trigger firing correctly

#129 put a board on the home page restricted to catalogue-only moves, precomputed into a
build-time opening tree specifically so no rules engine had to reach the browser. #131 is
the user reversing that restriction, explicitly and on purpose: "cho phép người dùng chọn
đi quân cờ thoải mái, miễn là đúng luật" — let the visitor play any legal move, not only
one some catalogue entry happens to contain. A board that must recognise arbitrary legal
play, including castling, en passant and promotion, cannot be served by a precomputed trie
of a few hundred known lines; it needs a rules engine that runs when the visitor clicks.

**This is the tripwire doing its job, not the tripwire being defeated.** The rules
condition above says plainly: rules logic anywhere means the bet on "no engine in the
browser" was wrong for what the product now needs, and `cm-chessboard` is the pre-selected
fallback for exactly that case. What #131 asks is narrower than that fallback — the engine
is needed, but only to compute legal moves and game state, not to render anything — so the
board itself does not need replacing, only the layer above it that already computed
`fen`/`marks`/`lastMove` from a different source.

- **What changed.** `chess.js` (MIT, already a build-time-only dependency per ADR-0004 and
  ADR-0005, where the content gate and the mate-proof pipeline already run it in CI) is
  now also a runtime dependency, moved from `devDependencies` to `dependencies` in
  `package.json` at the same pinned `1.4.0`. It is imported by
  `src/components/home/chess-engine.ts` and runs in the visitor's browser as a real move
  generator, legality checker and game-end detector for the home page's board.
- **What did not change.** `src/components/board/` is untouched by this amendment, exactly
  as it was by #129's. `Board.tsx` still takes a derived `fen`, an optional `check` square
  and background-tint props, and still contains no move generation, no legality test, no
  `chess.js` import and no drag or pointer handler — `board-tripwire.test.ts` enforces all
  of that, unmodified, and still passes. The engine lives one layer up, in
  `src/components/home/`, the same place #129 already put the interaction logic; only the
  _source_ of the data handed down to `Board` changed, from a tree lookup to a live
  `chess.js` instance's `.moves()` and `.move()`. Click-to-move is still the only
  interaction — no drag was added, and the ban on a board _library_ (`react-chessboard`,
  `chessground`, `cm-chessboard`, `kokopu`) is unaffected and still enforced by the same
  test.
- **Why this is a real product decision and not a technical accident.** Nothing about
  the opening tree broke or ran out of room; #129's implementation matched its own,
  narrower issue exactly. The user tried it and asked for real chess instead, which is a
  scope decision only they can make and this amendment records rather than re-litigates.
- **The one tripwire assertion this touches.** `board-tripwire.test.ts`'s "ships no board
  library, and no chess engine at runtime" test asserted `expect(runtime).not.toContain(
'chess.js')` against `package.json`'s `dependencies`. That assertion now reads
  `expect(runtime).toContain('chess.js')`, because the fact it was checking — chess.js
  reaches the browser — is now true by product decision. Every other assertion in that
  file is unchanged and still enforced: no rules logic inside `src/components/board/`
  itself, no drag or pointer handlers, the frozen export surface, and the 450-line budget
  across the shipped board.
- **The licence question this reopens, and why it is still closed.** The "Consequences"
  section above already flagged that the licence question returns "if an engine is ever
  _shipped_ to the browser" — it has been, now. `chess.js` is MIT, same as it was as a
  build-time dependency, so nothing about the licence analysis for `src/components/board/`
  itself changes: no GPL code reaches the bundle, and the board library ban is unaffected.

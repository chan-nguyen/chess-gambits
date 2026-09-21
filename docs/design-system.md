# Design system — Chess Gambit Trainer

Binding on every implementation. An agent given tokens and a component inventory produces a coherent
product; an agent given "make it look good" produces a different product on every ticket.

Nothing here may be invented at implementation time. If a value is needed and is not in this
document, it is a change to this document first.

Last updated: 2026-09-17
Status: stack-independent sections complete; component implementation notes pending the Phase 2
stack ADRs.

---

## 1. Information architecture

### Route inventory

Locale is the first path segment on every route, so every URL is shareable with its language intact.

| Route                  | Purpose                                                                        | State in the URL                                 |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| `/:locale/`            | What this is, in one screen. Entry to the catalogue. Resume where you left off | —                                                |
| `/:locale/gambits`     | The full catalogue. Search and filter                                          | `q`, `side`, `category`, `soundness`, `tier`     |
| `/:locale/gambits/:id` | The learning surface: board, navigation, tree, annotation                      | `line` (SAN path), `prelude` (ply count), `flip` |
| `/:locale/about`       | What the coverage tiers mean, how mate claims are verified, credits, licences  | —                                                |
| `*`                    | Not found, with a route back to the catalogue                                  | —                                                |

`/` with no locale resolves the visitor's preferred language and redirects once. The chosen locale
is remembered in `localStorage` so the redirect is stable on return visits.

**Every piece of view state is in the URL.** Which gambit, which branch, which language, which board
orientation, which filters. This is requirement F8 and it is not negotiable: it is what makes a
branch shareable and a bug reproducible.

`line` and `prelude` are the two halves of one walk and never appear together. `line` is the path
from the gambit root and means exactly what it has always meant; `prelude` counts plies of the
defining line and is absent at or past the root, so every URL that existed before it resolves
unchanged. `docs/CONTEXT.md`, _Prelude_, is the normative description.

### Navigation model

**Header**, on every route: site name (links home) · Catalogue · About · language switcher ·
the appearance control (system / light / dark), which is where §2's persisted dark-mode override is
set. At
narrow widths the links collapse behind a single menu button; the language switcher stays visible
because it is the one control a visitor may need before they can read the menu.

**Footer**: source repository · content licence · credits for the opening dataset · a link to the
About page's explanation of how mate claims are proved.

Depth is two levels at most — catalogue, then gambit. Anything reachable is reachable in two clicks
from anywhere.

### The gambit page layout

The one screen that matters. Three regions, and their arrangement changes with width but their
reading order never does.

1. **Board** — the position, coordinates, the learner's side at the bottom by default.
2. **Move context** — the annotation for the current node, the previous/next controls, and at an
   opponent node the branch choices with preview boards.
3. **Tree** — the whole gambit at a glance, current node highlighted, any node clickable.

- **≥1024px**: board left, move context right, tree across the full width below.
- **768–1023px**: board full width, move context below it, tree below that, collapsible.
- **<768px**: same single column. The tree collapses to a summary that expands to a full-screen
  overlay — a wide tree is unusable in a 360px column and pretending otherwise is worse than hiding
  it.

At every width the board and the next/previous controls are visible together without scrolling. The
core loop is _look at the position, press next_ — if that needs a scroll, the product has failed.

That rule also settles the one ambiguity in the three regions above. The previous/next controls are
listed under **move context**, and they are rendered immediately under the board rather than under
the annotation, at every width — a paragraph of prose between the board and the controls is exactly
what pushes the controls off a 360px screen. #8 implemented it that way; `e2e/move-navigation.spec.ts`
measures both at five viewport sizes and in the longest of the three languages, and carries a probe
that shows the measurement failing.

---

## 2. Tokens

Defined once as CSS custom properties on `:root`, redefined for dark mode. No implementation may use
a raw colour, spacing or radius value.

### Colour

Semantic names only. A component never references a palette step directly.

| Token                                                       | Role                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `--color-bg` / `--color-surface` / `--color-surface-raised` | Page, card, elevated card                              |
| `--color-text` / `--color-text-muted`                       | Body copy, secondary copy                              |
| `--color-border` / `--color-border-strong`                  | Dividers, input borders                                |
| `--color-accent` / `--color-accent-contrast`                | Primary action, and text that sits on it               |
| `--color-focus`                                             | Focus ring. One colour, used everywhere, never removed |

**Outcome colours** — these carry meaning, so they are semantic tokens and are never reused for
decoration:

| Token               | Meaning                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `--color-mate`      | A proved forced mate                                                   |
| `--color-advantage` | An assessed favourable position                                        |
| `--color-equal`     | A balanced assessment                                                  |
| `--color-worse`     | An assessment against the learner — these exist and must not be hidden |

**Reply-quality colours** map to the closed set in `CONTEXT.md`: `best`, `good`, `inaccuracy`,
`mistake`, `blunder`.

**Board colours**: `--color-board-light`, `--color-board-dark`, `--color-board-highlight`,
`--color-board-check`, `--color-board-legal`, `--color-board-mark`, `--color-board-coordinate`.

**Piece colours**: `--color-piece-white-fill`, `--color-piece-white-stroke`,
`--color-piece-black-fill`, `--color-piece-black-stroke`. A piece's role is carried by its
silhouette and its colour by these four, so white and black survive greyscale (§5).

Both themes must pass WCAG 2.2 AA. Dark mode follows the system preference and is overridable by the
user; the override is persisted.

#### Board and piece colour values

Normative. Added by #4, which needed them to exist before it could assert §5's contrast floor over
anything; the rest of the palette is given values below, by #2. `src/styles/tokens.css` implements
this table, and `board-contrast.test.ts` reads it directly — the doc is the source of truth, so a value
edited here without re-checking contrast fails that test rather than shipping.

| Token                        | Light     | Dark      | Role                                     |
| ---------------------------- | --------- | --------- | ---------------------------------------- |
| `--color-board-light`        | `#ebd9b8` | `#bcab94` | Light square                             |
| `--color-board-dark`         | `#b58863` | `#927b66` | Dark square                              |
| `--color-board-highlight`    | `#e4c05a` | `#c2a24e` | Both squares of the last ply             |
| `--color-board-check`        | `#d14b3f` | `#c4544a` | Disc behind a king in check              |
| `--color-board-mark`         | `#123a5e` | `#0f2e4a` | Background tint, arbitrary marked square |
| `--color-board-coordinate`   | `#1f1a14` | `#14110c` | File letters and rank numbers            |
| `--color-piece-white-fill`   | `#faf7f2` | `#e8e2d8` | White piece body                         |
| `--color-piece-white-stroke` | `#16120d` | `#14110c` | White piece outline                      |
| `--color-piece-black-fill`   | `#2a2520` | `#221e19` | Black piece body                         |
| `--color-piece-black-stroke` | `#f0eae0` | `#cfc7ba` | Black piece outline                      |

Three rules hold over this table in both themes, and each is asserted:

1. **A piece is legible on every surface it can sit on.** For each piece and each of the four square
   or highlight colours, the fill _or_ the stroke reaches 3:1. Neither alone can: a white piece's
   body vanishes on a light square and a black piece's body vanishes on a dark one, which is exactly
   what the outline is for.
2. **White and black survive greyscale.** The two fills reach 4.5:1 of each other, and each fill
   reaches 3:1 of its own stroke.
3. **Coordinates are readable on both squares.** `--color-board-coordinate` reaches 4.5:1 against
   both `--color-board-light` and `--color-board-dark`. One token rather than a per-square pair,
   because a single dark value clears both and a light one cannot clear the light square.

`--color-board-mark` is dark in both themes for the same reason: a marked square's tint must clear
3:1 against the plain square colour it replaces, on the light _and_ the dark square, and only the
dark end of the range does. #131 changed the mark itself from a ring to a background tint (no ring
anywhere on the board any more, by user request); the token and its contrast requirement carry over
unchanged, because a tint needs the same separation from the plain square a ring did.

`--color-board-legal` still has no value. #131 does show legal destinations once a piece is
selected — the home board's own `marks` — but reuses `--color-board-mark` rather than this
token: origin and destination are one visual category ("this square matters right now"), not
two, so a second colour would be a distinction nothing on screen needs yet.

**`--color-board-highlight` marks both squares of the last ply, as of 2026-09-18, and neither has a
ring beside it.** #80 removed the departed-square token: a tint is a surface — something a piece
sits on — and the square a ply left has nothing sitting on it, so filling it made an empty square
read as occupied. That argument still holds about a fill _on its own_; what actually made it loud,
measured in #80, was the 0.045-unit ring drawn on top of the fill, not the fill underneath. #88
removed the ring from both squares (§2's binding rule, exception below) rather than the tint, and
kept the two squares apart by giving them different, luminance-distinct tokens. This entry drops
that distinction too, by product decision: both squares now share the one token above, so the
highlight marks the last move as a pair of squares rather than telling departure from arrival.

#### Interface, outcome and reply-quality colour values

Normative, on the same terms as the board table above: the doc is the source of truth,
`src/styles/tokens.css` implements it, and `src/styles/tokens.test.ts` reads both and fails on a
disagreement or on a contrast regression.

The palette is warm and low-chroma so that the board — which is wood-coloured and is the thing being
looked at — is the most saturated object on the page.

| Token                     | Light     | Dark      | Role                                       |
| ------------------------- | --------- | --------- | ------------------------------------------ |
| `--color-bg`              | `#fbfaf8` | `#14110c` | The page                                   |
| `--color-surface`         | `#ffffff` | `#1e1a14` | A card                                     |
| `--color-surface-raised`  | `#f1ece3` | `#2b251d` | An elevated card                           |
| `--color-text`            | `#1f1a14` | `#ece5d9` | Body copy                                  |
| `--color-text-muted`      | `#585043` | `#b0a493` | Secondary copy — still body text, still AA |
| `--color-border`          | `#d6ccb9` | `#453d33` | Dividers                                   |
| `--color-border-strong`   | `#79705f` | `#7d7365` | Input borders and other real components    |
| `--color-accent`          | `#0c5f6f` | `#6fc9d6` | Primary action, links                      |
| `--color-accent-contrast` | `#ffffff` | `#14110c` | Text that sits on the accent               |
| `--color-focus`           | `#1a4fd0` | `#ffd166` | Focus ring, everywhere, never removed      |

Outcome colours:

| Token               | Light     | Dark      | Role                              |
| ------------------- | --------- | --------- | --------------------------------- |
| `--color-mate`      | `#6a2f8f` | `#d59ae8` | A proved forced mate              |
| `--color-advantage` | `#1a6b2f` | `#7fce8c` | An assessed favourable position   |
| `--color-equal`     | `#4a5563` | `#a9b6c6` | A balanced assessment             |
| `--color-worse`     | `#a92d22` | `#ef9086` | An assessment against the learner |

Reply-quality colours, one per member of the closed set in `CONTEXT.md`:

| Token                        | Light     | Dark      |
| ---------------------------- | --------- | --------- |
| `--color-quality-best`       | `#0f6b3f` | `#6fd39a` |
| `--color-quality-good`       | `#4a6b16` | `#b0d268` |
| `--color-quality-inaccuracy` | `#7a5a00` | `#e0bc5a` |
| `--color-quality-mistake`    | `#9c4a12` | `#eda06a` |
| `--color-quality-blunder`    | `#a3231b` | `#f08a80` |

Four rules hold over these three tables, in both themes, and each is asserted:

1. **Anything that carries text clears 4.5:1** against `--color-bg`, `--color-surface` _and_
   `--color-surface-raised`. Every outcome and quality colour is a text colour — §2's "colour is
   never the only signal" rule means each one always appears next to a label — so none of them gets
   the 3:1 large-text allowance.
2. **`--color-accent-contrast` clears 4.5:1 against `--color-accent`**, which is the one pair where
   the background is not a surface.
3. **`--color-focus` clears 3:1 against all three surfaces.** Against a _control_ it cannot: a ring
   bright enough to clear a dark accent button would disappear on the page behind it. So the ring is
   drawn with `--focus-ring-offset`, which puts the page between the ring and the control and makes
   the surface the adjacent colour that has to be cleared. That offset is the reason this rule is
   satisfiable, not a decoration.
4. **`--color-border-strong` clears 3:1** against all three surfaces, because it draws real
   components (WCAG 1.4.11). `--color-border` is a divider, is not a component, and is held to a
   perceptibility floor of 1.5:1 rather than to 3:1 — stated so that a later reviewer does not read
   its absence as an oversight.

### Colour is never the only signal

Binding rule, and the one most likely to be violated by an agent in a hurry.

- Reply quality carries an **icon and a text label**, not just a colour.
- Outcome type carries **distinct components and distinct wording** — a mate leaf and an assessment
  leaf do not differ only in hue.
- Board highlights carry a **shape or border difference**, not only a tint — **with two documented
  exceptions.** The last-ply mark (the square a ply left and the square it reached) is a plain
  background colour, the same `--color-board-highlight` token on both squares, and nothing else, as
  of 2026-09-18, by the product owner's explicit decision. Squares of two different plain colours
  (light, dark) still hold the rule normally — light and dark stay apart in `grayscale(1)`. The
  exception is narrower than it once was: an earlier revision (#88) gave the two last-ply squares
  distinct tokens chosen so their **luminance** told them apart under `grayscale(1)`; this revision
  removes that distinction too, so nothing on the board says which square a ply left and which it
  reached — only that a move happened across this pair. `board-contrast.test.ts` records this.
  **#131 adds the second exception**, for the same reason and by the same authority: the home
  board's `marks` (the selected square and its legal destinations) were a ring until the user asked
  for it removed outright ("bỏ vòng tròn xung quan quân cờ") — a plain `--color-board-mark` tint,
  with no shape or border, is what replaced it. Every other colour-coded element on the site still
  holds the rule with no exception.
- Every colour-coded element passes a greyscale screenshot review. This is a review step, not a
  suggestion.

### Spacing, type, radius, motion

- **Spacing**, a 4px scale: `--space-1` 4px through `--space-10` 96px. No arbitrary margins.
- **Type**: system font stack — no webfont, because a webfont is a third-party request in a project
  whose N8 requirement is zero third-party requests, and self-hosting one costs LCP for nothing.
  Chess notation renders in `--font-mono` so `Nf3` and `Bb5+` align in lists.
  Scale: `--text-xs` 12px through `--text-3xl` 32px. Line height 1.5 body, 1.2 headings.
- **Radius**: `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 12px, `--radius-full`.
- **Focus ring**: `--focus-ring-width` 2px. §5 requires a visible focus ring everywhere and
  never gave it a width, so without a token every component invents one and they disagree.
- **Motion**: `--duration-fast` 120ms, `--duration-base` 200ms. Board transitions use
  `--duration-base`. **All motion is disabled under `prefers-reduced-motion: reduce`** — a piece
  that slides is decoration, and the position is the information.
  The board's own motion is exactly two things (#72), and both are `--duration-base`: the piece a
  ply moved slides from the square it left to the square it reached, and a piece that was taken
  stays where it stood until the mover lands on it. **Branch previews do not animate** — a branch
  node draws one board per modelled reply, and a dozen of them sliding at once for a move the
  learner did not make is the cost §6 exists to keep off the page. Both are written so that the
  board with nothing running on it is the position: the reduced-motion rule, an interrupted
  animation and a press that arrives first all leave every piece on the square the FEN names.

#### Scalar values

Normative, and the same rule applies: a component may not spell any of these out. One row per token,
because `tokens.test.ts` reads this table and a row it cannot parse is a value that stops being
checked.

| Token                      | Value                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `--space-1`                | `4px`                                                             |
| `--space-2`                | `8px`                                                             |
| `--space-3`                | `12px`                                                            |
| `--space-4`                | `16px`                                                            |
| `--space-5`                | `24px`                                                            |
| `--space-6`                | `32px`                                                            |
| `--space-7`                | `48px`                                                            |
| `--space-8`                | `64px`                                                            |
| `--space-9`                | `80px`                                                            |
| `--space-10`               | `96px`                                                            |
| `--font-sans`              | `system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif` |
| `--font-mono`              | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`        |
| `--text-xs`                | `12px`                                                            |
| `--text-sm`                | `14px`                                                            |
| `--text-base`              | `16px`                                                            |
| `--text-lg`                | `18px`                                                            |
| `--text-xl`                | `22px`                                                            |
| `--text-2xl`               | `26px`                                                            |
| `--text-3xl`               | `32px`                                                            |
| `--line-height-body`       | `1.5`                                                             |
| `--line-height-heading`    | `1.2`                                                             |
| `--radius-sm`              | `4px`                                                             |
| `--radius-md`              | `8px`                                                             |
| `--radius-lg`              | `12px`                                                            |
| `--radius-full`            | `9999px`                                                          |
| `--border-width`           | `1px`                                                             |
| `--focus-ring-width`       | `2px`                                                             |
| `--focus-ring-offset`      | `2px`                                                             |
| `--duration-fast`          | `120ms`                                                           |
| `--duration-base`          | `200ms`                                                           |
| `--target-size-min`        | `24px`                                                            |
| `--target-size-touch`      | `44px`                                                            |
| `--layout-max-inline-size` | `1120px`                                                          |

Five of these tokens are named here for the first time, because a shell cannot be built without
them and inventing a value at implementation time is what this document exists to prevent:

- `--border-width`, because §2 gives dividers a colour and no thickness. The board never needed one:
  it draws in SVG user units.
- `--focus-ring-offset`, for the reason given under the colour rules above — without it, rule 3 is
  unsatisfiable rather than merely unmet.
- `--target-size-min` and `--target-size-touch`, which are §5's existing 24×24 and 44×44 floors
  given names so a component can honour them without re-reading §5.
- `--layout-max-inline-size`, the width of the content column. §1 fixes the breakpoints but never
  said where the text stops growing on a wide screen.

**Breakpoints** are `768px` and `1024px`, exactly as §1's gambit-page layout describes them, and
they are the only two in the product. They are the one thing on this page a stylesheet spells out
as a raw value, because CSS custom properties are not valid inside a media condition — so the
no-raw-values gate excludes media conditions and asserts instead that every breakpoint used is one
of these two.

---

## 3. Component inventory

Every component below has defined states. A component shipped without its empty, loading or error
state is incomplete, and "this one cannot be empty" is a claim to be checked, not assumed.

**Primitives** — Button (primary/secondary/ghost · sm/md/lg · default, hover, active, focus,
disabled, loading) · IconButton (always has an accessible name) · Link (visually distinct from a
Button; a Link navigates, a Button acts) · Badge · Tag · Input · Select · Disclosure · Tooltip
(never the only place information exists) · VisuallyHidden · Skeleton.

**Domain components**

| Component            | Responsibility                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Board`              | Render a position                                                  | Own SVG (ADR-0003). `role="grid"`, 64 cells, roving tabindex, one polite live region. Position comes in as a derived FEN, never authored. **Display only in v1** — no piece is ever dragged                                                                                                                                                                                                                                              |
| `BoardPreview`       | Small static board for branch choices                              | Same renderer, no coordinates, not in the tab order — many mount at once. Each marks its **own** candidate ply (#54): replies to one position differ by a single piece, so one mark per board is what tells them apart                                                                                                                                                                                                                   |
| `MoveNavigator`      | Previous / next / jump to the game start / jump to the gambit root | Previous disabled at the **initial position**, next disabled at a leaf. Four controls, not three: since the walk begins at move one, "the start" and "the gambit root" are two different places and the root is what published links point at. One row at every width, which is why all four labels are short — measured in French at 360px by `e2e/move-navigation.spec.ts`                                                             |
| `MoveList`           | Plies of the current path, current one marked                      | Monospace; click to jump. Starts at the initial position and runs through the defining line before the `?line=` path — one walk, drawn the same way throughout, because a defining-line ply is not a different kind of move to a learner reading a scoresheet                                                                                                                                                                            |
| `BranchChoices`      | The replies at an opponent node                                    | Each: preview, SAN, quality icon + label, frequency, provenance. Also renders `dismissed` replies, collapsed, with their reason — an omission the learner can see is honest; one they cannot is the product's core failure                                                                                                                                                                                                               |
| `PlanChoices`        | A **learner** node with more than one prescribed move              | A genuine choice of plans, e.g. the Evans after 5...Ba5 where 6.d4 and 6.O-O are both main lines. Distinct from `BranchChoices`: these are the learner's options, not the opponent's threats                                                                                                                                                                                                                                             |
| `MateNet`            | The forced line's SAN, each ply a link into it                     | No board of its own (#123) — the main board is the anchor, and `MoveNavigator`'s real "next" steps it through `sequenceFens` to the actual checkmated position via the `mate` address (`walk.ts`). A `mate` position is a FEN with no tree node, addressed the same way a prelude position is, never one preview per reply — a defender node in a net can have 24 legal replies, and 24 board instances on a 360px phone is not a design |
| `AnnotationPanel`    | The current node's prose                                           | Shows the untranslated marker on fallback                                                                                                                                                                                                                                                                                                                                                                                                |
| `OutcomeCard`        | A leaf's outcome                                                   | **Two distinct components**, not one with a flag                                                                                                                                                                                                                                                                                                                                                                                         |
| `MateOutcome`        | Proved forced mate                                                 | States the mate count, the forced sequence, and links to how it was proved                                                                                                                                                                                                                                                                                                                                                               |
| `AssessmentOutcome`  | Favourable / equal / worse position                                | Evaluation plus middlegame plan                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GambitTree`         | The whole tree, current node highlighted                           | Collapses to an overlay below 768px                                                                                                                                                                                                                                                                                                                                                                                                      |
| `TierBadge`          | Listed / Mapped / Taught                                           | Always links to the About page's explanation                                                                                                                                                                                                                                                                                                                                                                                             |
| `SoundnessBadge`     | Sound / dubious / unsound                                          | Honest wording, no euphemism                                                                                                                                                                                                                                                                                                                                                                                                             |
| `CatalogueFilters`   | Search and filter                                                  | Writes to the URL, reads from the URL                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GambitCard`         | One catalogue entry                                                | Name, ECO, side, soundness, tier, progress                                                                                                                                                                                                                                                                                                                                                                                               |
| `LanguageSwitcher`   | vi / en / fr                                                       | Preserves the current route and `line` exactly                                                                                                                                                                                                                                                                                                                                                                                           |
| `ProgressMarker`     | Mark a branch learned                                              | Optimistic; a `localStorage` failure is silent, never a crash. Stored data carries a schema `version`, and an unrecognised version is discarded with a notice rather than silently wiping progress                                                                                                                                                                                                                                       |
| `CoverageSummary`    | Aggregate honesty, in the header                                   | "612 listed · 30 mapped · **10 taught**". Per-entry tier badges make each page honest; only this makes the _composition_ honest                                                                                                                                                                                                                                                                                                          |
| `UntranslatedNotice` | Marks fallback content                                             | Honest and unobtrusive; never blocks reading                                                                                                                                                                                                                                                                                                                                                                                             |
| `EmptyTree`          | The Tier 0 state                                                   | A real designed state (F15), never a spinner or a 404                                                                                                                                                                                                                                                                                                                                                                                    |
| `ContentLoadError`   | A gambit **tree** failed to fetch                                  | Names what failed, offers retry, keeps the rest of the page usable. **Not** used for a locale bundle — that reuses `UntranslatedNotice`'s vocabulary, per the failure-states table below, and this row said otherwise until #7 implemented it                                                                                                                                                                                            |

---

### Lazy-load failure states

Found by walking the primary journey; recorded here because a lazy boundary without a failure state
is a blank screen in production, and this project has no error reporting to tell anyone it happened.

Three things load on demand, and each needs a designed failure, not a thrown promise:

| What                                       | On failure                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A gambit's compiled tree                   | `ContentLoadError` in the board region. The catalogue, header and language switcher stay usable. Retry re-fetches without a full reload   |
| A locale bundle                            | Fall back to Vietnamese **and say so** — reuse `UntranslatedNotice`'s wording rather than inventing a second vocabulary for the same idea |
| A route shell for an unpublished gambit id | The real 404 page, with a link to the catalogue and the id echoed back so a stale shared link is diagnosable                              |

Every one of these is reachable on a flaky mobile connection, which is the primary target device.

### The catalogue defaults to depth, not to breadth

On day one this site is roughly ten taught entries inside several hundred listed ones. Every entry
page is individually honest — `TierBadge`, and `EmptyTree` for Tier 0 — and the composition still
misleads: a visitor who searches three gambits they know, finds three "not yet taught in depth"
pages, and leaves, was told the truth three times and given a false impression once.

So: the catalogue filter **defaults to Taught**, with an explicit "show everything listed" toggle;
the header always shows the aggregate counts; and the home page routes to a taught entry, never to
the raw catalogue. The catalogue groups by **family** and expands on demand, because an imported
dataset of variations returns dozens of near-identical rows for one search term.

This is free, and it turns a graveyard into a small honest site with a large index attached.

### Why the home board does not reverse ADR-0003

The home page has an interactive board: a visitor clicks a piece, clicks a destination, and
the catalogue filters live to whatever matches the moves played so far. `ADR-0003` bans a
board _library_, a drag interaction, and any rules logic inside `src/components/board/`
specifically, and names "v2 requiring drag interaction" as its own trigger for being
revisited. Neither condition is tripped, on any of its three axes:

- **The rules engine is real, and it is confined to one directory.** #129 first shipped this
  board restricted to catalogue-only moves, looked up in a precomputed opening tree, so that
  no rules engine had to reach the browser at all. #131 reverses that restriction by product
  decision — any legal move can be played now, including one no catalogue entry contains —
  which needs a real `chess.js` instance running live in the visitor's browser
  (`src/components/home/chess-engine.ts`). `chess.js` (already a build-time dependency per
  ADR-0004/0005) is now also a runtime one, and ADR-0003's own amendment for #131 records
  why that is the tripwire firing correctly rather than being defeated: the ban that matters
  is on rules logic reaching `src/components/board/`, and that boundary is unmoved.
- **No drag.** Interaction is still click-to-move: select a square, then select a
  highlighted destination — exactly the mode ADR-0003 itself names as the anticipated v2
  interaction, because it is what the existing accessible grid already supports (a focused
  cell, Enter/Space to activate) without adding a pointer-drag system at all.
- **`src/components/board/` is untouched.** The board lives entirely under
  `src/components/home/` and reuses the shipped `Board` component exactly as it ships —
  same props, same file, same 450-line budget, same tripwire
  (`board-tripwire.test.ts`). The interaction (click delegation, keyboard activation,
  selection state, the rules engine itself) lives one layer above `Board`, the same way
  `LearningSurface` already drives `Board` with a derived `fen` and a `marks` list without
  `Board` ever knowing why either one changed. The only visual change #131 made to `Board`
  itself is cosmetic: `marks` renders as a background tint rather than a ring, by explicit
  user request, matching the same tint mechanism `lastMove` already used.

The catalogue filter has one dimension for this (`CatalogueFilter.movesPrefix` in
`src/components/catalogue/filter.ts`): a played-move prefix matched against
`CatalogueEntry.line`'s own tokens by deep equality. It is a filter over data the catalogue
already ships, not a second rules engine — the played sequence now comes from `chess.js`'s
own move history rather than from a precomputed tree, but the filter only ever compares
strings the catalogue already carries, exactly as before.

### Progress is a count, not a percentage

"12 of 20 branches", not "60%". A percentage falls when content improves: a learner at 100% on the
Evans drops to 60% the day three branches are added, with no explanation and no way to tell an
improvement from a regression. Mate nets are excluded from the denominator entirely — a generated
net with 300 leaves would make every real gambit read as 4% complete forever.

**What counts as a branch**, settled by #14 and recorded here rather than left in the code: one
root-to-leaf line. `ProgressMarker` therefore appears where a line ends and nowhere else; mid-line it
is replaced by a sentence saying so, because a disabled control is a thing to try and there is
nothing here to try.

**A second exclusion, alongside mate nets: an `unexplored` leaf is not a branch.** It is the
placeholder that lets half-finished work be committed, so there is nothing at it to learn and its own
annotation says so. Counting it would make the denominator a measure of content nobody has written,
and a learner who had learned everything that exists would read "3 of 7" with no way to tell that from
having four branches left — which is the failure the percentage was rejected for, arriving by the
other door. The consequence is visible and is the right one: a _Listed_ entry's whole tree is one
unexplored root, so it shows "no branches to mark yet" rather
than "0 of 1".

### Catalogue chunking

Also found by walking the journey. The catalogue budget is 100KB gzipped _regardless of catalogue
size_, but a naïve catalogue carries every entry's name in all three locales — which multiplies the
largest field by three for no benefit, since a visitor reads one language.

**The catalogue is built per locale**: `catalogue.vi.json`, `catalogue.en.json`, `catalogue.fr.json`.
A visitor downloads one. Locale-independent fields (ECO, side, category, soundness, tier, defining
line, branch keys) are identical across the three, which is accepted duplication — it costs a few KB
and avoids a second request and a join on the critical path.

**Branch keys are the one field that grows with depth rather than with breadth**, and they are there
because a card has to reach the same number the gambit page reaches. It cannot: the catalogue carries
no tree, so a card given only a total can clamp the marks it finds in storage against it while the
page intersects them with the keys its tree has, and a mark that outlives its branch makes the two
disagree — "1 of 1" on the card against "0 of 1" on the page (#48). Shipping the keys is what makes
the agreement structural. Measured: **+223 bytes gzipped over 1,003 entries, 26.0KB → 26.3KB** of the
100KB budget. Still no tree — no FENs, no annotations, no outcomes, only the line identifiers `?line=`
already carries. Extrapolated to every entry taught it reads about 62KB at seven branches each and
about 92KB at fifteen, which is the tripwire in `PROJECT-PLAN.md` doing its job rather than a number
to be surprised by later.

## 4. Interaction rules

- **Link versus Button.** Navigating between routes or tree nodes is a link — it must be
  middle-clickable and copyable. Acting on the page is a button. Because every navigation is a URL,
  most of this product is links.
- **Nothing here needs a confirmation dialogue.** The most destructive available action is unmarking
  a branch as learned. Make it undoable rather than confirmed.
- **Focus after navigation**: moving to a node moves focus to the annotation panel heading, so a
  keyboard or screen-reader user lands on what changed, not back at the top of the page.
- **Keyboard**: `←` / `→` step previous and next. `f` flips the board. `1`–`9` select a branch at an
  opponent node. **Single-character shortcuts must be switchable off**, via a setting that persists —
  WCAG 2.2 _2.1.4 Character Key Shortcuts_ is **Level A**, and suppressing them inside text inputs
  does not satisfy it. Shortcuts are listed on the About page. Where more than nine branches exist,
  `1`–`9` covers the first nine and the rest are reachable by tab and by click; a numeric shortcut is
  never the only route to a branch.
- **No hover-only information, anywhere.** A touch device has no hover, and a keyboard user has no
  pointer. Anything revealed on hover is also reachable by focus and visible on touch.
- **Errors are specific.** "Branch not found in this gambit — showing the main line" beats "Something
  went wrong". A malformed `line` parameter recovers to the nearest valid node rather than erroring.

---

## 5. Accessibility floor — WCAG 2.2 AA

Non-negotiable, and cheap now.

- **The board is fully keyboard operable.** Every square is reachable, the current square is
  announced with its piece, and a move can be made without a pointer.
- **Every move change is announced** through a polite live region: the SAN played, and whether it
  gives check, captures, or is checkmate.
- **Pieces are distinguishable without colour.** Piece sets differ in shape; white and black pieces
  carry an outline contrast that survives greyscale.
- **Focus is always visible**, using `--color-focus`. `outline: none` without a replacement indicator
  is a review failure.
- **Target size**: interactive targets are at least 24×24 CSS pixels, and branch-choice controls at
  least 44×44 because they are the primary touch interaction.
- **Text contrast** 4.5:1 body and 3:1 large text, in both themes. Board square colours are checked
  against the pieces that sit on them, which is a case automated tooling misses.
- **Headings are a real hierarchy** — one `h1` per route, no level skipped.
- **The language switcher sets `lang`** on the document, and mixed-language content (a Vietnamese
  page showing untranslated Vietnamese inside a French UI) carries `lang` on the element.
- **Piece names are spoken in the learner's language.** SAN is never localised (§7), but a screen
  reader saying "white knight on f3" must say it in Vietnamese or French. This is ours to write,
  which is one more reason the board is ours (ADR-0003).
- **2.1.4 Character Key Shortcuts (Level A)** — see §4. Single-key shortcuts are switchable off.
- **2.5.7 Dragging Movements (AA, new in 2.2)** — satisfied by construction: nothing in v1 is
  dragged. When v2 adds practice mode it must be tap-piece-then-tap-square, not drag-only.
- **2.4.11 Focus Not Obscured (AA, new in 2.2)** — the mobile full-screen tree overlay must not cover
  the focused element when it opens or closes.
- **Verified by**: automated axe checks in CI, plus a manual keyboard-only walkthrough of one full
  gambit tree before any release. Automation catches roughly a third of this; the walkthrough is not
  optional, and it is a recurring cost rather than a one-off — the maintainer is the sole reviewer
  and is not a screen-reader user, which is a limitation to state rather than to paper over. The
  three subsections below say exactly which third is automated, what the manual pass has to cover,
  and where each review is written down.

### What the automation covers, and what it does not

Added by #18. `e2e/accessibility.spec.ts` runs axe-core through Playwright against the **built**
site, over the home, catalogue, gambit and about routes in all three locales, with the rule tags
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` — WCAG up to 2.2 AA and nothing else.
Axe's `best-practice` tags are deliberately excluded: a check that blocks a merge may only carry
rules this project has committed to.

The four routes are scanned at the default desktop viewport and again at 360px, where §1 puts a
different layout on screen — together with the two states that exist only there, the collapsed
header menu and the full-screen tree overlay. A dialog is the control type most likely to carry a
name/role/value fault, so scanning only the wide layout would have left the one dialog on this site
unexamined.

It runs inside the existing `e2e` job in `.github/workflows/ci.yml`, at both base paths, and a
violation fails the build. It is not a report.

Two narrowings are stated rather than left to be discovered:

1. The twelve published route/locale pages are scanned as a visitor receives them, and today every
   gambit page is at the _Listed_ tier — `npm run build` reports "700 listed · 0 mapped · 0 taught".
   A gambit page with no tree renders no board, no branch choices, no quality badges and no outcome
   card, so a sweep of published routes alone would pass without having looked at the components
   this product is about. Three fixture-served states — a branch point, a plan choice and a leaf —
   are scanned as well, in Vietnamese only, because what they add over the published routes is
   component markup and that is locale-independent.
2. **Automated rules catch roughly a third of WCAG, and this gate does not change that number.** A
   green run is not a claim that the site is accessible. It is a claim that a specific, listed set
   of machine-checkable failures is absent. Everything below is the rest.

Three more things are checked in that file because a browser is the only thing that can settle
them, and each carries a probe that makes it fail: a keyboard-only walk from the catalogue into an
entry, through a branch node and on to a leaf, with the computed focus outline **measured** at every
tab stop against `--color-focus` rather than read off the stylesheet; the polite live region, read
back ply by ply in the learner's language; and 2.1.4, including the half that is easy to ship
broken — a setting persisted in a previous session and character keys that are genuinely dead in
this one.

### The pre-release manual checklist

Run before any release, on one full gambit tree. None of this is reachable by the gate above.

- [ ] **Keyboard only, no pointer at all.** Catalogue → entry → through a branch node → to a leaf,
      and back out. Every stop shows a focus ring, and focus after each navigation is on the
      annotation heading, not at the top of the page.
- [ ] **Nothing is a focus trap**, and `Esc` leaves the mobile tree overlay with focus somewhere
      sensible (2.4.11).
- [ ] **Screen reader**, one pass with VoiceOver: the board announces each square with its piece in
      the page's language, each move is announced once and not twice, and the heading hierarchy
      reads as a real outline.
- [ ] **Reflow (1.4.10)**: 400% browser zoom at 1280px, which is the 320px-equivalent width the
      criterion actually names — narrower than the 360px floor the rest of this project designs to.
      No horizontal scroll, nothing clipped, nothing overlapping.
- [ ] **Reduced motion**, with the OS setting on: no transition that survives it.
- [ ] **The greyscale review** below.
- [ ] **Both themes**, for all of the above.

The limitation, stated plainly: the maintainer is the sole reviewer and **is not a screen-reader
user**. The VoiceOver line above is a person driving an unfamiliar tool carefully, which finds
gross breakage and does not find the things a daily user would. That is the honest ceiling on this
checklist, and the argument for paying for a real audit before this project claims conformance
anywhere a visitor can read it.

### The greyscale review

`npm run review:greyscale` desaturates and photographs the three surfaces §2 names — the board, the
quality labels and the outcome cards — writing each frame to `test-results/` and attaching it to the
Playwright report. The reviewer looks at the frames; the machine only produces them and proves they
really came out of the filter.

The automated half is not repeated there. It already exists: `e2e/branch-choices.spec.ts` for the
quality labels, `e2e/outcomes.spec.ts` for the outcome cards, and
`src/components/board/board-contrast.test.ts` for the pieces and squares. What is left for a person
is whether the desaturated screen still _reads_ — five icons can be five distinct paths and still
look like five smudges at 14px.

This is not ceremony in this palette. Measured over the nine outcome and reply-quality colours in
the tables above, **every one of the 36 pairs is under 1.5:1 of its partner once hue is removed, in
both themes**. Twenty-six of the 36 are under 1.2:1 in light mode and twenty-five in dark. Three
pairs are the identical grey: `--color-quality-good` against `--color-quality-mistake` and
`--color-quality-best` against `--color-advantage` in light, and `--color-quality-best` against
`--color-quality-inaccuracy` in dark. Among the five reply-quality colours alone, six of their ten
pairs sit at or below 1.07:1.

None of that is a defect — these are text colours on a surface, and §2's four rules hold over every
one of them. It is the measurement behind "colour is never the only signal": in greyscale this
palette carries **no** quality or outcome distinction at all, so the icon and the label are not a
belt-and-braces addition to the hue. They are the whole signal.

### Review log

One entry per review, written when the review is performed rather than when it is due. An empty log
under a shipped release is itself the finding.

**2026-09-17 — #18, the gate's own first run.** Not a release review: this is the baseline the
checklist above was written against.

- **axe: 0 violations**, over 21 scans at WCAG 2.2 AA: twelve published route/locale pages (home,
  catalogue, gambit, about × vi, en, fr), three fixture-served states (a branch point, a plan
  choice, a leaf), and six at 360px including the open header menu and the open tree overlay. The
  probe in the same file confirms the sweep reports a violation that is really there, so the zero
  is a result rather than an empty run. Separately confirmed by hand: an `<img>` with no `alt` and
  a 1.6:1 paragraph added to the about route turned the gate red on all three locales, naming the
  rule, the impact and the selector.
- **Greyscale: pass.** All five reply qualities carry a distinct icon silhouette _and_ a distinct
  label. The closest pair is `best` (double chevron) against `good` (single chevron), told apart by
  stroke count rather than by silhouette — the label is what carries it, which is the rule working
  as written. Mate and assessment cards differ in border, icon, heading, internal structure and
  provenance wording. White and black pieces read cleanly on both square colours.
- **Not covered, and not a pass:** the last-ply highlight. `Board` implements it completely — the
  tinted squares, the dashed and solid rings that make it a shape difference and not only a tint,
  the `--color-board-highlight-*` tokens, and a unit test in `Board.test.tsx` — behind an optional
  `lastMove` prop. **No caller passes that prop**: neither `LearningSurface` nor `BoardPreview`
  mentions it, so no board on the shipped site has ever drawn a highlight. This is a wiring gap
  rather than a design gap, and until it is closed §2's "board highlights carry a shape or border
  difference, not only a tint" is a rule with nothing to hold over.
- **Not performed:** the screen-reader, zoom, reduced-motion and dual-theme rows. #18 wired the gate
  and wrote the checklist; it did not run the first manual pass, and recording that honestly is
  cheaper than an entry that implies otherwise.

**2026-09-17 — #54, the last-ply highlight wired to its callers.** Not a release review either: it
closes the one line the entry above records as not covered, and leaves the rest of that entry's
"not performed" list standing.

- **The gap, closed.** The highlight hung off an optional `lastMove` prop and no caller passed it.
  `LearningSurface` and every branch and plan preview now do. The two squares are derived from the
  positions either side of a ply rather than shipped on the wire, for the reason
  `tools/content/derived-fields.ts` gives about FENs: a stored origin square is one more thing that
  can drift out of sync with the moves beside it, and unlike a FEN nothing downstream would notice.
  `last-ply.test.ts` holds the derivation against `chess.js` over four opening lines and forty
  games, castling, _en passant_ and promotion included.
- **Greyscale: the tint carries nothing, and that is now measured rather than assumed.**
  `--color-board-highlight-from` against `--color-board-highlight-to` is **1.05:1** in light and
  **1.10:1** in dark; either against `--color-board-light` is at most **1.27:1**. So with the hue
  gone a learner cannot tell the square a ply left from the square it reached, nor either from a
  square nothing happened on. The dashed ring and the solid one are the entire signal, exactly as
  icon and label are for the nine colours measured above. `board-contrast.test.ts` records the
  numbers, and `e2e/move-navigation.spec.ts` measures both rings on a genuinely desaturated page
  with a probe that makes it fail.
- **Preview boards mark their own candidate ply; `MateNet`'s board marks none.** Both decisions are
  written into §3's component table rather than only into the code. The preview rings are stroked
  thicker than the main board's, because the board's 0.045-unit stroke scales to half a CSS pixel on
  a 96px preview, and two hairlines are not two shapes.
- **axe: still 0 violations**, over the same sweep — including the published taught entries, which
  now really draw a highlight. The rings sit inside the board's `aria-hidden` SVG and add no name,
  role or value, and the run confirms that rather than leaving the reasoning to stand alone.
- **Looked at by hand:** the highlight on the main board and on a column of previews, in both
  themes at 375px, in colour and under `grayscale(1)`. **Not performed:** everything the entry above
  lists as not performed — the screen-reader, zoom and reduced-motion rows are still unrun.

**2026-09-17 — #80, the last-ply highlight given its weight back.** Not a release review; it changes
one thing the two entries above recorded as passing, and says what it changed it to.

- **The measure.** Every number here is one quantity: how much **darker** a square is than its own
  plain colour, averaged over its pixels — `e2e/board-ink.ts`, which decodes a screenshot of the
  board. It is normalised to the square underneath, so it reads the same in both themes and at any
  board size, and it is hue-free for the same reason the ratios above are: luminance carries no hue.
  A square with nothing on it measures 0%.
- **The defect, measured rather than described.** On `kings-gambit?line=exf4_Nf3` the knight has gone
  g1→f3 and g1 is **empty**. It measured **12.1%** in the light theme and **12.2%** in the dark —
  against **11.2%** and **9.9%** for the knight standing on b1, and **4.9%** / **4.7%** for the
  faintest piece in the same frame. The empty square was darker than a piece. That is the issue's
  "it reads as though something is still there", in a number, and the tint is not even counted in it:
  12.1% is the ring alone. It was a 0.045-unit near-black line, thicker than anything the artwork
  draws inside a piece, around an olive block.
- **What ships instead.** The tint on the departed square is gone and `--color-board-highlight-from`
  with it (§2 says why a tint is a surface). Both rings are now **0.016** units rather than 0.045,
  and the dashed one is dashed more sparsely. The same square now measures **3.9%** / **4.0%** — a
  third of what it was, under the 4.9% / 4.7% of the faintest piece on the board, which is the bar
  an empty square has to clear to stop reading as an occupied one. At a 360px phone it is 3.7% /
  3.8%, so the reading does not depend on the board being large.
- **Greyscale: still a shape difference, and still the only one.** Nothing about the dashed-versus-
  solid distinction changed, and the #54 entry's measurements still stand — desaturated, the tint on
  the arrival square is within 1.3:1 of an ordinary square, so the outlines carry it. Counted on a
  desaturated screenshot rather than on a computed style: the departed square's top edge breaks into
  **3** runs of ink and the arrival square's into **1**.
- **Without motion, which is the case the marks exist for.** #72's slide does not run on a directly
  opened `?line=` URL and is switched off entirely by `prefers-reduced-motion: reduce`. Every number
  above was taken under **both** conditions at once — a fresh load of the deep link, in a context
  with the reduced-motion preference on — because that is the learner the mark is the only channel
  for. `e2e/last-ply-weight.spec.ts` holds all of it, in both themes, with a probe per measurement.
- **axe: still 0 violations** over the same sweep as the entries above. The marks are geometry inside
  the board's `aria-hidden` SVG and were before.
- **The 96px choice previews, which are the hard case and were measured separately.** A preview
  cannot animate — `BoardPreview.css` pins `transition: none` on its pieces — so its rings are not a
  fallback for motion, they are all there is, and the departed square has no tint and no piece
  either. They survive at that size only because `BoardPreview.css` overrides the stroke to 0.1
  units, and #80 made that override load-bearing: against the old 0.045 base it was 2.2x, against
  0.016 it is 6.25x, so on screen the two lines are the same weight (1.2px on a 96px preview, 1.3px
  on a 646px board — measured, not intended). Removing the override leaves a fifth of a pixel and no
  dashes, and before this entry every test in the repository stayed green when it was removed.
  `e2e/last-ply-weight.spec.ts` now measures the preview's departed square too: desaturated, its
  dashes reach **86%** darker with the gaps at **0%**, and the ring breaks into 2 runs along the
  edge that is counted. **One number is worth recording and is not a regression:** at 96px the
  _arrival_ ring lands as a single antialiased row about **20%** darker than what is under it —
  much fainter than the departed square's. It is pre-existing, unchanged by #80, and that square
  has a tint and a piece on it as well, so nothing here rests on it; it is not measured, because a
  count at that weight would be reading the instrument rather than the board.
- **Looked at by hand:** the main board and a column of previews, both themes, 360px and desktop, in
  colour and under `grayscale(1)`. **Not performed:** the screen-reader and zoom rows, still.
  Reduced motion is now covered for the board specifically, and nowhere else in the product.

**2026-09-18 — the last-ply ring removed at the product owner's request; two tinted squares only.**
Not a release review; it records a deliberate narrowing of the shape channel this file otherwise
requires everywhere, and says exactly what was traded away.

- **What changed.** `.board__last-ply` — the dashed ring on the departed square and the solid ring
  on the arrival square, #54 through #80 — is gone. Both squares are a plain background colour and
  nothing is drawn on top of either. `--color-board-highlight-from` is restored to the token table.
- **Why the loudness argument from #80 does not reapply.** #80 measured the departed square's ring
  at 12.1% darkening against 4.9% for the faintest piece on the board, and attributed almost all of
  it to the ring rather than the fill (a plain fill alone, restored here, is close to an ordinary
  tinted square's own darkening — nothing like a filled block with a 0.045-unit near-black border
  around it). Removing the ring removes the thing that was loud; it does not resurrect the specific
  defect #80 fixed.
- **What is genuinely given up: the shape channel, for this one pair of squares only.** §2's binding
  rule is "colour is never the only signal", and for the last-ply mark it now is. The two tokens are
  chosen for a real luminance gap rather than only a hue difference — greyscale contrast **1.74:1**
  in the light theme and **2.57:1** in the dark theme between `--color-board-highlight-from` and
  `--color-board-highlight-to` (`board-contrast.test.ts`), against 1.05:1 / 1.10:1 for the tint pair
  that existed before #80. A learner who cannot see hue at all can still tell the two squares apart
  because one is visibly darker than the other; a learner who cannot perceive brightness
  differences either has no channel left here, which is the honest limit of a two-tint design and
  is not claimed to be equivalent to a shape difference.
- **What is not affected.** A screen-reader user gets the move from `Board`'s `aria-live` textual
  announcement (`role="status"`), which says which piece moved in words and does not depend on the
  visual highlight at all — this was true before #80 and remains true now. axe stays clean: the
  marks are geometry inside the board's `aria-hidden` SVG, as before.
- **Looked at by hand, both themes:** a live gambit page at desktop and at 360px, in colour and
  under `grayscale(1)`, and the 96px choice previews at 360px. In both themes the departed square
  reads as a visibly darker grey than the arrival square once desaturated, and both are plainly
  distinct from the plain wood around them; nothing was drawn on top of either at any size. **Not
  performed:** the screen-reader row.

**2026-09-18 — the two last-ply tints merged into one, at the product owner's request.** Not a
release review; it narrows the exception the entry above just recorded, and says exactly what was
traded away this time.

- **What changed.** `--color-board-highlight-from` and `--color-board-highlight-to` are replaced by
  one token, `--color-board-highlight`, at the arrival square's former gold value in both themes.
  `.board__square--from` and `.board__square--to` both draw it. Nothing else about the mark changed
  — no ring, no border, same two classes, same squares.
- **What is genuinely given up, on top of #88's luminance-only exception.** A learner could
  previously tell which square a ply left from which it reached by brightness alone, even without
  hue. That is gone: the two squares are now the identical token, so nothing on the board says
  which end of the last move is which — only that a move happened across this pair of squares. This
  is a real narrowing beyond #88, not a repaint at the same strength.
- **A weaker case was already true and is now load-bearing.** The gold token's contrast against a
  **light** square in the **dark theme** is **1.10:1** (`board-contrast.test.ts` does not assert a
  floor here — only that highlight and plain-light are unequal hex values). This is not new: it is
  the value `--color-board-highlight-to` already carried, and the arrival square already lived with
  it. What is new is that the departed square now carries it too, in place of the slate token's
  **1.74:1** against the same pairing. On a light square in dark mode, a fully desaturated viewer's
  best case for spotting the departed square is a fifth of what it was.
- **What is not affected.** The `aria-live` move announcement still carries the move in words and
  never depended on the visual highlight — true before #80, still true now. axe stays clean: the
  marks are geometry inside the board's `aria-hidden` SVG, as before.
- **Looked at by hand, both themes:** a live gambit page at desktop, in colour and under
  `grayscale(1)`. Both squares read as the same grey, as intended; both are still visibly distinct
  from the plain wood around them at every theme and square-colour combination tried, including the
  1.10:1 case above, which is faint but not absent. **Not performed:** 360px, the choice previews,
  and the screen-reader row.

---

## 6. Performance budgets

Concrete numbers a CI job fails against.

| Budget                          | Value                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Initial JavaScript              | < 200KB gzipped                                                                                            |
| Per-route incremental JS        | < 50KB gzipped                                                                                             |
| Catalogue payload               | ≤ 100KB gzipped, regardless of catalogue size                                                              |
| A single gambit tree            | Lazy-loaded; never bundled into the initial payload                                                        |
| LCP                             | < 2.5s, mid-tier mobile, 4G                                                                                |
| INP pressing next               | < 200ms — measured with Playwright and `PerformanceObserver`, **not** Lighthouse, which cannot measure INP |
| CLS                             | < 0.1 — the board reserves its aspect ratio, and the content region reserves a viewport                    |
| Third-party requests at runtime | **Zero**                                                                                                   |
| Fonts                           | Zero downloaded                                                                                            |

The catalogue budget is the one that will bite as coverage grows toward "every named gambit". It is
a tripwire in `PROJECT-PLAN.md`, not an afterthought.

**Where each of these is enforced** (#19). The values above stay the source of truth; this says
which job fails when one is exceeded, so a budget is never only a sentence in a document.

| Budget                      | Fails in                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Initial JavaScript          | `e2e/route-budgets.spec.ts`, per route, in the browser, on the built output                    |
| Per-route incremental JS    | `e2e/route-budgets.spec.ts`, against the JavaScript the entry route already downloaded         |
| Catalogue payload           | `e2e/catalogue-payload.spec.ts` over the whole file, and `e2e/route-budgets.spec.ts` per route |
| LCP                         | `lighthouserc.json` via `npm run perf:lighthouse`, on Lighthouse's own mid-tier mobile profile |
| CLS                         | `lighthouserc.json` as above, and `e2e/layout-stability.spec.ts` at 360px and 1280px           |
| INP pressing next           | `e2e/interaction-latency.spec.ts`, on the widest branch node in published content              |
| Third-party requests, fonts | `e2e/route-budgets.spec.ts`, and the Content Security Policy itself (`docs/security.md`)       |

The numbers each one currently measures are recorded in `docs/PROJECT-PLAN.md` §4, so drift is
visible without running anything.

---

## 7. Content and copy voice

- **Plain, honest, never promotional.** This site's entire value is that it does not overstate.
- **Never say "mate" for a position that is merely winning.** The vocabulary in `CONTEXT.md` is
  binding on UI copy, not just on code.
- **Soundness is stated without euphemism.** An unsound gambit is called unsound, and then its
  practical value is explained.
- **Chess notation is always standard SAN**, in all three locales. Piece letters are not localised —
  a Vietnamese learner reading `Nf3` reads the same thing every chess resource shows them.
- **Numbers over adjectives.** "Black is a pawn up but undeveloped" beats "Black is slightly better".

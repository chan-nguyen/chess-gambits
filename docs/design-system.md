# Design system — Chess Gambit Trainer

Binding on every implementation. An agent given tokens and a component inventory produces a coherent
product; an agent given "make it look good" produces a different product on every ticket.

Nothing here may be invented at implementation time. If a value is needed and is not in this
document, it is a change to this document first.

Last updated: 2026-09-16
Status: stack-independent sections complete; component implementation notes pending the Phase 2
stack ADRs.

---

## 1. Information architecture

### Route inventory

Locale is the first path segment on every route, so every URL is shareable with its language intact.

| Route                  | Purpose                                                                        | State in the URL                 |
| ---------------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| `/:locale/`            | What this is, in one screen. Entry to the catalogue. Resume where you left off | —                                |
| `/:locale/gambits`     | The full catalogue. Search and filter                                          | `q`, `side`, `soundness`, `tier` |
| `/:locale/gambits/:id` | The learning surface: board, navigation, tree, annotation                      | `line` (SAN path), `flip`        |
| `/:locale/about`       | What the coverage tiers mean, how mate claims are verified, credits, licences  | —                                |
| `*`                    | Not found, with a route back to the catalogue                                  | —                                |

`/` with no locale resolves the visitor's preferred language and redirects once. The chosen locale
is remembered in `localStorage` so the redirect is stable on return visits.

**Every piece of view state is in the URL.** Which gambit, which branch, which language, which board
orientation, which filters. This is requirement F8 and it is not negotiable: it is what makes a
branch shareable and a bug reproducible.

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

**Board colours**: `--color-board-light`, `--color-board-dark`, `--color-board-highlight-from`,
`--color-board-highlight-to`, `--color-board-check`, `--color-board-legal`, `--color-board-mark`,
`--color-board-coordinate`.

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

| Token                          | Light     | Dark      | Role                               |
| ------------------------------ | --------- | --------- | ---------------------------------- |
| `--color-board-light`          | `#ebd9b8` | `#bcab94` | Light square                       |
| `--color-board-dark`           | `#b58863` | `#927b66` | Dark square                        |
| `--color-board-highlight-from` | `#c9ce6e` | `#a3a155` | Square the last ply left           |
| `--color-board-highlight-to`   | `#e4c05a` | `#c2a24e` | Square the last ply arrived on     |
| `--color-board-check`          | `#d14b3f` | `#c4544a` | Disc behind a king in check        |
| `--color-board-mark`           | `#123a5e` | `#0f2e4a` | Ring on an arbitrary marked square |
| `--color-board-coordinate`     | `#1f1a14` | `#14110c` | File letters and rank numbers      |
| `--color-piece-white-fill`     | `#faf7f2` | `#e8e2d8` | White piece body                   |
| `--color-piece-white-stroke`   | `#16120d` | `#14110c` | White piece outline                |
| `--color-piece-black-fill`     | `#2a2520` | `#221e19` | Black piece body                   |
| `--color-piece-black-stroke`   | `#f0eae0` | `#cfc7ba` | Black piece outline                |

Three rules hold over this table in both themes, and each is asserted:

1. **A piece is legible on every surface it can sit on.** For each piece and each of the six square
   or highlight colours, the fill _or_ the stroke reaches 3:1. Neither alone can: a white piece's
   body vanishes on a light square and a black piece's body vanishes on a dark one, which is exactly
   what the outline is for.
2. **White and black survive greyscale.** The two fills reach 4.5:1 of each other, and each fill
   reaches 3:1 of its own stroke.
3. **Coordinates are readable on both squares.** `--color-board-coordinate` reaches 4.5:1 against
   both `--color-board-light` and `--color-board-dark`. One token rather than a per-square pair,
   because a single dark value clears both and a light one cannot clear the light square.

`--color-board-mark` is dark in both themes for the same reason: a mark ring must clear 3:1 on the
light _and_ the dark square, and only the dark end of the range does.

`--color-board-legal` has no value yet — v1 shows no legal moves, so nothing renders it.

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
- Board highlights carry a **shape or border difference**, not only a tint.
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

| Component            | Responsibility                                        | Notes                                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Board`              | Render a position                                     | Own SVG (ADR-0003). `role="grid"`, 64 cells, roving tabindex, one polite live region. Position comes in as a derived FEN, never authored. **Display only in v1** — no piece is ever dragged                                                   |
| `BoardPreview`       | Small static board for branch choices                 | Same renderer, no coordinates, not in the tab order — many mount at once                                                                                                                                                                      |
| `MoveNavigator`      | Previous / next / jump to start                       | Previous disabled at root, next disabled at leaf                                                                                                                                                                                              |
| `MoveList`           | Plies of the current path, current one marked         | Monospace; click to jump                                                                                                                                                                                                                      |
| `BranchChoices`      | The replies at an opponent node                       | Each: preview, SAN, quality icon + label, frequency, provenance. Also renders `dismissed` replies, collapsed, with their reason — an omission the learner can see is honest; one they cannot is the product's core failure                    |
| `PlanChoices`        | A **learner** node with more than one prescribed move | A genuine choice of plans, e.g. the Evans after 5...Ba5 where 6.d4 and 6.O-O are both main lines. Distinct from `BranchChoices`: these are the learner's options, not the opponent's threats                                                  |
| `MateNet`            | The refutation of every defensive try                 | **One** shared board plus a SAN list, never one preview per reply — a defender node in a net can have 24 legal replies, and 24 board instances on a 360px phone is not a design                                                               |
| `AnnotationPanel`    | The current node's prose                              | Shows the untranslated marker on fallback                                                                                                                                                                                                     |
| `OutcomeCard`        | A leaf's outcome                                      | **Two distinct components**, not one with a flag                                                                                                                                                                                              |
| `MateOutcome`        | Proved forced mate                                    | States the mate count, the forced sequence, and links to how it was proved                                                                                                                                                                    |
| `AssessmentOutcome`  | Favourable / equal / worse position                   | Evaluation plus middlegame plan                                                                                                                                                                                                               |
| `GambitTree`         | The whole tree, current node highlighted              | Collapses to an overlay below 768px                                                                                                                                                                                                           |
| `TierBadge`          | Listed / Mapped / Taught                              | Always links to the About page's explanation                                                                                                                                                                                                  |
| `SoundnessBadge`     | Sound / dubious / unsound                             | Honest wording, no euphemism                                                                                                                                                                                                                  |
| `CatalogueFilters`   | Search and filter                                     | Writes to the URL, reads from the URL                                                                                                                                                                                                         |
| `GambitCard`         | One catalogue entry                                   | Name, ECO, side, soundness, tier, progress                                                                                                                                                                                                    |
| `LanguageSwitcher`   | vi / en / fr                                          | Preserves the current route and `line` exactly                                                                                                                                                                                                |
| `ProgressMarker`     | Mark a branch learned                                 | Optimistic; a `localStorage` failure is silent, never a crash. Stored data carries a schema `version`, and an unrecognised version is discarded with a notice rather than silently wiping progress                                            |
| `CoverageSummary`    | Aggregate honesty, in the header                      | "612 listed · 30 mapped · **10 taught**". Per-entry tier badges make each page honest; only this makes the _composition_ honest                                                                                                               |
| `UntranslatedNotice` | Marks fallback content                                | Honest and unobtrusive; never blocks reading                                                                                                                                                                                                  |
| `EmptyTree`          | The Tier 0 state                                      | A real designed state (F15), never a spinner or a 404                                                                                                                                                                                         |
| `ContentLoadError`   | A gambit **tree** failed to fetch                     | Names what failed, offers retry, keeps the rest of the page usable. **Not** used for a locale bundle — that reuses `UntranslatedNotice`'s vocabulary, per the failure-states table below, and this row said otherwise until #7 implemented it |

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

### Progress is a count, not a percentage

"12 of 20 branches", not "60%". A percentage falls when content improves: a learner at 100% on the
Evans drops to 60% the day three branches are added, with no explanation and no way to tell an
improvement from a regression. Mate nets are excluded from the denominator entirely — a generated
net with 300 leaves would make every real gambit read as 4% complete forever.

### Catalogue chunking

Also found by walking the journey. The catalogue budget is 100KB gzipped _regardless of catalogue
size_, but a naïve catalogue carries every entry's name in all three locales — which multiplies the
largest field by three for no benefit, since a visitor reads one language.

**The catalogue is built per locale**: `catalogue.vi.json`, `catalogue.en.json`, `catalogue.fr.json`.
A visitor downloads one. Locale-independent fields (ECO, side, category, soundness, tier, defining
line) are identical across the three, which is accepted duplication — it costs a few KB and avoids a
second request and a join on the critical path.

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
  and is not a screen-reader user, which is a limitation to state rather than to paper over.

---

## 6. Performance budgets

Concrete numbers a CI job fails against.

| Budget                          | Value                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Initial JavaScript              | < 200KB gzipped                                                                                            |
| Per-route incremental JS        | < 50KB gzipped                                                                                             |
| Catalogue payload               | < 100KB gzipped, regardless of catalogue size                                                              |
| A single gambit tree            | Lazy-loaded; never bundled into the initial payload                                                        |
| LCP                             | < 2.5s, mid-tier mobile, 4G                                                                                |
| INP pressing next               | < 200ms — measured with Playwright and `PerformanceObserver`, **not** Lighthouse, which cannot measure INP |
| CLS                             | < 0.1 — the board reserves its aspect ratio before it renders                                              |
| Third-party requests at runtime | **Zero**                                                                                                   |
| Fonts                           | Zero downloaded                                                                                            |

The catalogue budget is the one that will bite as coverage grows toward "every named gambit". It is
a tripwire in `PROJECT-PLAN.md`, not an afterthought.

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

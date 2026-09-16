# Chess Gambit Trainer — Project Plan

Status: Delivery
Last updated: 2026-09-16

> Living document. Update it when reality diverges from it — a plan nobody updates is a plan nobody
> trusts. Sections 1–3 are the scope contract and need the owner's agreement before Phase 2.

## 1. Scope contract

### Problem

Club-level players learn gambits from videos and books, which are linear. They teach one line and
cannot answer the question that actually decides the game: _"what if my opponent plays something
else?"_ Existing tools split the difference badly — Lichess Studies can hold a move tree but are
built for analysis, not teaching, and neither they nor video courses distinguish clearly between
"this branch is a forced mate because your opponent blundered" and "this branch is just a pleasant
middlegame". That distinction is the single most misunderstood thing about gambits: most gambits do
**not** force mate, and a learner who believes otherwise plays them badly.

This project is an interactive gambit tree: pick a gambit, walk it move by move, and at every point
where the opponent has a real choice, see every reply and where each one leads — either to a proven
forced mate, or to an assessed middlegame position with a plan.

### Users

| Who                                                        | What they need to do                                                                                                                  | What they do today instead                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Primary: the owner, a club-level player (~800–1600)        | Memorise a gambit repertoire for White and Black, and know for each opponent reply whether it loses by force or just concedes an edge | YouTube videos, scattered Lichess studies, no retention |
| Secondary: Vietnamese/English/French speaking club players | Same, in their own language                                                                                                           | Mostly English-only material                            |
| Content maintainer (also the owner)                        | Add a new gambit without touching application code, and be stopped by CI if the chess is wrong                                        | n/a — new project                                       |

### Success

Stated as behaviour, not feeling:

- **S1** — A learner opens a gambit cold and, without any external reference, reaches every leaf of
  its tree and can state correctly which replies lose by force and in how many moves.
- **S2** — Adding gambit number N+1 is a pull request that changes **only** content files.
- **S3** — The owner uses it to prepare before real games, and can name at least three positions
  where it changed a move they played.
- **S4** — No known incorrect chess claim is live. Every "mate in N" label on the site has been
  proved by an automated search, not asserted by a human.
- **S5** — The catalogue is exhaustive: a learner who encounters a named gambit anywhere finds it
  here, even if it is not yet taught in depth. The site never pretends a thin entry is a deep one.

### In scope (v1)

Each item is phrased so a test can fail against it.

- **Board** renders the position of the currently selected tree node, correct to its FEN, with file
  and rank coordinates, and can be flipped so the learner's side is always at the bottom.
- **Exhaustive catalogue of gambits and named opening traps.** Every entry is listed, each tagged
  `gambit` or `trap`, with name, ECO code,
  side (White/Black), its defining move sequence, and an honest soundness label (sound / dubious but
  practical / unsound but tricky). Breadth is imported mechanically from open data and validated,
  not hand-typed.
- **Coverage tiers, shown on every gambit.** Depth is a per-gambit property, stated plainly:
  - **Tier 0 — Listed**: identity, moves, ECO, side, soundness. Machine-imported, CI-validated.
  - **Tier 1 — Mapped**: the opponent's realistic replies are modelled as a tree and every leaf has
    an outcome. Annotations may be thin and Vietnamese-only.
  - **Tier 2 — Taught**: full annotations, any mate claim proved by search, middlegame plans, and
    English and French translations present.
    A gambit's tier is derived from its content by the build, never hand-declared, so it cannot lie.
- **Catalogue search and filter** by name, ECO, side, soundness and tier — a flat list of several
  hundred entries is not usable.
- **Linear navigation** — next and previous step through moves. Previous is disabled at the root;
  next is disabled at a leaf.
- **Branching** — at a node where the opponent has more than one modelled reply, the UI presents
  every reply as a choice, each with a preview board and a label for how good and how common that
  reply is. The learner picks one and navigation continues down that branch.
- **Tree view** — the whole gambit tree is visible at once, the current node is highlighted, and
  clicking any node jumps to it.
- **Leaf outcomes** — every leaf carries exactly one of:
  - `mate` — "Checkmate in N" plus the forced sequence, **only** where a search has proved it forced;
  - `position` — an evaluation and a written middlegame plan.
    The two are visually distinct and never presented as the same kind of claim.
- **Shareable state** — the selected gambit, the path through the tree, and the locale are all in
  the URL. Pasting a URL restores the exact board and branch.
- **Trilingual** — Vietnamese, English, French, switchable in the UI, locale in the URL. Any text
  with no translation falls back to Vietnamese and is visibly marked as untranslated.
- **Progress** — the learner can mark a branch as learned; progress persists in `localStorage` and
  each gambit shows a completion percentage. No account, no server.
- **Content as data** — gambits live in versioned content files with a published schema. Adding one
  requires no application code change.
- **Content CI gate** — a pull request is blocked when any modelled move is illegal from its parent
  position, when a node claims checkmate and the position is not checkmate, when a leaf claims
  "mate in N" that a search cannot prove forced, or when a node has no Vietnamese annotation.

### Explicitly out of scope

- **Accounts, login, cross-device sync** — v2 at the earliest; requires a backend, which this v1
  deliberately does not have.
- **In-browser engine analysis (Stockfish WASM)** — v2. The architecture must isolate evaluation
  behind a seam so it can be added without a rewrite, but no engine ships in v1.
- **Practice / quiz mode** (machine plays the opponent, learner must find the move) — v2.
- **Spaced repetition scheduling** — v2, and depends on practice mode.
- **Playing a full game against a computer** — not wanted.
- **User-supplied PGN import or user-created studies** — not wanted; the value here is curation.
- **A real-game database or opening explorer statistics** — not wanted; deliberately no third-party
  API dependency.
- **Offline / PWA / installable app** — v2.
- **Comments, accounts, community, sharing beyond a URL** — not wanted.
- **Any chess content that is not a gambit or a named opening trap** — no endgames, no tactics
  trainer, no general opening repertoire. Traps were brought in scope on 2026-09-16 because several
  of the best forced-mate traps (Légal's Mate in the Italian, the Fishing Pole in the Ruy Lopez, the
  Elephant Trap in the Queen's Gambit Declined) are not gambits, and excluding them would have cut
  the strongest teaching material for the exact thing the brief asked for.
- **Analytics, tracking, cookies of any kind** — not wanted, and their absence is what keeps this
  project free of privacy obligations entirely.

### Assumptions

Marked as assumptions because they were decided rather than confirmed.

- **Under ~1,000 visitors a month in year one.** If wrong: static hosting still copes; only the
  bandwidth soft limit is worth re-reading.
- **The learner already reads algebraic notation (e4, Nf3).** If wrong: a notation primer becomes a
  requirement, which is a new epic.
- **Content is authored by one person.** If wrong (contributors appear): the content schema and CI
  gate already anticipate it, but a contribution guide and review process become necessary.
- **English and French annotations are produced by the owner with AI assistance, not a paid
  translator.** If wrong: translation becomes a budget line rather than a time line.
- **v1 ships an exhaustive Tier 0 catalogue and a small number of Tier 2 gambits.** The Tier 0
  count is whatever the survey finds exists (expected to be in the hundreds — to be measured, not
  guessed). Tier 2 depth accrues over time; the release target is **10 Tier 2 gambits (about 6
  White, 4 Black)** and at least 30 at Tier 1. These are targets, not release blockers.
- **A permissively licensed open dataset of named openings exists and may be redistributed.** The
  exhaustive catalogue depends on this. If wrong: breadth must be hand-entered, which would make the
  exhaustive catalogue a multi-month effort and it would be re-scoped with the owner.

## 2. Constraints

| Constraint                     | Value                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Launch users / year-one users  | ~1 (owner) at launch; assumed under 1,000/month in year one                                                   |
| Budget (setup / monthly)       | **$0 / $0.** Custom domain (~$12/year) optional, owner's call, not assumed                                    |
| Deadline                       | None. Correctness is explicitly prioritised over speed                                                        |
| Maintainer after launch        | The owner, solo. Comfortable with TypeScript; will maintain both code and chess content                       |
| Data sensitivity               | **None.** No accounts, no personal data, no cookies, no analytics, no server logs                             |
| Compliance obligations         | None, as a consequence of the line above. This is a deliberate design property and must be defended in review |
| Committed platforms or vendors | GitHub (repo, Actions, Pages). Public repository                                                              |
| Supported browsers and devices | Last two versions of Chrome, Firefox, Safari, Edge; iOS Safari; Android Chrome. Viewport from 360px wide      |

## 3. Requirements

### Functional

| ID  | Requirement                                                                               | Priority | Acceptance                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Board renders the current node's position                                                 | must     | Rendered piece placement equals the node's FEN for every node in every shipped gambit (property test over all content)                                                           |
| F2  | Board can be flipped, and defaults to the learner's side                                  | must     | Opening a Black gambit shows Black at the bottom without user action; flip control toggles it                                                                                    |
| F3  | Exhaustive gambit catalogue with name, ECO, side, moves, soundness                        | must     | Every entry has all five fields populated; schema rejects a missing one; a spot-check list of known gambits is all present (test asserts a fixed list of named gambits resolves) |
| F4  | Next / previous navigation                                                                | must     | From the root, previous is disabled; next advances one ply; at a leaf, next is disabled                                                                                          |
| F5  | Branch choice at multi-reply nodes                                                        | must     | A node with n>1 children renders n choices, each with a preview board and a quality label; selecting one navigates into that branch                                              |
| F6  | Full tree view with current-node highlight and click-to-jump                              | must     | Clicking any node sets the board and the URL to that node                                                                                                                        |
| F7  | Leaf outcome labelled `mate` or `position`, visually distinct                             | must     | Every leaf in shipped content has exactly one outcome; the two render with different components and different text                                                               |
| F8  | URL encodes gambit + path + locale; restorable and shareable                              | must     | Copying the URL into a fresh browser reproduces the identical board, branch and language                                                                                         |
| F9  | Locale switcher for vi/en/fr with Vietnamese fallback and an untranslated marker          | must     | With a French annotation deleted, the UI shows the Vietnamese text plus a visible "not translated" marker, and does not show a blank or a key                                    |
| F10 | Mark branch learned; persisted in localStorage; per-gambit completion percentage          | should   | Marking a branch and reloading preserves it; clearing site data resets it without error                                                                                          |
| F11 | Adding a gambit changes only content files                                                | must     | A new gambit is added in a PR touching no file under the application source directory, and it appears in the catalogue                                                           |
| F12 | CI rejects invalid content                                                                | must     | A PR introducing an illegal move, a false checkmate claim, an unproven "mate in N", or a Tier 2 node missing Vietnamese text fails CI with a message naming the file and node    |
| F13 | Coverage tier is derived from content, displayed on every gambit, and never hand-declared | must     | Deleting a gambit's annotations demotes its displayed tier on the next build with no other edit; a hand-written tier field in a content file is rejected by the schema           |
| F14 | Catalogue search and filter by name, ECO, side, soundness, tier                           | must     | Typing a gambit name filters to it within one keystroke of it becoming unambiguous; filters compose; filter state is in the URL                                                  |
| F15 | Tier 0 entries are honestly presented, not as broken Tier 2 pages                         | must     | Opening a Tier 0 gambit shows its moves and identity plus an explicit "not yet taught in depth" state — never an empty tree, a spinner, or a 404                                 |

### Non-functional

| ID  | Requirement                                                                           | Target                                                                                                                               | How measured                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1  | Largest Contentful Paint                                                              | < 2.5s on mid-tier mobile over 4G                                                                                                    | Lighthouse CI in the pipeline                                                                                                                                                                                                                                                  |
| N2  | Interaction to Next Paint, pressing next                                              | < 200ms                                                                                                                              | **Playwright** dispatching the real interaction and reading `PerformanceObserver` event timings, CPU-throttled, against the built output, on a gambit with a wide branch node. _Lighthouse cannot measure INP — it is a field metric and its lab proxy is Total Blocking Time_ |
| N3  | Initial JavaScript                                                                    | < 200KB gzipped, measured **per route** including that route's data payload                                                          | Bundle-size budget enforced in CI                                                                                                                                                                                                                                              |
| N4  | Accessibility                                                                         | WCAG 2.2 AA                                                                                                                          | axe automated pass plus a keyboard-only walkthrough of a full gambit tree                                                                                                                                                                                                      |
| N5  | Board is fully keyboard operable, and pieces are distinguishable without colour alone | Pass                                                                                                                                 | Keyboard walkthrough; greyscale screenshot review                                                                                                                                                                                                                              |
| N6  | Every move change is announced to assistive technology                                | Pass                                                                                                                                 | Live-region assertion in tests                                                                                                                                                                                                                                                 |
| N7  | Layout works from 360px wide with no horizontal scroll                                | Pass                                                                                                                                 | Playwright viewport tests at 360 / 768 / 1280                                                                                                                                                                                                                                  |
| N8  | No network request to any third party at runtime                                      | Zero                                                                                                                                 | Playwright network assertion: no request outside the site origin                                                                                                                                                                                                               |
| N9  | Content correctness                                                                   | Zero unproven chess claims shipped                                                                                                   | The F12 CI gate; a red gate blocks merge                                                                                                                                                                                                                                       |
| N10 | Catalogue loads and filters without jank                                              | Filter response < 100ms; catalogue payload ≤ 100KB gzipped **up to 1,500 entries**, beyond which it collapses to families by default | Performance test over the full generated catalogue, not a sample                                                                                                                                                                                                               |
| N11 | Every route shell carries its own `lang`, title and link-preview metadata             | 100% of shells                                                                                                                       | Build assertion plus a Playwright check on one deep link per locale                                                                                                                                                                                                            |
| N12 | A shared `line` URL round-trips exactly                                               | 100% of paths in shipped content                                                                                                     | Property test: encode → URL → parse → compare, over every path in every gambit                                                                                                                                                                                                 |

## 4. Architecture summary

A single-page application built with Vite and React, compiled to static files and served from a CDN.
There is no server, no database and no API. Chess content is authored in a board GUI, exported as
PGN, imported once into per-gambit YAML files that become the source of truth, and compiled at build
time into minified JSON that the browser lazy-loads one gambit at a time. Every position is derived
by replaying moves rather than stored, and every forced-mate claim is proved by the build rather than
written by a person.

The architecture's defining property is that **correctness lives in the build, not at runtime**. The
PGN parser, the rules engine and the mate prover all run in CI and none of them ship to the browser,
which is simultaneously what keeps the bundle inside its budget, what makes bad content impossible to
publish, and what allows the runtime to have no third-party dependency at all. The one deliberately
placed extension point is an `EvaluationSource` interface, so the in-browser engine the owner
deferred to v2 can be added without touching a component.

All versions and licences below were verified against the npm registry on 2026-09-16.

| Decision                               | Choice                                                                      | Licence                                          | Monthly cost | ADR        |
| -------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | ------------ | ---------- |
| Architecture shape                     | Static client-side app, no backend                                          | —                                                | $0           | 0001       |
| Build tool / framework                 | Vite 8.3.0 + React 19.3.0 + TypeScript 7.0.2                                | MIT / MIT / Apache-2.0                           | $0           | 0002       |
| Routing                                | React Router 8.4.0, pre-built route shells                                  | MIT                                              | $0           | 0002, 0009 |
| Board rendering                        | **Own SVG board (~2 KB)** — no library                                      | ours                                             | $0           | 0003       |
| Chess rules                            | chess.js 1.4.0 — build-time validation, optional at runtime                 | BSD-2-Clause                                     | $0           | 0004       |
| PGN import (build only, never shipped) | @mliebelt/pgn-parser 1.4.19                                                 | Apache-2.0                                       | $0           | 0004       |
| Content format and schema              | PGN in → YAML source of truth → JSON build output                           | —                                                | $0           | 0004       |
| Mate verification                      | Engine oracle finds, generator expands, CI verifies a committed certificate | Stockfish GPL-3.0, **build only, never shipped** | $0           | 0005       |
| i18n                                   | i18next 26.4.2 + react-i18next 17.0.14                                      | MIT                                              | $0           | 0006       |
| Hosting                                | GitHub Pages from a public repo                                             | —                                                | $0           | 0007       |
| Catalogue data source                  | lichess-org/chess-openings                                                  | **CC0**                                          | $0           | 0008       |
| Deep links on a static host            | Pre-built route shells, real HTTP 200                                       | —                                                | $0           | 0009       |
| Evaluation / future engine             | `EvaluationSource` behind a Web Worker seam                                 | —                                                | $0           | 0010       |

**Rejected on licence, recorded so it is not re-proposed:** `@lichess-org/chessground` and `chessops`
are GPL-3.0-or-later and `kokopu` is LGPL-3.0-or-later. Bundling any of them into a site served to
the public is distribution, which would force this application under the GPL. chessground is the
better board on the merits; the licence is what decided it.

### Running cost

| Service           | Tier              | Monthly  | Free-tier limit (verified 2026-09-16)                                                                                                                             | What happens at the limit                                                                                                                                          |
| ----------------- | ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Pages      | Free, public repo | **$0**   | Published site ≤ 1 GB; 100 GB/month soft bandwidth; 10 builds/hour soft limit — **which does not apply when publishing from a custom Actions workflow**, as we do | Soft limits; GitHub makes contact rather than cutting off. A few MB of content sits nowhere near 1 GB                                                              |
| GitHub Actions    | Free, public repo | **$0**   | Standard GitHub-hosted runners are free for public repositories                                                                                                   | **Larger runners are always billed** — the workflow must stay on `ubuntu-latest`. This is a review item, not a hope                                                |
| Domain (optional) | —                 | $0 today | —                                                                                                                                                                 | A custom domain is ~$12/year and is the owner's call. Not assumed, not budgeted. Note it moves the site from `/<repo>/` to `/`, which ADR-0009 already anticipates |

**Total: $0/month.** GitHub Pages is not permitted as free hosting for commercial or SaaS purposes; a
free learning site is within its terms.

### Performance budgets

- Initial JavaScript under 200KB gzipped; any PR exceeding it fails CI.
- Content files are lazy-loaded per gambit; the catalogue page must not download every gambit tree.
- LCP under 2.5s and INP under 200ms on a mid-tier mobile profile.

## 5. Plan

Repository: <https://github.com/chan-nguyen/chess-gambits> · Board: Personal Apps (project 1) ·
Live: <https://chan-nguyen.github.io/chess-gambits/>

### Epics

| Milestone                   | Outcome                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **E1 Walking skeleton**     | The architecture proven end to end: base path, deep links returning real HTTP 200s, deployed, with per-shell metadata |
| **E2 Content pipeline**     | Schema, the thirteen validation checks, PGN import and export, compilation to JSON                                    |
| **E3 Mate proving**         | Engine oracle, certificate generator, independent verifier, red-test corpus                                           |
| **E4 Learning surface**     | Board, navigation, branch choices, tree view, outcome components                                                      |
| **E5 Catalogue**            | Dataset import, families, frozen ids, search and filters                                                              |
| **E6 Internationalisation** | Three locales, Vietnamese fallback, visible untranslated marker                                                       |
| **E7 Progress**             | Per-browser progress, stored locally, counted rather than percentaged                                                 |
| **E8 Quality gates**        | Accessibility and performance enforced in CI                                                                          |
| **E9 Seed content**         | The first three taught entries                                                                                        |

### Waves

Everything in a wave is independent and may run in parallel; each wave depends on the one before.
Independence here means **disjoint files**, not merely unrelated goals — two agents editing one
module corrupt each other's work regardless of how different their tickets sound.

| Wave     | Tickets                                                             | Why these, together                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** ✅ | #16 routing · #3 content schema · #4 board                          | The riskiest integration plus two genuinely isolated units. #16 owns the router and build scripts, #3 owns content validation and touches nothing in `src/`, #4 owns one component and imports no chess logic |
| **2**    | #2 tokens and shell · #5 mate proving · #6 compile and load         | #2 fills the routes #16 created; #5 and #6 both build on the #3 schema but own separate scripts                                                                                                               |
| **3**    | #7 i18n · #8 navigation · #12 catalogue import                      |                                                                                                                                                                                                               |
| **4**    | #9 branch choices · #10 tree view · #11 outcomes · #14 progress     | All four extend the learning surface #8 establishes, in separate components                                                                                                                                   |
| **5**    | #13 catalogue page · #17 shell metadata                             |                                                                                                                                                                                                               |
| **6**    | #15 seed content · #18 accessibility gate · #19 performance budgets |                                                                                                                                                                                                               |

Concurrency is capped at roughly four implementation agents — the limit is review capacity, not the
machine. Unreviewed parallel work is not throughput.

### What the owner merges

Scaffolding, documentation and test-only changes may be merged once CI is green and the diff has been
read. **Every feature pull request is the owner's call.** Tickets labelled `needs-human` touch CI
workflows or the build and are never self-merged.

### Walking-skeleton exit criteria

Wave 1 is not done because three pull requests merged. It is done when all of these hold:

- [x] The base path works, and `BASE_PATH=/` produces a working root-served build — CI runs the
      e2e suite at both base paths
- [x] One deep link returns HTTP 200 — verified on live GitHub Pages, not only locally:
      `/chess-gambits/fr/about` → 200, `/chess-gambits/xx/about` → 404
- [ ] …with the correct `lang` and a distinct title — **open, #17.** Shells still carry `lang="en"`
      and the scaffold title, which is the WCAG 3.1.1 Level A issue ADR-0009 names
- [x] A `line` parameter containing `+` and `#` round-trips exactly — property test over 400
      generated paths
- [ ] One proved mate certificate verifies in CI — **open, #5.** The content gate rejects a false
      checkmate claim today; nothing yet proves a mate is _forced_
- [x] The bundle is measured and recorded — **100.38KB gzipped of 200KB**

**Two of six remain open, both in later waves. Wave 1 is complete; the walking skeleton is not.**

## 6. Risks

| Risk                                                                                                                                                                                                                                                | Likelihood                     | Impact       | Mitigation or acceptance                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Annotated depth is the bottleneck, not code.** An annotated gambit tree in three languages is far more work than the application itself, and this cost does not shrink with an exhaustive catalogue — it is simply no longer on the critical path | High                           | High         | Separate breadth from depth. Breadth is imported mechanically and is essentially free. Depth accrues per gambit as content-only PRs. Build the platform first and seed three Tier 2 gambits to prove the pipeline end to end. Tier counts are targets, never release blockers |
| **The exhaustive catalogue is a promise the site cannot keep at depth**, and a site full of empty trees reads as abandoned                                                                                                                          | Medium                         | Medium       | Tier 0 entries get a purpose-built honest state (F15), never a degraded Tier 2 page. The tier is derived from content (F13) so it can never overstate                                                                                                                         |
| ~~The open opening dataset may be unusable~~ — **resolved 2026-09-16.** lichess/chess-openings is CC0 public domain                                                                                                                                 | —                              | —            | Closed. ADR-0008. A curated include/exclude list still governs what counts as a gambit, so classification stays a reviewed decision                                                                                                                                           |
| ~~Board library licence~~ — **resolved 2026-09-16.** chessground and chessops confirmed GPL-3.0-or-later; no board library adopted at all                                                                                                           | —                              | —            | Closed. ADR-0003. The question returns only if an engine is shipped to the browser — Stockfish is GPL-3.0, lichess's WASM build AGPL-3.0                                                                                                                                      |
| **We now own a board renderer.** A bounded scope that could grow                                                                                                                                                                                    | Medium                         | Medium       | Tripwire in ADR-0003: past ~400 lines, or any rules logic creeping in, swap to cm-chessboard (MIT, 8.4 KB)                                                                                                                                                                    |
| **Reply completeness was the gap the whole product turns on**, and the first design never checked it                                                                                                                                                | —                              | —            | Closed by ADR-0004 check 7: every legal reply is either modelled or explicitly dismissed with a reason, and tier derivation counts it. Found by adversarial review, not by testing — which is the argument for running one                                                    |
| **The verifier is the product's only guarantee.** A defect in it is not a bug, it is a silent false claim on every page                                                                                                                             | Low                            | **Critical** | Red-test corpus of certificates that must each be rejected (ADR-0005). The `UNKNOWN`-poisons-upward test is mandatory, because fail-soft is the likeliest implementation error                                                                                                |
| **Bundle budget: 100.38KB of 200KB spent before the product exists.** React Router is ~32KB of it                                                                                                                                                   | Medium                         | Medium       | The own SVG board came in at 2,496 bytes against react-chessboard's 21.9KB, recovering ~10% of the budget. Re-measure after i18n (~23KB); past 150KB the router is the first thing to revisit                                                                                 |
| **A gate nobody has tried to break is a gate nobody knows works.** Four were found broken on the first day of delivery                                                                                                                              | **Certain — already observed** | High         | Every gate ticket now requires an adversarial fixture that must fail the gate, asserted in CI. #28 applies it to the `any`/`as`/`!` rule                                                                                                                                      |
| **Reply completeness is correct and currently unauthorable** — the Evans after 4.b4 needs 34 individual dismissals at the first branch point of the first gambit                                                                                    | High                           | High         | #29 adds a catch-all dismissal that keeps the guarantee. Without it the author stops modelling opponent nodes, which is worse than the gap the check closes                                                                                                                   |
| **Day one the site is ~10 taught entries inside a few hundred listed ones.** Every page is individually honest and the composition still misleads                                                                                                   | High                           | Medium       | Aggregate counts in the header, catalogue defaults to Taught, home routes to a taught entry rather than the raw catalogue                                                                                                                                                     |
| ~~GitHub Pages sub-path and deep links~~ — **resolved 2026-09-16** by pre-built route shells                                                                                                                                                        | —                              | —            | Closed. ADR-0009. Must still be proven working in the walking skeleton before any route is written                                                                                                                                                                            |
| **Deep forced mates cannot be proved in CI.** Measured: mate in ≤3 in forcing positions proves in 2–40ms, but the Fishing Pole's mate in 4 hit a 3-million-node cap after 160 seconds                                                               | High                           | Low          | Accepted by design. Unprovable claims are refused, not guessed at — the leaf becomes an honest assessment instead. ADR-0005                                                                                                                                                   |
| **The refutation sweep is the expensive direction** — proving a reply does _not_ lose by force costs 0.5–7.1s per position                                                                                                                          | Medium                         | Medium       | Shallow depth on every pull request, full depth on a schedule. If it cannot be kept to a few minutes, it stops gating pull requests — and that reduction is recorded in ADR-0005 rather than made quietly                                                                     |
| **Published opening-trap sources are unreliable.** Three of the most widely repeated trap lines name the wrong losing move, and four famous "traps" are material wins rather than mates                                                             | **Certain — already observed** | High         | This is the justification for ADR-0005. Every mate is machine-proved; no source is trusted, including well-known ones                                                                                                                                                         |
| **Wrong chess teaches the learner wrong openings.** A mislabelled "mate in 5" is worse than no site                                                                                                                                                 | Medium                         | High         | The F12 CI gate. No "mate in N" label may be authored by hand — it must be produced and re-verified by an automated forced-mate search over the modelled position                                                                                                             |
| **Three locales triple the content cost** and half-translated content looks broken                                                                                                                                                                  | High                           | Medium       | Vietnamese is the only locale CI requires. English and French fall back to Vietnamese with a visible marker. Translation never blocks a release                                                                                                                               |
| **Solo project, no second reviewer.** Nobody catches the owner's mistakes                                                                                                                                                                           | High                           | Medium       | CI is the reviewer: type checking, tests, content validation, bundle budget, axe, Lighthouse. Automated review on every PR. Feature PRs are merged by the owner, never self-merged by the assistant                                                                           |
| **Personal-project motivation decays** before the content is finished                                                                                                                                                                               | High                           | Medium       | Ship a usable site at three gambits. Every milestone is independently useful. No milestone requires finishing all content                                                                                                                                                     |
| **Scope creep toward the v2 list** (engine, practice mode, accounts) during delivery                                                                                                                                                                | Medium                         | Medium       | The out-of-scope list is contractual. Any addition is a written scope change agreed with the owner, not a quiet extra commit                                                                                                                                                  |

## 7. Tripwires

| Signal                                                      | Revisit                                                                                             | ADR  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---- |
| Initial JS exceeds 200KB gzipped after adding the tree view | Board library and bundling strategy                                                                 | 0003 |
| A content-only PR requires an application source change     | Content schema — F11 is broken                                                                      | 0005 |
| Forced-mate verification takes longer than ~60s in CI       | Verification strategy; consider precomputing and committing proofs                                  | 0005 |
| GitHub Pages bandwidth or size soft limit is approached     | Hosting choice                                                                                      | 0007 |
| The owner asks for accounts or cross-device sync            | The no-backend decision, and the whole cost model                                                   | 0001 |
| Catalogue payload exceeds 100KB gzipped as breadth grows    | Catalogue loading strategy — consider server-free search indexing or pagination                     | 0008 |
| Tier 2 count has not grown in two months                    | Whether depth authoring is realistically sustainable, and whether the target should be cut honestly | 0005 |

## 8. Status log

| Date       | Phase            | What changed                                                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                                                                                                |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-16 | 1 — Discovery    | Scope contract drafted from the owner's brief and two rounds of questions                                                                                                                                                                                                                                                                                                      | Project start                                                                                                                                                                                                      |
| 2026-09-16 | 1 — Discovery    | Corrected the brief's premise that gambits lead to forced mate; leaves now carry two distinct outcome types                                                                                                                                                                                                                                                                    | Most gambits do not force mate; presenting them as if they do would teach incorrect chess                                                                                                                          |
| 2026-09-16 | 1 — Discovery    | Scope widened from ~12 gambits to an exhaustive catalogue, with depth expressed as derived coverage tiers (F13–F15, N10)                                                                                                                                                                                                                                                       | Owner asked for maximum coverage. Breadth is cheap and mechanical; depth is not. Tiers let the catalogue be complete without overstating how much is taught                                                        |
| 2026-09-16 | 1 — Discovery    | Owner approved the scope contract, with the coverage revision above                                                                                                                                                                                                                                                                                                            | Phase 1 gate passed                                                                                                                                                                                                |
| 2026-09-16 | 2 — Architecture | Domain model, design system and threat model written                                                                                                                                                                                                                                                                                                                           | Foundations that do not depend on library choice                                                                                                                                                                   |
| 2026-09-16 | 2 — Architecture | Scope widened again to include named opening traps that are not gambits, tagged `category`                                                                                                                                                                                                                                                                                     | Owner's decision. Légal's Mate, the Fishing Pole and the Elephant Trap are not gambits, and they are the best material for the brief's stated goal                                                                 |
| 2026-09-16 | 4 — Delivery     | **Wave 1 delivered.** Routing with real HTTP 200 deep links verified on live Pages; content gate with 27 adversarial fixtures; own SVG board at 2,496 bytes gzipped against react-chessboard's 21.9KB. 580 tests green on `main`                                                                                                                                               | Walking skeleton proven where it could be; two exit criteria remain, both in later waves                                                                                                                           |
| 2026-09-16 | 4 — Delivery     | **Four gate defects found in one day, three of them mine.** `oxlint` exited 0 on warnings so the lint gate could never fail; `oxlint` enforces none of `any`/`as`/`!` though the definition of done requires them (#28); a vitest `include` silently dropped five content-gate test files; a wall-clock performance assertion passed at 52ms locally and failed at 341ms on CI | Every one surfaced only because something tried to violate it. Gate tickets now require an adversarial fixture that must fail                                                                                      |
| 2026-09-16 | 4 — Delivery     | Bundle measured at 100.38KB of 200KB before board, catalogue, i18n or content. React Router alone is ~32KB                                                                                                                                                                                                                                                                     | Recorded rather than acted on. Re-measure once i18n lands; past 150KB the router is the first thing to revisit                                                                                                     |
| 2026-09-16 | 3 — Planning     | Repository created public, CI green on the empty project, Pages live, `main` protected. 18 tickets across 9 epics on the board, waves sequenced by file ownership                                                                                                                                                                                                              | Phase 2 gate passed; Phase 3 bootstrap complete                                                                                                                                                                    |
| 2026-09-16 | 2 — Architecture | **Adversarial review found 34 issues; the design was revised rather than defended.** Mate proving moved to engine-oracle-plus-committed-certificate; the board library was dropped for an own SVG board; reply completeness became a blocking check; `unexplored` became a real outcome; provenance extended to every claim; the `line` URL encoding was fixed                 | The review showed the first design never checked the one thing the product exists to do — that the opponent's replies are complete — and that a build-time engine was never actually forbidden, only assumed to be |
| 2026-09-16 | 2 — Architecture | Ten ADRs written. Board library decided on **licence**, not merit; mate verification redesigned after measurement                                                                                                                                                                                                                                                              | chessground and chessops are GPL-3.0-or-later. Measurement showed searching every leaf for mates would take CI hours, so intent-plus-proof replaced discovery-by-search                                            |

## 9. Known issues at handover

_None yet — project has not entered delivery._

# Chess Gambit Trainer — Project Plan

Status: Delivery
Last updated: 2026-09-17

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

#### Measured, 2026-09-17, on `19-wave5` (#19)

Every number below comes from the built output on a static host that gzips as GitHub Pages
does. The bytes are what the browser downloaded, re-compressed, **not** what Vite reported
about its own chunks — a bundler cannot see a route's data payload, and on this site the
data is the half that grows.

| Route                                   | JS (gzip) | over `vi/` | Data (gzip) | Everything |
| --------------------------------------- | --------- | ---------- | ----------- | ---------- |
| `vi/`                                   | 132.2KB   | —          | 17.0KB      | 155.5KB    |
| `vi/gambits`                            | 132.2KB   | 0.0KB      | 17.0KB      | 155.6KB    |
| `vi/about`                              | 132.2KB   | 0.0KB      | 0.0KB       | 138.6KB    |
| `vi/gambits/damiano-defence-refutation` | 132.2KB   | 0.0KB      | 0.5KB       | 139.2KB    |
| `vi/gambits/benko-gambit`               | 132.2KB   | 0.0KB      | 13.3KB      | 151.9KB    |
| `en/gambits/legals-mate`                | 135.3KB   | 3.1KB      | 11.8KB      | 153.5KB    |
| `fr/gambits/italian-game-evans-gambit`  | 135.8KB   | 3.6KB      | 9.8KB       | 152.0KB    |

Catalogue files, whole: `vi` 17.0KB · `en` 16.7KB · `fr` 16.8KB gzipped, of 100KB.

| Metric                                | Measured                           | Budget  | Enforced by                                                                        |
| ------------------------------------- | ---------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| Initial JavaScript, worst route       | **135.8KB**                        | < 200KB | `e2e/route-budgets.spec.ts`                                                        |
| Per-route incremental JS, worst route | **3.6KB**                          | < 50KB  | `e2e/route-budgets.spec.ts`                                                        |
| Route data payload, worst route       | **17.0KB**                         | ≤ 100KB | `e2e/route-budgets.spec.ts`, and the whole file in `e2e/catalogue-payload.spec.ts` |
| INP pressing next, throttled 4×       | **64ms** published · 40ms fixture  | < 200ms | `e2e/interaction-latency.spec.ts`                                                  |
| LCP, mid-tier mobile, median of 3     | **2106ms** worst route             | < 2.5s  | `lighthouserc.json`, `npm run perf:lighthouse`                                     |
| CLS, mid-tier mobile, ten runs of 10  | **0.000 on `/gambits`**, every run | < 0.1   | `lighthouserc.json`, blocking, and `e2e/layout-stability.spec.ts` at 360 and 1280  |
| Third-party requests at runtime       | **0** over eight routes            | 0       | `e2e/route-budgets.spec.ts`, and the policy itself                                 |
| Fonts downloaded                      | **0**, none declared               | 0       | `e2e/route-budgets.spec.ts`, `font-src 'none'`                                     |

**The CLS budget failed on its first run, and #57 fixed the site rather than the number.**
Lighthouse named the element: `footer.site-footer`, shifting a full viewport on
`/:locale/gambits` and, at some widths, on a taught gambit page. The cause was structural
rather than mysterious — `#root { min-block-size: 100svh }` parked the footer at the bottom
of the viewport while the route's JSON was still in flight, and the footer then moved down
when the list or the tree rendered. The floor now sits on the content region instead, so the
footer's top edge starts below the fold and never re-enters the viewport.

Measured on the built output in Chromium at 4x CPU throttling and a simulated 1.6Mbps /
150ms link, median of three runs — all three identical in every cell below:

| Route                                             | 360px before | 360px after | 1280px before | 1280px after |
| ------------------------------------------------- | ------------ | ----------- | ------------- | ------------ |
| `vi/gambits`                                      | 0.278        | **0.000**   | 0.069         | **0.000**    |
| `vi/gambits/benko-gambit` (Taught)                | 0.138        | **0.000**   | 0.124         | **0.000**    |
| `vi/gambits/alekhine-…-cambridge-gambit` (Listed) | 0.213        | **0.000**   | 0.000         | **0.000**    |
| `vi/gambits?q=cambridge+gambit` (one result)      | 0.278        | **0.000**   | 0.027         | **0.000**    |
| `vi/`                                             | 0.037        | **0.019**   | 0.007         | **0.007**    |

The home page keeps a small shift and it is not the footer: the "start here" link is
inserted above two paragraphs when the catalogue lands, which moves them 90px. It is under
budget by a factor of five and is a separate piece of design work — reserving space for a
block that may legitimately render nothing would put a permanent gap on the page.

**And it was intermittent, which is worse than red.** Over ten Lighthouse runs of
`/:locale/gambits` the measurement came back 0.216 five times and 0.000 five times: the
shift always happened, but whether it landed inside the measured window depended on whether
the route's JSON resolved before or after the first paint. A median of three therefore
failed roughly half of pull requests and passed the other half, on identical code, which is
why the assertion sat at `warn` from #19 until #57.

Ten consecutive runs on the fixed build now read **0.000, 0.000, 0.000, 0.000, 0.000, 0.000,
0.000, 0.000, 0.000, 0.000**. The same ten runs on the reverted stylesheet read 0.216 four
times and 0.000 six times, which is the coin flip reproducing itself — so the agreement above
is the shift stopping and not the window moving.

That reproduction is also why Lighthouse is no longer the only instrument. Ten runs of a
coin flip have a clean _median_, so an LHCI median would have passed the broken build.
`e2e/layout-stability.spec.ts` holds the route's data until the loading state has painted,
which makes the loading state always win the race, and it asserts the footer's position
directly rather than only the derived metric.

A second thing worth knowing: LHCI's default `aggregationMethod` is `optimistic`, which for
a `maxNumericValue` assertion takes the **lowest** of the three runs. Under that default the
0.216 above passes, because one run in three happens to be clean. `lighthouserc.json` sets
`median` explicitly for exactly that reason.

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
- [x] …with the correct `lang` and a distinct title — **closed 2026-09-16 by #17.** All 3,020
      emitted documents carry their own `lang`, title, description, canonical, `og:*` and four
      `hreflang` alternates, generated from the compiled catalogue. Counted over `dist/`: zero
      wrong or missing `lang`, zero canonicals that do not describe their own document, zero
      alternates pointing at a missing file or at a different gambit
- [x] A `line` parameter containing `+` and `#` round-trips exactly — property test over 400
      generated paths
- [x] One proved mate certificate verifies in CI — **closed by #5.** `npm run verify:mates`
      replays every committed certificate with `chess.js` on the merge path; the search that
      finds them never runs there and no engine is installed on that job (ADR-0005)
- [x] The bundle is measured and recorded — **133.15KB gzipped of 200KB** on `main` @ 919f6e5,
      with the board, the learning surface, i18n and the catalogue page all in. Measured at
      100.38KB before any of them; React Router alone is ~32KB. Re-measured per route by #19
      and recorded under _Performance budgets_ above: 135.8KB on the worst route, including
      its locale chunk

**All six hold as of 2026-09-16. The walking skeleton is complete.** What that buys is narrow and
worth stating plainly: the architecture is proven end to end, not that the product is finished. The
site lists 1,003 gambits and teaches **three** — the Evans, the Benko and Légal's Mate, delivered by
#15. Breadth is complete; depth has barely started, and the coverage tiers exist so the catalogue
can say so rather than imply otherwise.

## 6. Filling the catalogue

Added by #73, which authored the first batch of eleven entries end to end. Every number in this
section was measured on that batch. Where a figure is an assumption rather than a measurement it
says so, because a plan with invented numbers is worse than no plan.

### 6.1 What the first batch actually cost

Eleven entries, all reaching **Taught**: `kings-gambit`, `danish-gambit`,
`sicilian-defense-smith-morra-gambit`, `scotch-game-scotch-gambit`, `blackmar-diemer-gambit`,
`halosar-trap`, `indian-defense-budapest-gambit`, `kieninger-trap`, `englund-gambit`,
`englund-gambit-trap`, `latvian-gambit`. Six White, five Black; eight `gambit`, three `trap`.

| Measure                                      | Value                                              |
| -------------------------------------------- | -------------------------------------------------- |
| Entries                                      | 11                                                 |
| Tree nodes                                   | 137 (12.5 per entry)                               |
| Annotation slots                             | 256 (23.3 per entry)                               |
| Localised strings written                    | 768 (256 × vi/en/fr)                               |
| Words of prose                               | 44,732 — vi 15,478, en 14,298, fr 14,956           |
| Words per entry                              | 4,066 across three locales; 1,407 in Vietnamese    |
| Replies answered by a `dismissRest`          | 715 (65 per entry)                                 |
| Individual `dismissed` entries               | 0                                                  |
| Mate certificates generated and committed    | 4                                                  |
| Mate claims refused by the prover            | 0                                                  |
| Derived tiers, before → after                | 1,000 listed · 0 mapped · 3 taught → 989 · 0 · 14  |
| Catalogue payload, vi, gzipped               | 26.3KB → 26.8KB, against a 100KB budget            |
| Largest per-route content payload            | `englund-gambit-trap.json`, 34.7KB raw / 12.0KB gz |
| Largest per-route content payload, after #81 | `benko-gambit.json`, 51.4KB raw / 16.6KB gz        |

**Wall clock: 2,815 seconds — 47 minutes — from the first file written to the full content gate
passing on all fifteen files. That is 4.3 minutes per entry**, by an agent, with the repository
already read and the tooling already built.

> **This rate was measured at a tree depth the project has since ruled out.** Those eleven entries
> average four plies below the gambit root, which is the shallowness #81 was filed about. Every
> minute-per-entry figure below is the rate for trees that stop there. §6.7 measures what the
> stopping rule in `docs/CONTEXT.md` costs instead, and the batch table in §6.5 is re-costed
> against it.

What that figure does **not** include, and what it is therefore not safe to extrapolate from: the
time spent reading `CONTEXT.md`, the definition of done, ADR-0004 and ADR-0005, the authored schema
and the 955-line validator; choosing eleven ids against the frozen map; and writing the two scratch
scripts that replay a line, list the legal replies at a node and scan a position for a forced mate.
That preparation was not separately timed. It is mostly one-off — but the scripts are not committed,
so the next batch pays for them again unless they are.

Three things about the 4.3 minutes are worth recording because they set the shape of everything
below:

1. **Nothing failed on chess.** No file was rejected for an illegal move, a non-canonical SAN, a
   false mate claim or an unproved trap. Every line was replayed with `chess.js` before it was
   written into YAML, and every mate was checked with `tools/mate/search.ts` before it was claimed
   with `type: trap`. The gate caught nothing because the gate had nothing to catch — which is the
   only way this rate is reachable.
2. **What did fail was YAML.** Three of eleven files were rejected on first run, all for the same
   thing: a `: ` inside French or English prose, which YAML reads as a nested mapping. A one-line
   fix each, and a rule for the next author — never write a colon-space inside an unquoted scalar.
3. **The validator's own output did the reviewing.** Twice, the printed list of replies a
   `dismissRest` covers contained a move the reason did not honestly answer — a `...gxh4` in the
   King's Gambit and a `3...Qh4+` after `3.Nf3`. Both were found by reading that list, not by
   thinking harder. Any future authoring loop should treat "read the catch-all's coverage list back"
   as a required step, not an optional one.

### 6.2 What can be generated, and what cannot

The line is sharp, and invariant 7b is what draws it.

**Already machine-produced, at essentially zero marginal cost:** identity, name, ECO, side, family
and defining line for all 1,003 entries (ADR-0008); node ids, positions, `kind` and `tier`
(derived, never authored); the legality, canonicalisation, reply-completeness and duplicate checks;
and every forced mate, with a replayable certificate (ADR-0005). None of this is the bottleneck and
none of it needs a person.

**Cheap to compute and worth computing before writing anything:** the legal reply list at every
opponent node; which of those replies allow a mate in one or two; the material balance at a leaf;
which squares a piece attacks in the derived position. All of it is a few lines against `chess.js`,
and it is what turns an assessment from an opinion into a description. These scripts should be
committed under `tools/` so the next batch starts where this one finished.

**Cannot be generated, and must not be:**

- `replyQuality` and `frequency`. `frequency` is the sharpest case in the whole model: opening
  explorer statistics are out of scope by design, so the one thing that could make
  `common | occasional | rare` true is unavailable and it is labelled an impression.
- the `evaluation` and `plan` on every assessment leaf, each carrying an author and a date.
- `soundness`, with its own provenance and review date.
- the `dismissRest` reason, which is localised precisely because a learner reads it. A catch-all
  that says nothing about the particular replies it covers is the one shape that genuinely weakens
  invariant 7a, and the schema refuses placeholder text but cannot refuse a vacuous sentence.
- translation. The existing gate refuses an `en` or `fr` string that is a copy of its `vi`, which
  stops the cheapest cheat and nothing else.

An engine could produce a numeric evaluation, and ADR-0010 keeps a seam for one. It must stay
advisory: a number from an engine dressed as a human judgement, or a human judgement dressed as a
measurement, is the failure this whole design exists to prevent.

### 6.3 Ordering, and why

Frequency in real play beats alphabetical, and the project has deliberately no frequency data. So
the ordering below uses proxies that are already in the repository and need no new source.

The catalogue's shape, measured: 1,003 entries in 87 families; the ten largest families hold 501 of
them; 20 families hold exactly one. Defining-line length is 4 plies or fewer for 113 entries, 5–6
for 254, 7–8 for 213, 9–12 for 266, and 13 or more for 157.

1. **Family heads a beginner meets.** One entry per family, choosing the shortest defining line in
   that family — that is the position the opening is actually reached by. 87 entries, and the
   eleven above are all in this set.
2. **Named traps.** All 11 rows of `traps.yaml`. These are the entries that carry proved mates, they
   are short, and they are what a learner loses to. Four are done.
3. **Short lines inside the big families.** The 367 entries whose defining line is 6 plies or fewer,
   worked family by family in order of family size. This is where an entry's tree can transpose into
   one already written, and `transposesTo` is what makes that cheap.
4. **Everything else**, which is 636 entries with defining lines of 7 plies or more, most of them
   deep variations of something already taught.

A second, smaller reason for this order: an entry's tree gets cheaper the further down the list it
sits, because its parent entry has already been written and the branch is often a subtree of it.
The first batch saw this only once (the Budapest points at `kieninger-trap` and the Englund at
`englund-gambit-trap`) because it deliberately picked eleven unrelated openings.

### 6.4 What "done" should mean

**Not 1,003 at Taught.** The arithmetic that decides it:

- 959 entries remain (was 989 before #93/#94/#95 — see §6.8). At the batch-1 rate of 23.3 slots and
  4,066 words per entry, all of them at Taught would be **≈ 22,000 annotation slots, ≈ 67,000
  localised strings and ≈ 3.9 million words**. §6.8 measured a lower real rate on thirty entries
  authored to the full stopping rule — 13.1 slots and 2,076 words per entry — because most family
  heads settle in one to three branches rather than the eleven originally sampled; at that rate the
  same 959 entries is **≈ 12,600 annotation slots and ≈ 2.0 million words**. Both figures are kept
  because the true rate for the entries still to come depends on which of them turn out short like
  a family head and which turn out long like a Danish Gambit, and nothing in the catalogue predicts
  that in advance.
- At the measured 4.3 minutes per entry that is ~69 hours of agent wall clock — or ~146 hours at
  the 9.1 minutes per entry §6.7 projects for a tree that satisfies the stopping rule. The minutes
  are not the constraint and quoting them as if they were is how this plan would become dishonest.
- The constraint is **review**, because of invariant 7b. Every one of those words is a
  judgement that carries a named author and a date. If the author is an agent and no person has read
  it, the provenance is not a record of who stands behind the claim — it is decoration, and this
  project has already retired two instruments for exactly that reason.
- **Assumption, not a measurement:** a human reviewer who genuinely reads one entry — replays the
  lines, checks the qualities, reads three languages — needs on the order of 15–25 minutes (§6.7
  raised the low end of this once trees got deeper). On that assumption, 959 entries is somewhere
  between six and ten full working weeks of nothing else. No solo maintainer does that, and the
  register already rates motivation decay on this project as High.
- The payload survives the arithmetic, which is worth knowing: §6.8 measured the vi catalogue index
  at **27.6KB gzipped** carrying all 44 taught entries and 121 branch keys between them — still far
  under the 100KB budget, and growing more slowly than entry count because deeper lines lengthen an
  existing key rather than add one (§6.4's next bullet).
- **Depth turned out not to threaten that figure, which the earlier wording assumed it would.** The
  sentence here used to say an average tree three times deeper would put the index over budget. #81
  made six trees two to three times deeper and the vi index moved from **26.8KB to 26.9KB gzipped**;
  #93/#94/#95 then added thirty whole entries, mostly shallow, and it moved to **27.6KB**. The
  reason is structural rather than lucky: the index carries branch **keys**, one per
  root-to-leaf line, and deepening a line lengthens its key without adding a key. Sixty branches
  ten plies long cost the index far less than a hundred branches four plies long. What depth does
  multiply is the **per-route** payload, measured in §6.7, and that budget has room. The §8
  tripwire still belongs to branch count, not to depth.

So the honest target is a **Taught core with the rest properly Listed**, in three named states:

| State      | Target               | What it means                                                                                                                                                                                |
| ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Taught** | ~60 entries          | Steps 1 and 2 of §6.3, narrowed — about fifty of the eighty-seven family heads, the ones a club player actually meets, plus all eleven named traps. Full trilingual prose, every mate proved |
| **Mapped** | ~120 further entries | A complete tree with Vietnamese only. Measured cost: 1,407 words per entry, roughly a third of a Taught entry                                                                                |
| **Listed** | the remaining ~820   | Exactly what they are today: identity, ECO, side, defining line, soundness. The catalogue already says so, and the tier is derived so it cannot lie                                          |

Forty-four of the ~60 are done, up from fourteen after #93/#94/#95 (§6.8). **S5 is already
satisfied** — the catalogue is exhaustive and never pretends a thin entry is a deep one — and
nothing in the scope contract promises depth everywhere. What should change is the wording anywhere
that implies it will arrive.

### 6.5 Batches

Sized by the measured rate, not by ambition. Each batch is one pull request touching `content/` and
nothing else (S2), and each is reviewable in one sitting.

Re-costed at the §6.7 rate of **9.1 minutes per entry**, which is what an entry costs when its
lines run to a position the stopping rule accepts. The batch-1 column is kept beside it because the
difference between the two is the whole content of #81.

| Batch | Entries  | Content                                                                                                                                                                                                                     | At the batch-1 rate                | At the §6.7 depth             |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------- |
| 1     | 11       | Done — the eleven above, at four plies                                                                                                                                                                                      | 47 min, 44,732 words               | —                             |
| 1b    | 6        | Done — the six lines #81 carried to a resolved position                                                                                                                                                                     | —                                  | 23 min, 13,785 words          |
| 2     | 6 of 7   | Done, via #93 — six of the seven remaining `traps.yaml` rows (Fishing Pole, Elephant, Lasker, Noah's Ark, Mortimer, Siberian); `damiano-defence-refutation` still has no tree                                               | ~30 min, ~28,000 words             | See §6.8 for the real numbers |
| 3–5   | 24       | Superseded by #92's dispatch (#93/#94/#95) — twenty-four family heads chosen by §6.3 step 1's shortest-defining-line rule across all 87 families, rather than the named openings this row originally listed. Done. See §6.8 | ~104 min, ~98,000 words            | See §6.8 for the real numbers |
| 6+    | 12/batch | Mapped-only tier for the short lines of §6.3 step 3                                                                                                                                                                         | ~18 min per batch, Vietnamese only | ~37 min per batch             |
| —     | 9        | The nine entries still at four to seven plies, brought up to the rule                                                                                                                                                       | —                                  | ~53 min, ~19,000 words        |

Batch 2 was next because the traps are where the proved mates live and they are short — six of
the seven landed via #93, producing three new certificates. Batches 3–5 as originally scoped were
overtaken by #92, which dispatched three parallel groups against the §6.3 ordering directly instead
of the named-opening lists below; §6.8 records what that batch actually cost.

### 6.7 What depth costs, measured by #81

`docs/CONTEXT.md` **Where a line may stop** replaced "stop when the author feels the point is made"
with a rule. Six branches were carried to a position that satisfies it, and everything here was
measured on that batch rather than estimated from the one before it.

| Measure                                  | Before  | After   |
| ---------------------------------------- | ------- | ------- |
| Tree nodes, all fifteen files            | 194     | 233     |
| Annotation slots                         | 364     | 423     |
| Words of prose, three locales            | 61,308  | 75,093  |
| Deepest path in plies, `benko-gambit`    | 4       | 9       |
| `danish-gambit`                          | 4       | 14      |
| `italian-game-evans-gambit`              | 6       | 10      |
| `kings-gambit`                           | 6       | 12      |
| `scotch-game-scotch-gambit`              | 4       | 10      |
| `sicilian-defense-smith-morra-gambit`    | 4       | 10      |
| Entries whose deepest path is 4 plies    | 9 of 14 | 4 of 14 |
| Largest per-route payload, gzipped       | 13.4KB  | 16.6KB  |
| Catalogue index, vi, gzipped             | 26.8KB  | 26.9KB  |
| Root-to-leaf branches, all fifteen files | 72      | 72      |

**Wall clock: 1,364 seconds — 23 minutes — from the first content edit to the gate passing on all
fifteen files.** That covers the six extensions and the fifteen `unsettled` notes that
remain after the new gate found sixteen leaves stopping over a free capture and one of them was
extended away instead. It excludes what the 4.3-minute figure also excluded: reading the
repository, designing the rule, and writing the scratch scripts that replay a line and list a
position's legal replies and free captures.

Three rates come out of it, and only the first is a measurement of the thing that changed:

- **35 seconds per new node**, against 20.5 seconds per node in batch 1. Deepening costs **1.7× per
  node**, and the reason is visible in the diff: a node added below an existing leaf usually turns
  that leaf into an opponent node, which then needs a `dismissRest` covering thirty-odd replies in
  three languages. The plies are cheap; the catch-alls they create are not.
- **10.1 words per second**, against 15.9 in batch 1 — the same order of slowdown, on the other
  axis.
- **9.1 minutes per entry**, which is a **projection and not a measurement**: 12.5 nodes at the
  batch-1 rate plus the ~8 further nodes a resolved line needs, at 35 seconds each. The six
  extended entries now average 20.8 nodes, which is where the ~8 comes from. Nobody has yet
  authored a whole entry to this rule from nothing, so this number should be replaced the first
  time somebody does.

**The review constraint roughly doubles, and it was already the binding one.** §6.4 assumes 15
minutes for a person to genuinely read one entry at the old depth. An entry with 1.7× the nodes and
1.7× the words is not 1.7× harder to read — the deep lines are forcing, so they read faster per ply
than a branch point does — but it is not cheaper either. Call it **25 minutes**, stated as an
assumption. Sixty Taught entries then costs ~25 hours of reading rather than ~15, against a solo
maintainer the risk register already rates High for motivation decay. The honest conclusion is that
**the Taught target should shrink as the depth rule bites**, not that the rule should. A shorter
list of lessons that end somewhere a learner recognises is the product; sixty that end on "White
has the initiative" is not.

**Payload is not the constraint, and it was the one this ticket expected to find.** The per-route
budget is 100KB gzipped and the largest entry in the repository now costs **16.6KB**. Six routes
grew — 13.4→16.6 (`benko-gambit`), 8.7→16.3 (`danish-gambit`), 9.9→13.5
(`italian-game-evans-gambit`), 11.3→15.8 (`kings-gambit`), 8.9→13.1
(`scotch-game-scotch-gambit`), 8.9→12.7 (`sicilian-defense-smith-morra-gambit`) — and the
Danish's twelve new nodes, which carry the deepest line the rule has produced, cost 7.6KB
gzipped between them. A route would need roughly six times the depth of the Danish to reach the budget, and no
opening resolves that slowly. What would reach it is **width**: a tree modelling four replies at
each of five opponent nodes, each carried to a resolved leaf. That is the shape to measure before
authoring, and it is not the shape any entry has today.

### 6.6 What would change this

- **A reviewer other than the author.** The target above is set by review capacity, not by writing
  capacity. If review is shared, the Taught core grows.
- **A committed position-inspection toolkit.** The scratch scripts that made 4.3 minutes possible
  are not in the repository. Committing them under `tools/` is the single cheapest thing that
  raises the rate, and it also makes the next author's assessments describable rather than
  guessable.
- **Frequency data arriving in scope.** It is out of scope by design, and if that ever changes the
  ordering in §6.3 stops being a proxy and becomes a measurement.
- **The catalogue index approaching 100KB gzipped.** Already a tripwire in §8. The measured 42
  bytes per taught entry says it will not be reached by this plan. It would **not** be reached by a
  deeper average tree either — #81 measured that and §6.4 now records it — but it would be reached
  by a wider one, because the index carries one key per root-to-leaf branch.

### 6.8 What thirty parallel-authored entries cost (#92, via #93/#94/#95)

The first batch authored to the full #81 stopping rule from nothing rather than deepened into it —
§6.7's closing line asked for exactly this measurement. Three groups (six named traps plus four
King's/Ruy Lopez/Italian family heads; ten further family heads, French through Scandinavian; ten
more, Caro-Kann through Zukertort) were dispatched in parallel as background agents against three
worktrees, each briefed with the #81 stopping rule, the #85 encoding gate, and a full replay-before-
writing requirement. All numbers below are measured on `main` before and after, not estimated.

| Measure                                   | Before (post-#87) | After (post-#98) |
| ----------------------------------------- | ----------------- | ---------------- |
| Content files                             | 15                | 45               |
| Taught entries                            | 14                | 44               |
| Listed (Tier 0) entries                   | 989               | 959              |
| Tree nodes                                | 233               | 452              |
| Annotation slots (one count, all locales) | 423               | 815              |
| Words of prose, three locales             | 75,093            | 137,378          |
| Root-to-leaf branch keys                  | 72                | 121              |
| Mate certificates                         | 10                | 13               |
| Catalogue index, vi, gzipped              | 26.9KB            | 27.6KB           |

**Real rate for a whole entry at full depth: 13.1 annotation slots and 2,076 words** — the
`(815-423)/30` and `(137,378-75,093)/30` this batch actually produced. Both are well below the
9.1-minutes/23.3-slot projection §6.7 made from _deepening_ eleven existing entries, because most
of the 87 families resolve in one to three branches at their shortest defining line — a family
head is usually a smaller tree than the eleven hand-picked, deliberately branchy openings batch 1
sampled. §6.4's arithmetic now carries both rates rather than replacing one with the other, since
neither is known to hold for the entries still to come.

**No comparable minutes-per-entry rate is reported.** Batch 1 and #81 were each one agent working
serially, so wall clock divided cleanly by entry count. This batch was three agents authoring in
parallel, overlapped with the independent review, rebase and merge-conflict resolution that landed
each one — the wall clock any single number would imply is not the wall clock anything actually
took. What is comparable, and is reported above, is the output: nodes, words and branch keys, each
counted the same way as in §6.1 and §6.7.

**Every claim was independently replayed a second time before merging, not just gated.** Beyond the
agents' own `chess.js` replay and the committed gates (lint, format, typecheck, `validate:content`,
`verify:mates`, unit tests, build, Playwright), the merging session wrote its own `chess.js` scripts
against each of the thirty new files — legality of every ply, and at every leaf either a proved mate
or a clean resolution (not in check, no mate-in-one left on the board, no free capture) per
`docs/CONTEXT.md`'s stopping rule — and hand-verified several material and mate claims against raw
FEN output. One real defect surfaced this way during the batch itself (not after merge): a
`dismissRest` in `vienna-game-fyfe-gambit.yaml` claimed only one knight retreat lost the queen to a
pin when four others did too, caught and fixed by the authoring agent's own second pass before its
PR was opened.

**Three parallel PRs editing the same generated-looking-but-hand-maintained rosters cost a real,
recurring merge conflict.** `tools/content/content-cli.test.ts`'s known-ids fixture,
`tools/catalogue/branches.test.ts`'s `AUTHORED` map and `e2e/taught-entries.spec.ts`'s id list are
each a hardcoded, alphabetically-sorted list that every content-adding PR must extend by hand (§6.1
already flagged this as the "golden list" pattern). Three PRs adding to the same three lists
produced the same conflict twice — #94 against #95, then #93 against the result — resolved by
hand each time, once catching a corrupted string literal an automatic merge had produced. **A
generated fixture, or a test that reads `content/*.yaml` directly instead of naming every id, would
remove this cost the next time three batches land together**; flagged here rather than fixed,
since fixing it is out of scope for a content batch.

Tracking issue #92 and its three sub-issues (#93, #94, #95) are closed. §6.4's Taught count and
§6.5's batch table both reflect the merged state.

## 7. Risks

| Risk                                                                                                                                                                                                                                                | Likelihood                     | Impact       | Mitigation or acceptance                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Annotated depth is the bottleneck, not code.** An annotated gambit tree in three languages is far more work than the application itself, and this cost does not shrink with an exhaustive catalogue — it is simply no longer on the critical path | High                           | High         | Separate breadth from depth. Breadth is imported mechanically and is essentially free. Depth accrues per gambit as content-only PRs. Build the platform first and seed three Tier 2 gambits to prove the pipeline end to end. Tier counts are targets, never release blockers |
| **The exhaustive catalogue is a promise the site cannot keep at depth**, and a site full of empty trees reads as abandoned                                                                                                                          | Medium                         | Medium       | Tier 0 entries get a purpose-built honest state (F15), never a degraded Tier 2 page. The tier is derived from content (F13) so it can never overstate                                                                                                                         |
| ~~The open opening dataset may be unusable~~ — **resolved 2026-09-16.** lichess/chess-openings is CC0 public domain                                                                                                                                 | —                              | —            | Closed. ADR-0008. A curated include/exclude list still governs what counts as a gambit, so classification stays a reviewed decision                                                                                                                                           |
| ~~Board library licence~~ — **resolved 2026-09-16.** chessground and chessops confirmed GPL-3.0-or-later; no board library adopted at all                                                                                                           | —                              | —            | Closed. ADR-0003. The question returns only if an engine is shipped to the browser — Stockfish is GPL-3.0, lichess's WASM build AGPL-3.0                                                                                                                                      |
| **We now own a board renderer.** A bounded scope that could grow                                                                                                                                                                                    | Medium                         | Medium       | Tripwire in ADR-0003, amended by #79: any rules logic in the board swaps to cm-chessboard (MIT, 8.4 KB). Past 450 code lines is a review, not a swap — the board was written at 389 of the old 400 and has grown ten lines since, so that number was measuring its existence  |
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

## 8. Tripwires

| Signal                                                            | Revisit                                                                                                                                              | ADR  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Initial JS exceeds 200KB gzipped after adding the tree view       | Board library and bundling strategy                                                                                                                  | 0003 |
| A content-only PR requires an application source change           | Content schema — F11 is broken                                                                                                                       | 0005 |
| Forced-mate verification takes longer than ~60s in CI             | Verification strategy; consider precomputing and committing proofs                                                                                   | 0005 |
| GitHub Pages bandwidth or size soft limit is approached           | Hosting choice                                                                                                                                       | 0007 |
| The owner asks for accounts or cross-device sync                  | The no-backend decision, and the whole cost model                                                                                                    | 0001 |
| Catalogue payload exceeds 100KB gzipped as breadth grows          | Catalogue loading strategy — consider server-free search indexing or pagination                                                                      | 0008 |
| Per-route incremental JS stops reading 0KB on a same-locale route | Route-level code splitting has appeared. The 50KB budget is slack while one bundle serves every route, and stops being slack the moment that changes | 0002 |
| Tier 2 count has not grown in two months                          | Whether depth authoring is realistically sustainable, and whether the target should be cut honestly                                                  | 0005 |

## 9. Status log

| Date       | Phase            | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-17 | 4 — Delivery     | **The catalogue teaches fourteen entries (#73).** Eleven new entries reached Taught in one batch — the King's Gambit, Danish, Smith-Morra, Scotch Gambit, Blackmar-Diemer, Budapest, Englund and Latvian, plus the Halosar, Kieninger and Englund Gambit traps. 137 nodes, 256 annotation slots, 768 localised strings, 44,732 words across three locales, 715 replies answered by catch-alls, and four mate certificates proved and committed with none refused. Derived counts moved from 1,000 listed · 0 mapped · 3 taught to 989 · 0 · 14; the catalogue payload went from 26.3KB to 26.8KB gzipped against a 100KB budget. Measured throughput — 47 minutes for eleven entries — is what §6 is built on, and what it concludes is that the honest target is a Taught core of about sixty entries with the rest properly Listed, because review and not writing is the constraint. |
| 2026-09-17 | 4 — Delivery     | **The catalogue is exhaustive (#36).** The 342 gambit-named rows #12 left unreviewed were decided one by one: 303 in, 39 out. Every head-level exclusion — `French Defense`, `Sicilian Defense`, `Ruy Lopez` and 55 more — was deleted rather than reworded, so no row inherits a decision made about other rows. 700 entries became 1,003; 26.0KB gzipped of the 100KB payload budget; 3,018 route shells                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `side` stopped being asserted. A rule names the ply that gives material away and the build proves it on a board, which is what made 303 rows decidable that three heuristics could not decide. Thirty-three spot-checks against published sources moved six labels, in both directions — the sample was worth more than the total                                                                                                                               |
| 2026-09-16 | 1 — Discovery    | Scope contract drafted from the owner's brief and two rounds of questions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Project start                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-16 | 1 — Discovery    | Corrected the brief's premise that gambits lead to forced mate; leaves now carry two distinct outcome types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Most gambits do not force mate; presenting them as if they do would teach incorrect chess                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-16 | 1 — Discovery    | Scope widened from ~12 gambits to an exhaustive catalogue, with depth expressed as derived coverage tiers (F13–F15, N10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Owner asked for maximum coverage. Breadth is cheap and mechanical; depth is not. Tiers let the catalogue be complete without overstating how much is taught                                                                                                                                                                                                                                                                                                     |
| 2026-09-16 | 1 — Discovery    | Owner approved the scope contract, with the coverage revision above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Phase 1 gate passed                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-16 | 2 — Architecture | Domain model, design system and threat model written                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Foundations that do not depend on library choice                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-16 | 2 — Architecture | Scope widened again to include named opening traps that are not gambits, tagged `category`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Owner's decision. Légal's Mate, the Fishing Pole and the Elephant Trap are not gambits, and they are the best material for the brief's stated goal                                                                                                                                                                                                                                                                                                              |
| 2026-09-16 | 4 — Delivery     | **Wave 1 delivered.** Routing with real HTTP 200 deep links verified on live Pages; content gate with 27 adversarial fixtures; own SVG board at 2,496 bytes gzipped against react-chessboard's 21.9KB. 580 tests green on `main`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Walking skeleton proven where it could be; two exit criteria remain, both in later waves                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-16 | 4 — Delivery     | **Four gate defects found in one day, three of them mine.** `oxlint` exited 0 on warnings so the lint gate could never fail; `oxlint` enforces none of `any`/`as`/`!` though the definition of done requires them (#28); a vitest `include` silently dropped five content-gate test files; a wall-clock performance assertion passed at 52ms locally and failed at 341ms on CI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Every one surfaced only because something tried to violate it. Gate tickets now require an adversarial fixture that must fail                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-16 | 4 — Delivery     | Bundle measured at 100.38KB of 200KB before board, catalogue, i18n or content. React Router alone is ~32KB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Recorded rather than acted on. Re-measure once i18n lands; past 150KB the router is the first thing to revisit                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-16 | 3 — Planning     | Repository created public, CI green on the empty project, Pages live, `main` protected. 18 tickets across 9 epics on the board, waves sequenced by file ownership                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Phase 2 gate passed; Phase 3 bootstrap complete                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-16 | 2 — Architecture | **Adversarial review found 34 issues; the design was revised rather than defended.** Mate proving moved to engine-oracle-plus-committed-certificate; the board library was dropped for an own SVG board; reply completeness became a blocking check; `unexplored` became a real outcome; provenance extended to every claim; the `line` URL encoding was fixed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | The review showed the first design never checked the one thing the product exists to do — that the opponent's replies are complete — and that a build-time engine was never actually forbidden, only assumed to be                                                                                                                                                                                                                                              |
| 2026-09-16 | 2 — Architecture | Ten ADRs written. Board library decided on **licence**, not merit; mate verification redesigned after measurement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | chessground and chessops are GPL-3.0-or-later. Measurement showed searching every leaf for mates would take CI hours, so intent-plus-proof replaced discovery-by-search                                                                                                                                                                                                                                                                                         |
| 2026-09-16 | 4 — Delivery     | **Waves 2–5 delivered; the walking skeleton is complete.** Move navigation, branch choices, the whole-tree view, progress, outcome cards, the catalogue page, and per-shell metadata for 2,111 documents. 1,762 tests and 169 end-to-end tests green at both base paths, 133.15KB gzipped of the 200KB budget                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Every walking-skeleton exit criterion now holds. The architecture is proven end to end — which is not the same as the product being finished: 700 gambits are listed and none is taught until #15                                                                                                                                                                                                                                                               |
| 2026-09-16 | 4 — Delivery     | **The no-`any`/`as`/`!` rule is enforced (#28).** `oxlint` covers all three natively, so no second toolchain was added. The whole repository already complied except one line, which was fixed rather than exempted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | It had been checked by hand for a week while nothing enforced it. Deleting the three rules turns 13 of the gate's 18 tests red; exempting `tools/**` turns exactly the three `tools/` cases red                                                                                                                                                                                                                                                                 |
| 2026-09-16 | 4 — Delivery     | **Four defects found by review rather than by a failing gate**, and filed instead of fixed in place: a rendered mate claim under a non-mate position (#45), a fixture that hangs its outcome on the mating move (#46), a card that can claim progress the page it links to denies (#48), and a test file that occasionally fails to load, taking 14 tests with it (#50)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | The pattern holds: gates find what they were built to find, and reviews find what nobody thought to build a gate for. #48 and #50 are both latent today and both become real the day content lands                                                                                                                                                                                                                                                              |
| 2026-09-17 | 4 — Delivery     | **The site teaches something.** #15 delivered the Evans Gambit (6 branches), the Benko (9) and Légal's Mate (7) — 57 nodes, 283 replies answered by catch-alls, 108 annotation slots in three languages, and a machine-proved mate in two. Tiers now read 697 listed · 0 mapped · 3 taught                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The pipeline is proven on real content rather than fixtures. Légal's ECO is C41, not the C50 the ticket asked for: the frozen defining line is a Philidor move order, and the ticket was wrong                                                                                                                                                                                                                                                                  |
| 2026-09-17 | 4 — Delivery     | **The translation gate counted the wrong thing.** Coverage reported `en 100%` for a slot filled with a copy of the Vietnamese. A copy is worse than an empty slot: an empty one falls back with a visible marker and a copy does not                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Found by review, not by a gate — and closed by one. Every `en` and `fr` string must now differ from its `vi`. None in the current content did                                                                                                                                                                                                                                                                                                                   |
| 2026-09-17 | 4 — Delivery     | Eighteen of twenty-one tickets done. #18 in progress; #19 and #36 remain, with five review findings filed: #45, #46, #48, #50, and the ECO correction recorded on #15                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Recorded so the remaining work is visible without reading the board                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-17 | 4 — Delivery     | **The performance budgets became gates (#19), and the first thing one of them caught was real.** Five numbers now fail a pull request: initial JS per route, per-route incremental JS, the route's data payload, INP pressing next, and LCP. A Content Security Policy rides in all 2,111 documents and is asserted by test. **CLS is over budget at 0.216 on `/:locale/gambits`** — the footer moves a full viewport when the route's JSON lands                                                                                                                                                                                                                                                                                                                                                                                                                                       | Measured numbers are recorded in §4. The CLS failure is the gate working: it was invisible before, it is a real shift a visitor sees, and fixing it is a loading-state design change that #19 scopes out. Widening the budget to fit the site was the alternative, and was refused                                                                                                                                                                              |
| 2026-09-17 | 4 — Delivery     | **Thirty-nine published entries were facing the wrong way (#56).** The prover #36 built, pointed at the entries that predated it, found 45 whose declared `side` no ply of their own defining line supports. Thirty-nine had a provable offer by the **other** side and now name the ply that proves it — ten Van Geet lines under a head rule that said "Every one is White's", the six Lemberger rows, and every Bird, Bishop's, Vienna and Zukertort line where it is the defender who puts the pawn out. Rules asserting a side: 84 → 81. Entries, families and route shells unchanged at 1,003, 87 and 3,018; 26.1KB gzipped; zero changes to `ids.json`                                                                                                                                                                                                                           | An entry whose orientation nobody checked sits the learner on the wrong side of the board, which is worse than a missing entry. Six remain asserted and are listed with a sentence of chess each: in every one of them the material changes hands **past the end of the line the entry publishes** — the Morra pawn goes at 3.c3, the Marshall pawn at 11.Rxe5 — so there is no ply to name, and removing them would 404 six published URLs against invariant 9 |

## 10. Known issues at handover

_None yet — project has not entered delivery._

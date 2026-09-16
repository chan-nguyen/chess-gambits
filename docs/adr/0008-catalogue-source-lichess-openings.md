# 0008. Catalogue breadth comes from the lichess/chess-openings dataset

The exhaustive catalogue (requirement F3) is generated from `lichess-org/chess-openings`, which its
README dedicates to the public domain under CC0. Names, ECO codes and defining move sequences are
imported and validated mechanically; everything that teaches — annotations, plans, assessments,
soundness judgements — is written here from scratch.

## Status

accepted

## Why this is safe, and where the real risk is

Chess moves are not copyrightable. They are facts and game mechanics rather than authorship, and
copyright does not protect procedures or processes. The dataset itself is CC0, which imposes no
attribution requirement — we credit it anyway, in the footer and on the About page, because it is
courteous and costs nothing.

**Annotations are a different matter entirely.** Commentary, analysis and explanatory prose are
protected literary expression. Every annotation, plan and evaluation on this site is written
originally. Closely paraphrasing a published course or book still infringes even when reworded, and
reproducing a specific book's _selection and sequence_ of lines can attract compilation copyright
even though each individual move is free.

**The EU database right** (Directive 96/9/EC) is a separate `sui generis` right that protects
substantial investment in a database regardless of originality, and it is directly relevant to a
France-based author — the United States case law on chess moves does not cover it. Bulk-extracting
from a commercial opening database is a real risk in the EU. Importing a CC0 dataset and hand-
authoring the analysis avoids the question entirely, which is one of the reasons for this decision
rather than merely a consequence of it.

This is a research summary and not legal advice.

## Consequences

- The catalogue's breadth costs essentially nothing, which is what makes the exhaustive-coverage
  scope change feasible at all.
- The ECO validation check (ADR-0004, check 10) uses this same dataset, so catalogue identity and
  content validation cannot disagree with each other.
- Imported entries land at tier **Listed**. Depth is added by hand afterwards, per gambit.
- **Ids are frozen at first import and never derive from the dataset again.** The dataset revises
  opening names between releases; a slug regenerated from a renamed entry would change, and every
  shared URL to that gambit would 404 silently in a build that passed every check. A committed
  `id → (name, eco, definingLine)` map is the authority for ids. The dataset feeds display names
  only, and CI fails if a previously published id disappears from the catalogue — invariant 9 is
  otherwise unenforced.
- **Named traps are not in this dataset and must be hand-entered**, including their ECO codes. It
  contains opening _variations_; "Légal's Mate" and "the Elephant Trap" are not opening names. The
  ECO check would resolve a trap line to whatever opening it sits inside rather than to the trap, so
  `category: trap` entries are exempt from it and live in their own curated source file. This
  matters because the trap category is precisely what the owner added scope for on 2026-09-16:
  **"breadth is free" is true for gambits and false for traps**, and saying otherwise would
  misrepresent the remaining work.

  _Corrected on 2026-09-16 against the snapshot at `4b86227`, rather than quietly dropped._ The
  example was half wrong and the decision is unchanged. Thirteen rows do carry the word "Trap",
  among them `Ruy Lopez: Noah's Ark Trap`, `Ruy Lopez: Berlin Defense, Fishing Pole Variation` and
  `Queen's Gambit Declined: Albin Countergambit, Lasker Trap` — so "the Fishing Pole is not in it"
  was not true. What is true is the thing the decision rests on: every one of those rows is filed
  under the surrounding opening and **carries that opening's ECO code**. Noah's Ark Trap is C71
  because the Modern Steinitz is C71. Importing them as traps would therefore produce exactly the
  wrong-code outcome the exemption exists to prevent, and would publish a second entry for a trap
  the curated file already carries under a different id. They are excluded by name in
  `classification.yaml`, each with its reason. Légal's Mate, the Halosar Trap and the Kieninger Trap
  are absent from the dataset in any form, which was the point of the original sentence.

- The dataset's notion of what counts as a "gambit" will not match ours exactly. A curated
  include/exclude list is maintained alongside the import so classification is a reviewed decision
  rather than a substring match on the word "Gambit".
- **A curated rule names the sacrificing _ply_, not the side.** Issue #12 left 347 gambit-named rows
  out because `side` could not be derived, and three heuristics were tried before that conclusion —
  each failed on a line containing two offers, labelling every King's Gambit Declined row `white`.
  Issue #36 split the problem where it actually splits: choosing which ply is the sacrifice is a
  judgement a person makes and writes down, and everything after it is arithmetic. The build replays
  the line, checks the move at that ply is the move named, proves the mover ends up materially worse
  off once every capture the opponent has is played out, and **derives** the side from whose turn it
  was. A rule carries `sacrifice` or `side`, never both — so an orientation is either proved or
  visibly only claimed, and `tools/catalogue/review.test.ts` pins how many are still only claimed.
- **The c4-pawn is not a sacrifice.** The same reasoning that makes the Queen's Gambit a misnomer
  applies to every 1.d4 c4 line where the only material on offer is that pawn: Black cannot hold it.
  The mechanical proof cannot tell that pawn from a real one — it only sees that nothing recaptures
  immediately — so this stays a reviewed judgement, and several 1.d4 rows are excluded on it.
- A licence and attribution file is required in the repository from bootstrap.
- **The snapshot is vendored, not downloaded during the build.** `tools/catalogue/dataset/` holds
  the five TSV files and the upstream commit they came from; `npm run catalogue:fetch` refreshes
  them. A build that reaches the network is not reproducible, a deploy would depend on a third party
  being up, and — the reason that decided it — the "every gambit-named row has a written decision"
  gate would otherwise fire on unrelated pull requests whenever upstream added a row. Vendored, it
  fires when a maintainer updates the data, which is when someone should be looking.
- **Rows are folded to one entry per distinct name, keeping the shortest line.** The dataset carries
  3810 rows under 3174 names: "Italian Game: Evans Gambit" alone appears 41 times, each a deeper
  line of the same opening. One entry per row would publish 41 entries with identical names, which
  is the problem family grouping exists to solve, reproduced one level down. The shortest line is
  the line that identifies the opening, which is what `definingLine` means.
- **A family is the dataset name's head** — everything before the first colon. That is mechanical and
  needs no review to be right, which leaves the curated list free to decide only the thing that is
  genuinely a judgement.

## What would change this

The dataset becoming unmaintained or its terms changing. The fallback is a hand-curated catalogue,
which would mean re-scoping "exhaustive" with the owner explicitly rather than quietly shipping less.

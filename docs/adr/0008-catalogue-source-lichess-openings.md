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
  contains opening _variations_; "Légal's Mate", "the Fishing Pole" and "the Elephant Trap" are not
  opening names. The ECO check would resolve a trap line to whatever opening it sits inside rather
  than to the trap, so `category: trap` entries are exempt from it and live in their own curated
  source file. This matters because the trap category is precisely what the owner added scope for on
  2026-09-16: **"breadth is free" is true for gambits and false for traps**, and saying otherwise
  would misrepresent the remaining work.
- The dataset's notion of what counts as a "gambit" will not match ours exactly. A curated
  include/exclude list is maintained alongside the import so classification is a reviewed decision
  rather than a substring match on the word "Gambit".
- A licence and attribution file is required in the repository from bootstrap.

## What would change this

The dataset becoming unmaintained or its terms changing. The fallback is a hand-curated catalogue,
which would mean re-scoping "exhaustive" with the owner explicitly rather than quietly shipping less.

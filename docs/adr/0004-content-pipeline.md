# 0004. Content pipeline: PGN in, YAML as the source of truth, JSON out

Gambits are authored in a board GUI and exported as PGN, imported once into a YAML file that becomes
the permanent source of truth, and compiled at build time into minified JSON that the site lazy-loads
per gambit. The parser never ships to the browser.

## Status

accepted

## Considered options

| Option                                           | Author cannot write an illegal move                | Carries typed outcomes + 3 locales                                                                                        | Diffs well in git             | Verdict    |
| ------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------- |
| **PGN import → YAML source → JSON build output** | Yes, at import                                     | Yes                                                                                                                       | Yes                           | **Chosen** |
| PGN with RAV as the source of truth              | Yes                                                | **No** — needs a bespoke mini-language inside `{}` comments to carry outcome types, three languages and per-reply quality | No — deep nesting diffs badly | Rejected   |
| Hand-written YAML only                           | **No** — SAN typed without a board in front of you | Yes                                                                                                                       | Yes                           | Rejected   |

**Why this one:** it puts each format where it is strongest. A board GUI cannot produce an illegal
move, so PGN import removes the largest class of authoring error at the point it would occur. YAML
carries a real schema — typed leaf outcomes, per-reply quality, three locales — which PGN comments
cannot without inventing a format. JSON is what the browser should receive.

**Why not the others:** encoding `{type: mate}`, `quality: blunder` and three languages into PGN
comment strings is strictly worse than a schema, and PGN's recursive variations produce git diffs
nobody can review. Hand-written YAML alone reintroduces exactly the illegal-move problem that the
GUI eliminates.

## Schema decisions

- **`replyQuality` and `frequency` live on the child**, not on the node, because they describe
  _that reply_ — which is what the UI colour-codes and what the validator cross-checks.
- **`outcome` is on leaves only**, and a node has children _or_ an outcome, never both, never
  neither. Enforced by the schema, not by convention.
- **`unexplored` is a first-class outcome.** Without it, the rule above makes half-finished work
  unmergeable: an author who models six plies on a Tuesday evening has a leaf at every stopping
  point, each demanding a full assessment with a Vietnamese plan before CI turns green. For a solo
  maintainer whose motivation risk is rated High, designing a system whose smallest mergeable unit
  is large is how the content never gets written. `{ kind: 'unexplored' }` renders as an honest "not
  yet mapped" state and holds the gambit below Mapped in the tier derivation — the derived-tier
  machinery is exactly what makes this safe, because the content cannot lie about itself.
- **`dismissRest` is one catch-all with a localised reason**, on an opponent node, answering every
  legal reply that is neither modelled nor individually dismissed. Measured on the Evans Gambit
  after `4.b4`: 35 legal replies, 34 of which say the same thing. Requiring those 34 to be written
  out one at a time, at every opponent node in every entry, does not produce 34 dismissals — it
  produces an author who stops modelling opponent nodes, which is strictly worse than the gap check
  7 exists to close, and it collides with the register's standing risk that annotated depth is the
  bottleneck and motivation on a personal project decays. Its reason is localised where
  `dismissed.reason` is not, because this one is shown to the learner rather than read in a diff
  (`CONTEXT.md`, Dismissal).
- **`transposesTo`** — a node may point at another path instead of duplicating a subtree. Without it,
  the Italian, Two Knights and Evans move orders force duplicated subtrees with duplicated trilingual
  annotations that drift apart, and then check 9 punishes the author for a limitation of the schema.
- **No FENs in source.** Every position is derived by replaying from the start. A hand-written FEN is
  one more thing that can silently drift from the moves beside it (`CONTEXT.md`, invariant 1).
- **Node ids are generated** from the move path at build time, so duplicate or dangling ids are not
  expressible.
- **`kind` (learner/opponent) is derived**, never authored (`CONTEXT.md`, invariant 2).
- **Tier is derived**, never authored (`CONTEXT.md`, invariant 8).
- **`category: gambit | trap`** — added after the Phase 2 research found that several of the best
  forced-mate traps (Légal's Mate in the Italian, the Fishing Pole in the Ruy Lopez, the Elephant
  Trap in the Queen's Gambit Declined) are not gambits at all. Scope change agreed with the owner.

## Build-time validation

Every check below blocks a merge. This list is the F12 gate.

1. **Schema** — required fields, `outcome` XOR `children`, closed enums.
2. **Legality** — replay every SAN from the root with `chess.js`; catches illegal _and ambiguous_
   moves.
3. **SAN canonicalisation** — re-serialise each move and fail if it differs from what was authored.
   This catches `Nf3` where `Ngf3` was required and missing `+`/`#`, a class of error that otherwise
   corrupts the tree silently.
4. **Checkmate assertion** — every mate leaf satisfies `isCheckmate()`.
5. **Non-mate assertion** — every assessment leaf is neither checkmate nor stalemate. This is the
   check that catches the reverse error, and it is what would have caught the Lasker and Elephant
   traps being published as mates.
6. **Forced-mate proof** — per ADR-0005.
7. **Reply completeness** — at every opponent node, every legal reply is either modelled as a child,
   listed in a `dismissed` array with a one-line reason, or answered by the node's single
   `dismissRest` catch-all. The union must equal `chess.js`'s legal move list. This is the check the
   product most needs and the one the first version of this ADR lacked entirely: everything else
   verifies that what _was_ modelled is correct, and nothing verified that it was _enough_. A learner
   who memorises a line, plays it, and meets a reply the site never mentioned is failed by the
   product's core promise. `dismissed` keeps the omission visible in the diff and countable in the
   tier derivation, without requiring an engine judgement.
   The check is unchanged by the catch-all; only its authoring cost was wrong. `dismissRest` covers
   the leftovers and nothing else, so `dismissed-also-modelled` still fires when one is present, and
   the catch-all is refused where it covers nothing, where the node is a learner node, where the node
   models no replies at all, and where its reason is empty or placeholder text. The validator prints
   how many replies each one answers.
8. **Cheap quality sanity check** — no reply marked `best` or `good` is mate-in-1 against the
   learner, and none loses material outright in one move. This is the sound, affordable fragment of
   a check that was originally written as "a `best` reply must not lose by force", which was both
   unaffordable (0.5–7.1s per position, reaching hours across the catalogue) and unsound (a depth-3
   no-mate search says nothing about losing to a mate in 5, and _every_ defender move inside a trap
   branch loses, so the original would fire on exactly the content the site exists to teach). The
   real version is a judgement, so it belongs in ADR-0010's advisory engine job, where it opens an
   issue rather than blocking a merge.
9. **Duplicates and transpositions** — no two children of a node share a SAN. Transposition
   comparison uses the **first four FEN fields only**: the halfmove clock and fullmove number differ
   between transposed paths, and `chess.js` writes an en-passant square on any double pawn push
   whether or not a capture is available, so full-FEN equality both misses real transpositions and
   invents false ones. The check is scoped **within one gambit**: catalogue-wide, every entry
   starting 1.e4 e5 shares positions, and the same move legitimately carries different qualities in
   different teaching contexts.
10. **i18n completeness** — Vietnamese required; missing English or French is a tracked coverage
    percentage, not a failure. Empty strings and placeholder text are failures.
11. **ECO check** — longest-prefix match of the root line against the reference dataset (ADR-0008).
    Entries with `category: trap` are exempt, because a trap line resolves to whatever opening it
    sits inside rather than to the trap (ADR-0008).
12. **Side consistency** — the gambit's declared side matches whose moves the tree prescribes.
13. **No published id disappears** — see ADR-0008.
14. **Text encoding** — no string in a content file may be text that has been through the wrong
    encoding and come out one character per byte. `content/kings-gambit.yaml` served `le mÃªme plan`
    to production for as long as the file existed, in the locale nobody on this project reads, and
    every check above had nothing to say about it because every check above is about the chess. The
    test is structural rather than a search for one character: a run that looks like a UTF-8
    sequence read byte-wise _and_ decodes cleanly when its characters are put back into bytes. It
    has to be, because French and English accents degrade to a run leading with `Ã` while
    Vietnamese — three bytes for most of its letters — degrades to one leading with an ordinary
    French letter, so the obvious check would pass in the primary locale. The error names the file,
    the line, the field and the text it should have been (issue #85).

Anything requiring an engine — numeric evaluations, whether a position really is "good", soundness
labels — stays **out of the blocking set**. Those are judgements, and dressing a judgement as a
validated fact is the error this whole design exists to prevent.

## Consequences

- The PGN parser (`@mliebelt/pgn-parser`, Apache-2.0) and `chess.js` (BSD-2-Clause) run in the build
  only. They are not in the runtime budget, and their licences never touch the shipped bundle.
- `chess.js` cannot do this alone. Verified by experiment: `loadPgn()` walks only the mainline —
  given a PGN with two branches at move 4, the re-exported PGN contained neither. Its variation
  support is an open RFC with no timeline. The split between "parser for structure, chess.js for
  rules" is therefore necessary, and it is also the cheaper arrangement.
- Illegal content fails the build, never the user's browser.
- Adding a gambit stays a content-only pull request (requirement F11).
- **Editing after import needs the board back.** This ADR rejects hand-written YAML because SAN
  typed without a board in front of you is the largest class of authoring error — and then the
  original version made exactly that the permanent steady state, since the GUI protected only the
  first import. Checks 2 and 3 catch illegal and mis-disambiguated moves; they cannot catch a legal
  move that is the wrong move, which is the error a board prevents and a text editor invites.
  Therefore `npm run export-pgn` regenerates a PGN from the YAML for round-tripping through the
  board GUI. The "two sources of truth" objection does not apply: the export is generated, never
  committed, and the YAML remains the only source of truth.

## What would change this

Content authoring moving to people without repository access, which would need an editing surface
rather than a file format — and would reopen ADR-0001.

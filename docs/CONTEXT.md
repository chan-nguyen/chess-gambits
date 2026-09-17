# Domain model — Chess Gambit Trainer

The vocabulary this project uses. Code, content files, URLs, ticket titles and UI copy all draw from
here. If a word is not in this document, it should not appear in an identifier.

Last updated: 2026-09-17

---

## The central asymmetry

Everything in this model follows from one observation, and getting it wrong produces a tree that
cannot express what a gambit actually is.

**A gambit tree is not symmetric.** At a position where it is the _learner's_ turn, the gambit
prescribes what to play — there is a right answer, and the point of the site is to teach it. At a
position where it is the _opponent's_ turn, the learner controls nothing, so every realistic reply
must be modelled and answered.

So a node is one of exactly two kinds, and which kind it is follows mechanically from whose turn it
is. It is never a choice the author makes.

|                   | Whose turn         | Children                                      | What the UI does                                               |
| ----------------- | ------------------ | --------------------------------------------- | -------------------------------------------------------------- |
| **Learner node**  | The learner's side | Normally exactly one: the **prescribed move** | Reveals the move and why it is right                           |
| **Opponent node** | The other side     | One or more **candidate replies**             | Presents every reply as a branch the learner must be ready for |

Modelling a learner node with several children is allowed but is a deliberate act — it means the
gambit genuinely offers a choice of plans, and each must be independently justified. Modelling an
opponent node with one child is a claim that the opponent is forced, and CI checks it: if the
position has other legal replies that are not obviously losing, the content is incomplete.

---

## Entities

### Gambit

The aggregate root, and the unit a learner selects, a URL names, and a pull request adds.

| Field          | Meaning                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | Stable kebab-case slug, e.g. `evans-gambit`. Appears in URLs. Never reused, never renamed once published                                                        |
| `name`         | Canonical English name. Display names per locale live in annotations                                                                                            |
| `eco`          | ECO code or range, e.g. `C51`                                                                                                                                   |
| `category`     | `gambit` — a deliberate material sacrifice — or `trap` — a named opening trap taught for the trap itself. Several of the best forced-mate traps are not gambits |
| `side`         | `white` or `black` — the side the **learner** plays. Determines board orientation and which nodes are learner nodes                                             |
| `definingLine` | The ply sequence that identifies the gambit, in SAN. This is the root path of the tree                                                                          |
| `prelude`      | **Derived.** The initial position and every position the defining line passes through. Never authored, for the same reason a node's FEN is not. See **Prelude** |
| `soundness`    | `sound` \| `dubious` \| `unsound`. See below — this is an honesty requirement, not decoration                                                                   |
| `tree`         | The root **node**                                                                                                                                               |

### Node

A position in the tree, reached by one **ply** from its parent. The root node is the position after
the gambit's defining line.

| Field          | Meaning                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ply`          | The single move in SAN that reached this node from its parent                                                                                               |
| `kind`         | `learner` \| `opponent` — derived from side to move and the gambit's `side`, never authored                                                                 |
| `annotation`   | Localised explanation. See **Annotation**                                                                                                                   |
| `children`     | Ordered child nodes. Empty means this is a **leaf**                                                                                                         |
| `outcome`      | Present **only** on a leaf. See **Outcome**                                                                                                                 |
| `replyQuality` | Only on a **child of an opponent node** — that is, a move the opponent played. See below                                                                    |
| `frequency`    | Only on a child of an opponent node: `common` \| `occasional` \| `rare`                                                                                     |
| `counts`       | Only on an **opponent node**: **counted claims** about the legal replies here, which the prose renders from. See below                                      |
| `dismissed`    | Only on an **opponent node**: legal replies deliberately not modelled, each with a reason. A maintainer's note, read in a diff                              |
| `dismissRest`  | Only on an **opponent node** that models replies: one catch-all answering every legal reply that is neither modelled nor individually dismissed. See below  |
| `unsettled`    | Only on a leaf carrying an `Assessment`: a maintainer's note acknowledging that the line stops while a capture is going free. See **Where a line may stop** |
| `transposesTo` | Instead of children: a path elsewhere in this gambit that this position transposes into                                                                     |

Note what is _not_ stored: the FEN. A node's position is always derived by replaying plies from the
standard starting position. Storing a FEN would let content drift out of sync with its own moves, and
the whole trust model of this project depends on positions being computed, never asserted.

### Dismissal

The two ways a reply is answered without being modelled. Together with modelled children they
are what makes invariant 7a satisfiable.

`dismissed` names one reply and gives a reason. It is a **maintainer's note**: it is read in a
diff, by the person deciding whether the omission is defensible, so its reason is a plain string
in whatever language the maintainer thinks in.

`dismissRest` is a single **catch-all** answering every legal reply left over. Its reason is
**localised**, because unlike a `dismissed` reason it is shown to the learner — it is the site's
answer to that move, and an answer in the wrong language is not one.

It exists because of an arithmetic that otherwise ends the project. At the Evans Gambit after
`4.b4` — the first branch point of the first gambit — 35 replies are legal, and 34 of them say the
same thing. Thirty-four hand-written dismissals per node, at every opponent node, in every entry,
is not work anyone completes; the realistic outcome is that opponent nodes stop being modelled at
all, which is a larger hole than the one invariant 7a exists to close.

It does not weaken the guarantee. The property that matters is that a learner is never met with a
reply the site has nothing to say about, and "any other move here does not challenge the gambit;
you continue with c3 and d4" _is_ an answer — a truthful one, and at club level the useful one.
What would weaken it is a catch-all with a vacuous reason, so two things are refused: one that
covers nothing, and one whose reason is empty or placeholder text. The validator also reports how
many replies each catch-all answers, so the number stays visible rather than hidden behind one
line, and the UI renders it as "34 other replies — \<reason\>". An omission a learner can see is
honest; one they cannot see is the failure this whole check exists to prevent.

### Counted claim

A number a lesson states about the legal replies to a position — "twenty-three of the forty-two
legal replies here are mated at once by `Nxc7#`" — **derived by the build and never typed into the
sentence**. ADR-0011.

The author declares it under `counts`, names it, and writes `{name}` where the figure belongs in the
prose; `{Name}` is the same figure capitalised, for a claim that opens a sentence. Three kinds exist,
which are the three questions the content actually asks: `legalReplies`, `matedBy` a given ply, and
`notMatedBy` it. The author also states `expect`, the figure they believe, and the build **refutes**
it — that number is checked and then thrown away, never published.

It exists because this was the one claim in the model that nothing verified. Every ply is checked for
legality, every position is derived, every mate is replayed from a certificate — and a number in a
paragraph was checked by whoever typed it, which is how a lesson came to say twenty-five where the
board says twenty-three. It sits on an opponent node for the same reason `dismissRest` does: it is a
claim about what the opponent can do, and what the learner plays is the gambit's choice rather than a
set of moves to count.

It does not cover every number in every sentence, and does not pretend to. Arithmetic done on top of
a count, and claims about something other than the reply set, stay prose and stay a review item in
`docs/definition-of-done.md`.

### Outcome

Attached only to leaves, and exactly one of **three** shapes. Keeping these as distinct shapes rather than
one shape with optional fields is the type-level expression of the project's core honesty rule.

**`ForcedMate`** —
`{ kind: 'mate', inMoves: N, sequence: [...], provedBy: 'search' | 'modelled-net', basis: Proved }`

The opponent is checkmated in `N` **moves** regardless of how they defend. This shape may **never be
hand-authored**. The author marks a leaf `outcome: { type: trap }` — a bare claim with no move count,
no line and no certificate name, because each of those is something the build derives and something a
file able to state it could lie about. The build then proves it and generates the outcome, or
**rejects the claim** and fails. A claim that cannot be proved is not downgraded silently.

`sequence` is the longest line in the net, in plies from this leaf: the mate as it goes when the
defender holds out longest, so a mate in N runs to `2N - 1` plies. `provedBy` records which half of
the proof carries "mate within N" — a net with defender branching is proved by set equality against
the legal move list (`modelled-net`), and where the attacker mates at once there is no net to model
and a one-ply exhaustive search settles it (`search`). Minimality is established by bounded search in
both cases. `basis` is the narrow `Proved` provenance and not the full union, so a hand-judged mate is
not expressible: there is no way to construct the type without naming a certificate.

**`Assessment`** — `{ kind: 'position', evaluation: ..., plan: ..., basis: Judgement }`

The opponent defended adequately, so there is no mate. The leaf states a material and positional
evaluation and a written middlegame plan: what to aim at, which pieces matter, what the pawn
structure implies. This is the _normal_ outcome for a gambit, and the UI must not present it as a
consolation prize.

`basis` is the narrow `Judgement` and not the full union, which is the mirror image of `ForcedMate`'s
narrowing: `Proved` names a mate certificate a reader can fetch and replay (ADR-0005), and a position
that is merely winning has none to name. A proved assessment is therefore not expressible, and a file
that arrives claiming one is refused at the runtime boundary rather than rendered.

**`Unexplored`** — `{ kind: 'unexplored' }`

This branch has not been mapped yet. It exists so that half-finished work is committable: without it,
every stopping point in a partially modelled tree demands a full assessment before the schema will
accept it, which makes the smallest unit of content work large — and a solo maintainer with a large
minimum unit writes nothing. It renders as an honest "not yet mapped" state and holds the gambit
below `Mapped` in the tier derivation.

### Where a line may stop

The outcome shapes above say what a leaf may _claim_. This says where a leaf may _be_, and it is the
rule a reviewer applies to a branch without asking the author what they meant.

A leaf is a promise that there is nothing further a learner needs to be shown here. Exactly four
things discharge it:

1. **A proved mate.** The game is over and a certificate says so (ADR-0005).
2. **A resolution.** An `Assessment`, which is the normal case and the one this rule exists to
   tighten. Both conditions below hold.
3. **A transposition**, into a line this entry has already resolved.
4. **`Unexplored`**, which discharges nothing and says so. It is the honest way to stop early, and
   it holds the entry below `Mapped` until someone finishes the work.

**Condition one — the board has finished moving.** Checked by the build, in
`tools/content/resolution.ts`:

- The side to move is **not in check**. There is no middlegame plan for a position whose legal moves
  are all answers to a check; a leaf here has stopped mid-sequence, and the fix is a ply.
- The side to move **does not mate in one**. This is the gap between the other two and the worst
  place in the file to be wrong: `1.f3 e5 2.g4` leaves Black to move with `Qh4#`, and nobody is in
  check, the game is not over, and there is no capture on the board at all — so a leaf there
  published a lesson calling it a comfortable middlegame one ply before White is mated, and passed
  every chess check in ADR-0004 while doing it. Depth one only; a real mate still needs a
  certificate (ADR-0005).
- **No capture is going free** — no capture whose destination square the opponent cannot recapture
  on. If one is, the material count the leaf states is not the count the position has.

A check and a mate in one are **unconditional** — `unsettled` cannot excuse either, because a reason
for stopping one ply before the game ends is not a reason, it is the missing ply.

"Free" means _nobody can take back_, and nothing else. Piece values are deliberately absent, because
weighing an exchange would be a second, weaker rules engine living beside `chess.js`. The cost of
that choice is a small class of false positives — a capture that loses a piece to a fork one move
later is still "free" by this definition — and those are acknowledged on the node with `unsettled`,
a plain maintainer's note that argues in the diff for why stopping there is honest. The build
refuses an `unsettled` on a leaf where nothing is in fact going free, so the notes cannot outlive
the positions that earned them, and a branch extended past its old stopping point has to delete its
own note in order to compile.

**Condition two — the advantage is a feature, not a verdict.** Read by a reviewer, against the
board, and carried in `docs/definition-of-done.md`. The `evaluation` must name at least one item
from this closed list, and it must be true of the derived position:

- a **material count** — how many pawns each side has, and whether the sacrifice came back;
- a **pawn-structure defect that cannot be repaired** — a doubled, isolated or backward pawn, or a
  broken shield in front of a king;
- an **open or half-open file, rank or diagonal bearing on a king** that has lost the right to
  castle, or has already committed to a square;
- a **square no pawn can defend again**, together with the piece that is going to sit on it;
- a **piece with no good square** — offside, entombed, or permanently worse than its counterpart;
- a **rook out of play**, with the number of tempi it will cost to bring in.

"White has the initiative", "White is better" and "the attack plays itself" name nothing on that
list. They are the sentences fourteen taught entries ended on before this rule existed, and they are
what a line that stopped two moves past the gambit had left to say.

**Depth is a consequence of this rule and never the rule.** A fixed floor would be the obvious
mechanism and it is the wrong one in both directions: the Danish declined by `3...d5 4.exd5 Qxd5
5.cxd4` is resolved at four plies, because material is square and the isolated pawn is on the board,
while a line that is still liquidating at ten plies is not. What the rule does produce, in practice,
is depth — the six branches extended under it run from nine plies to fourteen, because that is how
long a real gambit takes to answer its own question.

### Provenance

Every claim carries where it came from, and the UI renders the two kinds differently.

```
Provenance = { basis: 'proved',     by: 'certificate', certificate: <id> }
           | { basis: 'judgement',  by: <author>, at: <date>, source?: <text> }
```

This exists because of an inconsistency worth naming. Forced mates are machine-proved; soundness
labels, evaluations, middlegame plans, reply qualities and frequencies are **all human judgement with
no verification whatsoever**. If a proved mate and an unverified opinion sit in the same panel with
the same visual weight, the proof machinery does not make the opinion trustworthy — it makes it _look_
trustworthy, which is worse than proving nothing at all. This is the project that began by
demonstrating that three widely published trap lines name the wrong move; it does not get to omit
where its own claims come from.

`frequency` is the sharpest case: opening-explorer statistics are deliberately out of scope, so the
one thing that could make `common | occasional | rare` true is unavailable by design. It is an
author's impression, and it is labelled as one.

### Annotation

Localised prose attached to a node, or to a `dismissRest` reason. Keyed by locale
(`vi` \| `en` \| `fr`).

Vietnamese is the source locale: content is authored in Vietnamese and translated outward. A missing
`en` or `fr` falls back to `vi` and is visibly marked untranslated — never blank, never a raw key.

### Coverage tier

**Derived from content by the build. Never written in a content file.** A hand-declared tier is
rejected by the schema, because a tier is a claim about the content and content is the only thing
entitled to make it.

| Tier       | Derivation                                                                      |
| ---------- | ------------------------------------------------------------------------------- |
| **Listed** | Identity, ECO, side, defining line and soundness exist. No tree beyond the root |
| **Mapped** | A tree exists and contains no `unexplored` leaf                                 |
| **Taught** | Mapped, plus complete Vietnamese, English and French annotation                 |

The earlier wording defined Mapped as "every opponent node models the realistic replies, and every
leaf has an outcome". That cannot distinguish anything: both are hard errors for _all_ content
(invariants 3 and 7a), so every file that validates at all would satisfy it. `unexplored` is what
actually separates a mapped tree from a half-finished one, which is the whole reason that outcome
shape exists.

### Soundness

An honest label on the gambit as a whole, shown in the catalogue and on the gambit page.

| Value     | Means                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `sound`   | Holds up against correct play. The sacrifice is compensated                                                        |
| `dubious` | Objectively favours the defender with best play, but the practical chances are real and the traps are dangerous    |
| `unsound` | Refuted by known correct play. Taught as a trap to spring and, equally, to recognise when it is played against you |

Labelling a gambit `sound` when it is not is the same category of error as a false mate claim, and it
is treated as seriously — with the difference, stated plainly, that a mate claim is machine-proved
and this one is not. It carries `Provenance` and a `reviewedAt` date, because opening theory moves
and nothing else in this model ever expires.

Soundness is genuinely a property of a _line_ rather than of a whole gambit — the Evans is sound in
some lines and dubious in others — so the entry-level label is a summary. Where a branch diverges
from it, the branch's own annotation says so.

### Reply quality

A closed set, on an opponent's reply. It answers "how bad is this move, and therefore what does the
learner get?"

`best` \| `good` \| `inaccuracy` \| `mistake` \| `blunder`

Only `mistake` and `blunder` replies may lead to a `ForcedMate` leaf. A `best` reply leading to a
mate would mean the gambit refutes correct play, which would make it the most important discovery in
opening theory rather than a website feature — so CI treats it as a content error.

### Path

The learner's position in the tree, as the ordered SAN plies **from the gambit root** — that is, from
the position after the defining line, not from the initial position. This is what the URL carries,
and it is why links are shareable and restorable.

Encoded as underscore-joined SAN, then **percent-encoded as a whole**:

```
line = "Nxe5_Bxd1_Bxf7+_Ke7_Nd5#"   ->   ?line=Nxe5_Bxd1_Bxf7%2B_Ke7_Nd5%23
```

Encoding is not optional and was verified by experiment. Raw, `+` is the form encoding for a space
and `#` begins the fragment, so `?line=Nxe5_Bxd1_Bxf7+_Ke7_Nd5#` parses back as
`"Nxe5_Bxd1_Bxf7 _Ke7_Nd5"` — silently truncated and corrupted. Since check moves carry `+` and mate
moves carry `#`, the links that break are exactly the links to proved checkmates: the most shareable
thing the site produces.

SAN is still chosen over child indices, because it survives a branch being reordered or a sibling
inserted. Encoding costs some of the human readability that argued for it, which is the trade.

`line` counts from the gambit root and always will. The positions _before_ the root are addressed by
a second parameter — see **Prelude** below — rather than by widening this one, because widening it
would leave every published link resolving to a different position while still resolving. A link
that breaks is noticed; a link that quietly moves is not.

### Prelude

The walk from the initial position through the **defining line**, ending at the gambit root. It is
how a learner sees the opening being reached rather than only what happens once it has been.

It is not part of the tree and is not a **branch**: it has no nodes, no children, no annotations and
no outcomes. It is a fixed sequence of positions derived by the build from the defining line, shipped
on the compiled entry as `prelude`, one entry per ply plus the initial position, so that
`prelude[i]` is the position after `i` plies and the last one is the tree root's own position. It has
to be shipped rather than computed: chess.js is a build dependency and `board-tripwire.test.ts` keeps
it out of the browser, so a position the wire does not carry is a position the page cannot draw.

Addressed in the URL by `prelude`, a **count** of plies played:

```
?prelude=3     the position after the first three plies of the defining line
?prelude=0     the initial position
(absent)       at or past the gambit root — which is every URL published before this existed
```

Three rules hold, and each is what keeps invariant 9's promise about published URLs:

- **Absent means "at or past the gambit root".** The last prelude position _is_ the root and is
  written as the root — no parameter at all — so `?prelude=` never names a position a published link
  already names.
- **`line` wins.** A URL asking for plies is asking for a position past the root, so a `prelude`
  beside it is contradictory and is dropped. An old link therefore resolves through exactly the code
  it always resolved through.
- **A count, not SAN.** The argument above for SAN over indices is about surviving a reordered branch
  or an inserted sibling, and the defining line is one fixed sequence with neither. What a count buys
  is that the only malformed value is "not a small whole number", where a SAN prelude would be an
  attacker-supplied move list to walk and recover in order to name positions the entry already
  enumerates. A count past the end of a short defining line is not an error: it names the gambit
  root, which is a real position and the one a link with no `prelude` has always resolved to.

### Family

A group of related entries sharing an opening ancestor — "Blackmar-Diemer", "Queen's Gambit". The
imported dataset is a list of _variations_, so searching it returns dozens of near-identical rows and
a name is almost never unambiguous. The catalogue groups by family and expands on demand; without
this, an exhaustive catalogue is unsearchable and reads as a graveyard.

### Catalogue

The complete set of entries, at every tier, grouped into families. Searchable and filterable by name,
ECO, side, category, soundness and tier. Search folds Vietnamese diacritics, since Vietnamese is the
source locale and nobody types them into a filter box.

### Progress

Per-learner, per-browser record of which paths have been marked learned. Lives in `localStorage`.
Never leaves the device, never sent anywhere, and its loss is an accepted, non-critical event.

---

## Words with a fixed meaning here

| Term                | Meaning in this project                                                                         | Do not confuse with                                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ply**             | One side's single move                                                                          | "Move", which in chess means a White move _and_ a Black reply. `inMoves: 3` is up to six plies. Navigation steps by ply; mate counts are in moves. Code uses `ply` for one and `moves` for the other, always |
| **Branch**          | A child subtree under an opponent node                                                          | PGN calls these "variations"; we do not use that word in code                                                                                                                                                |
| **Line**            | A root-to-leaf path                                                                             | Sometimes used loosely elsewhere for any sequence; here it means a complete path                                                                                                                             |
| **Gambit**          | A named opening involving a deliberate material sacrifice for initiative, development or attack | "Opening", which is the broader family. The catalogue contains gambits only                                                                                                                                  |
| **Trap branch**     | A branch whose leaf is a `ForcedMate`                                                           | A merely winning position — that is an `Assessment`, however good. The Lasker Trap, the Elephant Trap and the Fried Liver all end in material wins, not mates                                                |
| **Trap** (category) | An entry taught for its trap rather than for a sacrifice, e.g. Légal's Mate in the Italian      | A _trap branch_, which is a property of one branch inside any entry                                                                                                                                          |
| **Prescribed move** | The gambit's answer at a learner node                                                           | A "best move" in the engine sense; we have no engine in v1                                                                                                                                                   |
| **Proof**           | Machine-generated evidence that a mate is forced                                                | An author's confidence                                                                                                                                                                                       |

---

## Invariants

These hold for all content at all times, and each is enforced by CI. They are the reason a learner
can trust what this site says.

1. Every node's position is reachable from the standard starting position by legal moves only, and
   so is every position of the **prelude**, which is derived by the same replay.
2. `kind` is derived from side to move; it is never authored and never stored in a content file.
   **In an authored file the outcome discriminant is spelled `type`, not `kind`.** The two collided:
   this invariant bans `kind` from content, while the `Outcome` shapes above use `kind` as their
   discriminant. A carve-out is exactly the hole an adversarial file walks through, so the ban has no
   exception and the authored spelling differs. The domain type in code keeps `kind`.
3. A node has exactly one of `children`, an `outcome`, or `transposesTo` — a three-way exclusive
   choice. A transposing node is a leaf of its own subtree that carries no outcome, which the earlier
   two-way wording made impossible to express.
   Every true leaf carries exactly one outcome, of `mate`, `position` or
   `unexplored`.
4. A `ForcedMate` outcome exists only where the build proves mate is forced: a machine-expanded
   mate net, committed as a certificate and verified by replay — every attacker move legal, every
   defender node set-equal to the full legal move list including all four promotions, every terminal
   a checkmate, no repetition — and a bounded search confirming no shorter mate exists. It is
   generated, never written. An unprovable claim fails the build, and a search that reaches its node
   cap counts as unprovable.
5. A `ForcedMate` leaf is only reachable through a reply marked `mistake` or `blunder`, anywhere on
   the path from the entry root to that leaf.
   For this to be satisfiable, **a defining line ends with the learner's own ply**, so the root is
   always an opponent node and the opponent's error is always a modelled reply carrying a quality.
   Without that rule the invariant is unsatisfiable for exactly the traps this site exists to teach:
   in the Damiano the losing move is Black's `2...f6`, which sits inside the defining line where no
   reply node can carry a quality. The entry's defining line is therefore `1.e4 e5 2.Nf3`, and
   `2...f6` is a modelled reply alongside `2...Nc6` — which is also how a learner actually meets it.
6. A node claiming checkmate _is_ checkmate in the derived position.
7. Every `Taught` node has a Vietnamese annotation. Other locales are optional and fall back.
   7a. At every opponent node, modelled children plus `dismissed` plus at most one `dismissRest`
   cover **every** legal reply. This is the invariant the product exists to satisfy; everything else
   verifies that what was modelled is correct, and only this one verifies that it was enough.
   A `dismissRest` answers the leftovers and nothing else, so it can never cover a reply that is
   modelled or individually dismissed — which is why an overlap between `children` and `dismissed`
   is still reported when one is present. It is refused where it would cover nothing, and its reason
   is localised because a learner reads it.
   7b. Every claim that is not machine-proved carries provenance recording that it is a judgement.
   Provenance is recorded **once per entry**, plus on `soundness` and on each `Assessment` outcome.
   Per-child provenance on every `replyQuality` and `frequency` was specified and is unauthorable —
   it would mean a block of metadata beside every move — so the entry-level record is what the UI
   attributes those judgements to.
8. `tier` is derived at build time and absent from content files.
9. A gambit `id` is never reused or renamed after publication — published URLs must keep working.
10. Nothing in the running application makes a network request to a third party.
11. A `line` URL parameter round-trips exactly: encode, put in a URL, parse, compare. The same
    holds for `prelude`, and one further thing holds between them: a URL carrying no `prelude`
    resolves to exactly the position it resolved to before that parameter existed. This is frozen
    as a table of published values in `src/components/learn/published-links.test.ts` rather than
    argued from the code, because a `line` that quietly changed meaning still parses and still
    draws a board.
12. Transposition comparison uses the **first four FEN fields only**, scoped within one gambit.
    Halfmove clock and fullmove number count how a position was reached, not what it is, and they
    differ between transposed paths.
    The rationale first given here was wrong on both halves and is corrected rather than quietly
    dropped. Measured against chess.js 1.4.0: after `1.e4` the en-passant field is `-`, and after
    `1.e4 d5 2.e5 f5` it is `f6` — the square is written **only when a capture is actually
    available**, so field 4 carries real information and belongs in the key. And comparing on more
    fields can only ever make matching stricter, so it can miss a real transposition but can never
    invent a false one.
13. A **counted claim** in learner-facing prose is derived by replaying the position, never written
    into the sentence. The author states the figure they believe and the build refutes it; the
    sentence carries a placeholder the build fills. A count declared and never used by any prose is
    refused, and so is a count one language of a sentence uses and another does not. This covers counts
    of the legal replies to a position and nothing else — arithmetic downstream of one is prose, and
    is reviewed as prose (ADR-0011).
14. A leaf carrying an `Assessment` stops at a position where the side to move is **not in check**,
    **does not mate in one**, and where **no capture is going free** — a capture whose destination square the opponent cannot
    recapture on. A check and a mate in one are unconditional. A free capture may be acknowledged on the node with
    `unsettled`, a maintainer's note giving the reason, and an `unsettled` on a leaf with nothing
    going free is refused so the notes cannot rot. This is the machine-checkable half of **Where a
    line may stop**; the half that requires the evaluation to name a feature on the board rather
    than state a verdict is a reviewer's item in `docs/definition-of-done.md`, because no check
    reads a sentence.

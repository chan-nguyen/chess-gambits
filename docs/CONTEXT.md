# Domain model — Chess Gambit Trainer

The vocabulary this project uses. Code, content files, URLs, ticket titles and UI copy all draw from
here. If a word is not in this document, it should not appear in an identifier.

Last updated: 2026-09-16

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
| `soundness`    | `sound` \| `dubious` \| `unsound`. See below — this is an honesty requirement, not decoration                                                                   |
| `tree`         | The root **node**                                                                                                                                               |

### Node

A position in the tree, reached by one **ply** from its parent. The root node is the position after
the gambit's defining line.

| Field          | Meaning                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ply`          | The single move in SAN that reached this node from its parent                                                                                             |
| `kind`         | `learner` \| `opponent` — derived from side to move and the gambit's `side`, never authored                                                               |
| `annotation`   | Localised explanation. See **Annotation**                                                                                                                 |
| `children`     | Ordered child nodes. Empty means this is a **leaf**                                                                                                       |
| `outcome`      | Present **only** on a leaf. See **Outcome**                                                                                                               |
| `replyQuality` | Only on a **child of an opponent node** — that is, a move the opponent played. See below                                                                  |
| `frequency`    | Only on a child of an opponent node: `common` \| `occasional` \| `rare`                                                                                   |
| `dismissed`    | Only on an **opponent node**: legal replies deliberately not modelled, each with a reason. Modelled children plus `dismissed` must cover every legal move |
| `transposesTo` | Instead of children: a path elsewhere in this gambit that this position transposes into                                                                   |

Note what is _not_ stored: the FEN. A node's position is always derived by replaying plies from the
standard starting position. Storing a FEN would let content drift out of sync with its own moves, and
the whole trust model of this project depends on positions being computed, never asserted.

### Outcome

Attached only to leaves, and exactly one of two shapes. Keeping these as distinct shapes rather than
one shape with optional fields is the type-level expression of the project's core honesty rule.

**`ForcedMate`** — `{ kind: 'mate', inMoves: N, sequence: [...], provedBy: 'search' | 'modelled-net' }`

The opponent is checkmated in `N` **moves** regardless of how they defend. This shape may **never be
hand-authored**. The author marks a leaf as a claimed trap and writes neither a move count nor the
word "mate"; the build proves it by one of two sound routes (ADR-0005) and generates the outcome, or
**rejects the claim** and fails. A claim that cannot be proved is not downgraded silently.

**`Assessment`** — `{ kind: 'position', evaluation: ..., plan: ..., basis: Provenance }`

The opponent defended adequately, so there is no mate. The leaf states a material and positional
evaluation and a written middlegame plan: what to aim at, which pieces matter, what the pawn
structure implies. This is the _normal_ outcome for a gambit, and the UI must not present it as a
consolation prize.

**`Unexplored`** — `{ kind: 'unexplored' }`

This branch has not been mapped yet. It exists so that half-finished work is committable: without it,
every stopping point in a partially modelled tree demands a full assessment before the schema will
accept it, which makes the smallest unit of content work large — and a solo maintainer with a large
minimum unit writes nothing. It renders as an honest "not yet mapped" state and holds the gambit
below `Mapped` in the tier derivation.

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

Localised prose attached to a node. Keyed by locale (`vi` \| `en` \| `fr`).

Vietnamese is the source locale: content is authored in Vietnamese and translated outward. A missing
`en` or `fr` falls back to `vi` and is visibly marked untranslated — never blank, never a raw key.

### Coverage tier

**Derived from content by the build. Never written in a content file.** A hand-declared tier is
rejected by the schema, because a tier is a claim about the content and content is the only thing
entitled to make it.

| Tier       | Derivation                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Listed** | Identity, ECO, side, defining line and soundness exist. No tree beyond the root                                                                                                    |
| **Mapped** | A tree exists, every opponent node models the realistic replies, and every leaf has an outcome. Annotations may be sparse and Vietnamese-only                                      |
| **Taught** | Mapped, plus every node has a Vietnamese annotation, every mate claim carries a machine proof, every `Assessment` leaf has a plan, and English and French translations are present |

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

1. Every node's position is reachable from the standard starting position by legal moves only.
2. `kind` is derived from side to move; it is never authored and never stored in a content file.
3. Only leaves carry an `outcome`; every leaf carries exactly one, of `mate`, `position` or
   `unexplored`.
4. A `ForcedMate` outcome exists only where the build proves mate is forced, by exhaustive search
   within a node cap or by a fully modelled mate net verified by set equality against the legal move
   list. It is generated, never written. An unprovable claim fails the build.
5. A `ForcedMate` leaf is only reachable through a reply marked `mistake` or `blunder`.
6. A node claiming checkmate _is_ checkmate in the derived position.
7. Every `Taught` node has a Vietnamese annotation. Other locales are optional and fall back.
   7a. At every opponent node, modelled children plus `dismissed` cover **every** legal reply. This is
   the invariant the product exists to satisfy; everything else verifies that what was modelled is
   correct, and only this one verifies that it was enough.
   7b. Every claim that is not machine-proved carries `Provenance` recording that it is a judgement.
8. `tier` is derived at build time and absent from content files.
9. A gambit `id` is never reused or renamed after publication — published URLs must keep working.
10. Nothing in the running application makes a network request to a third party.
11. A `line` URL parameter round-trips exactly: encode, put in a URL, parse, compare.
12. Transposition comparison uses the **first four FEN fields only**, scoped within one gambit.
    Halfmove clock and fullmove number differ between transposed paths, and an en-passant square is
    written on any double pawn push whether or not a capture exists.

# 0005. Mate claims are proved by machine, and the proof is committed

No human assertion of a forced mate reaches the published site. An engine, used as a build-time
oracle and never shipped, _finds_ candidate mates. A generator then _expands_ the complete forced net
mechanically and commits it as a proof certificate beside the content. CI _verifies_ the certificate
with `chess.js` alone, in O(nodes), and trusts the engine for nothing.

## Status

accepted — **revised 2026-09-16 after an adversarial review**, replacing an earlier version that had
authors hand-write mate nets and treated a build-time engine as off-limits.

## What the earlier version got wrong

The first version of this ADR offered two proof routes: bounded search, or a mate net written by
hand. An adversarial review dismantled both, correctly:

- **The hand-written net was unauthorable exactly where it was needed.** Nets small enough for a
  person to write are nets the bounded search already proves in 2–40ms. The cases search cannot reach
  — the Fishing Pole's mate in 4 — have nets of thousands of nodes. The route covered a subset of
  what was already free, at the cost of schema work and a new class of human error.
- **An engine in the build was never actually forbidden.** GPL-3.0 binds _conveying_. Installing
  Stockfish on a CI runner and speaking UCI to it is use, not distribution; no Stockfish code enters
  the bundle, and the GPL does not claim rights over a program's output. The node-cap cliff that
  shaped the original design was self-imposed. ADR-0010 had already assumed a build-time engine was
  acceptable, so the two documents contradicted each other.

Recording this rather than quietly rewriting: the reasoning that was wrong is more useful to a future
reader than a decision that looks like it was always obvious.

## Measurements this is built on

`chess.js` 1.4.0, on the real trap positions.

| Task                                                                        | Result                                         | Time                  |
| --------------------------------------------------------------------------- | ---------------------------------------------- | --------------------- |
| Prove mate in 1–2 (Légal, Blackburne Shilling, Englund, Halosar, Kieninger) | all proved, all correct                        | **2–40ms**            |
| Prove mate in 4 (Fishing Pole, after 7.Ne1??)                               | **could not prove** — hit a 3,000,000-node cap | 160s                  |
| Prove _no_ mate exists, to depth 3                                          | correct in all four cases                      | 0.5–7.1s per position |

Finding a mate is cheap; proving one absent is three orders of magnitude more expensive. Every design
decision below follows from that asymmetry.

## The pipeline

**1. Author states intent.** A leaf is marked as a claimed trap. The author writes no move count and
never the word "mate".

**2. Oracle finds (offline or scheduled, never on a pull request).** Stockfish, installed on the
runner, answers `go mate N`. It is an oracle only: nothing it says is believed.

**3. Generator expands.** Starting from the claimed position, the generator walks the net: at each
attacker node it records the single mating move; at each defender node it enumerates **every** legal
reply from `chess.js` and recurses. The result is a complete forced net, committed to the repository
as a proof certificate next to its gambit.

**4. CI verifies, using `chess.js` and nothing else.** Cheap, deterministic, and independent of the
engine that produced it. Six checks, all required:

1. Every attacker move in the certificate is legal in its position.
2. At every defender node, the certificate's children are **set-equal** to `chess.js`'s full legal
   move list — including all four promotion pieces on any promoting move.
3. Every terminal node satisfies `isCheckmate()`.
4. **No defender node has zero children.** An empty legal-move list means stalemate, and an empty
   authored set would satisfy check 2 vacuously. `{} == {}` is the classic vacuous-truth hole and it
   is closed explicitly.
5. **No terminal inside the net is anything but checkmate.** An assessment leaf inside a declared net
   would otherwise let a net that does not mate produce a mate claim.
6. **No position repeats three times** along any line in the certificate, since the defender could
   then claim a draw and the mate would not be forced.

**5. Minimality is checked separately.** A certificate proves "mate within N along these moves", not
"mate in N". The generator records the shortest mate the oracle found, and the verifier confirms no
shorter mate exists via bounded search — cheap, because short mates are exactly the cheap case.

## Failing safe

The bounded search returns **three** values: `MATE(n)`, `NO_MATE`, or `UNKNOWN` when the node cap is
reached. `UNKNOWN` **poisons upward**: any node with an `UNKNOWN` child is itself `UNKNOWN`, and a
claim that resolves to `UNKNOWN` is refused.

This is the single most likely implementation bug in the whole project. The near-universal error is
fail-soft — folding `UNKNOWN` in as "not refuted" and generating a mate for a position that is not
mate, which is precisely the failure this ADR exists to prevent, inside the mechanism meant to
prevent it. It is therefore a required test, not a code-review note: cap the search at 100 nodes on a
known mate in 2 and assert the build **refuses** the claim.

## The red-test corpus

A verifier with no tests that must fail is not a verifier. The suite includes certificates that must
each be **rejected**, with the rejection reason asserted:

- a net whose terminal is stalemate rather than checkmate
- an assessment leaf inside a declared net
- a net missing one of four underpromotions at a promoting defender move
- a net whose attacker move is slower than necessary, so N is not minimal
- a net containing a threefold repetition
- a net missing one legal defender reply
- a certificate whose search hit the node cap

## Consequences

- **Deep mates become provable.** The Fishing Pole's mate in 4 stops being a casualty of the tooling.
- **CI stays in milliseconds** and needs no engine. Verification is a replay, not a search.
- **Humans never write a mate net**, so that entire class of authoring error disappears.
- **The proof is auditable.** The certificate is in the repository; anyone can replay it.
- Certificates for deep mates are large — a mate in 4 with ~30 defender replies per turn is on the
  order of tens of thousands of nodes. They are build inputs, never shipped to the browser, so this
  costs repository size and nothing else. Most certificates are a handful of nodes.
- The engine is an **oracle, not an authority**. If Stockfish is wrong, verification fails and the
  claim is refused. The trust chain ends at our own replay.
- Certificates are regenerated on a schedule, not per pull request, so a slow oracle never gates a
  merge.

## As built

Recorded here because the ADR specified a pipeline and building it needed decisions the ADR did not
make. Implemented in `tools/mate/`, with the content half in `tools/content/validate.ts`.

**The author's claim is `outcome: { type: trap }`** and nothing else. No move count, no line, no
certificate name: each of those is derived, and a file that can state a derived thing can lie about
it. `type: mate` is refused earlier still, by `derived-fields.ts`.

**A certificate is a replay script.** It stores `entry`, `node`, `line`, `inMoves` and the net — moves
only, no position, so nothing in it can drift out of sync with the moves beside it. `line` is the
whole game from the standard start position, which is what lets the verifier check repetition against
real history rather than a fragment, and what makes the file checkable with no content file present.

**Its name is derived, not stored**: `<entry>.<percent-encoded node path>.mate.json`, beside the
content file. The encoding is the same one a `line` URL parameter uses and for the same reason — a
proof of a mate is the likeliest file in this project to have a `#` in its name. The verifier checks
the name against what the certificate says it proves, so a file copied to another entry fails.

**Nine checks, not six.** The six above, plus three the pipeline needs to be sound at all: the depth
the certificate claims must equal its longest line; the certificate must not be filed under the wrong
entry; and the independent search must agree that a mate exists at all, because two methods over the
same rules disagreeing is itself a refusal.

**Set equality is on the multiset**, so a duplicated reply cannot pad the count while a real reply is
missing.

**The oracle is optional.** With no Stockfish installed, `prove:mates` searches to its own maximum
depth and takes longer; the certificates come out identical, because nothing the oracle says is
believed. `no-engine.test.ts` walks the import graph from `verify-cli.ts` and asserts the oracle is
unreachable from it — the licensing boundary and the trust boundary are the same line, and neither is
left to a comment.

**Both directions of the corpus are checked.** A leaf claiming a trap with no certificate fails, and
a certificate no leaf claims fails too: a proof of something the site has stopped saying verifies for
ever without anyone reading it.

Measurements reproduced on this implementation, `chess.js` 1.4.0: mate in 1 proved in 0.4–6ms, the
Légal mate in 2 in 36ms; no mate to depth 3 in 0.08–6.0s; the Fishing Pole's mate in 4 still
`unknown` after 3,000,000 nodes and 159 seconds, so it is refused, as predicted. A hundred-node cap
on the Légal mate in 2 returns `unknown` and the claim is refused.

## What would change this

Certificate size becoming a genuine repository problem, which would move generation into CI and
accept a slower scheduled job in exchange. Or a defect found in the verifier, which would be a
release-blocking incident rather than a bug — the verifier is the product's only guarantee.

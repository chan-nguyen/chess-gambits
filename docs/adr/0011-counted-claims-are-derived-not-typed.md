# 0011. A counted claim is derived by the build, and the author's own figure is only ever refuted

A sentence that tells a learner "twenty-three of the forty-two legal replies are mated at once by
`Nxc7#`" no longer contains a number a person typed. The author declares the claim as a `count`
beside the node, states the figure they believe, and writes `{mated}` and `{legal}` in the prose. The
build replays the position, refuses the file if the author's figure is wrong, and writes the derived
figure into the sentence in each locale.

## Status

accepted

## The bug this is for

`halosar-trap` told a learner that **twenty-five** of the forty-two legal replies after `8.Nb5` are
mated at once by `Nxc7#`. It is **twenty-three**: `8...Qd2+` and `8...Qxb2+` are checks, so White has
to answer them and never gets to play `Nxc7`. Fixed in #76, found by replaying the position by hand
during review of #73, and found by nothing else.

It survived because the paragraph was internally consistent. `25 + 17 = 42`, and the sentence that
followed — `Qxb5`, plus those two checks, plus sixteen replies that leave b7 bare — was right.
Reading it carefully does not expose the error.

The pipeline verifies every ply's legality, derives every FEN and every position, replays every mate
certificate move by move in CI, and refuses a `dismissRest` that covers nothing. A number in a
sentence was checked by whoever typed it.

## Why this earned a schema change, when three claims did not look like enough

At the time of #77 there were three claims of the shape that broke, and a careful maintainer had
re-derived all three by hand. Three is not a crisis.

The argument is about the second derivative, and two things settle it.

**There were never three.** A sweep of the corpus for counted claims finds **six**, in four of the
eleven Taught entries: three of the form "K of N legal replies are mated at once by `X`", and three
more of forms nobody had enumerated — "none of the twenty-six legal moves here is mated on the spot",
"White has exactly six legal answers", "only fourteen of Black's twenty-eight legal moves stop it".
All six replay correctly today. The point is that the count of things needing hand-checking was
itself wrong by a factor of two, and it was wrong in the direction of "fewer than there are".

**They cluster where the product is going.** Every one of the six sits at an **opponent node**, and
five of the six sit on a `dismissRest` — the catch-all that answers the replies the entry does not
model. That is not coincidence: a catch-all is precisely where an author reaches for a number,
because one line of YAML is standing in for thirty replies and the honest thing to do is say how
many. `docs/PROJECT-PLAN.md` §6 targets roughly sixty Taught entries. At the observed density of
0.55 counted claims per Taught entry, that is somewhere around **thirty-three claims**, and #81 makes
the lines deeper, which adds opponent nodes and therefore catch-alls. Hand-checking thirty-three
claims across three languages, on every edit, is not a plan; it is the absence of one.

## What was rejected

**A regex over trilingual prose hunting for number words.** Ruled out in the ticket and deliberately
not done in #76. It cannot tell a counted claim from "the two bishops", "a pawn on move two" or
"quatre coups plus tard"; it would fire on authors doing nothing wrong, and a gate people route
around is worse than no gate.

**An authoring-time helper that prints the count.** Cheap, and it gates nothing. The author who
believed twenty-five would not have thought to run it — believing a number is exactly the state in
which you do not check it.

**A structured claim that is verified but leaves the sentence hand-written.** This is the shape the
ticket sketched, and it is the trap in this problem. It puts a true number in the YAML next to a
sentence that can still say anything, and the two are kept in step by the author remembering — which
is the thing that already failed. It would have produced a green build over a wrong lesson, which is
worse than today, because today nobody thinks the number is checked.

**Rendering the count as a digit.** `23 of the 42 legal replies` is trivially checkable and needs no
number speller. It also opens a sentence with a numeral in three languages, and it would have meant
rewriting eighteen existing sentences — a change to what a lesson says, made to suit the gate. The
entries say "Twenty-three" and "Hai mươi ba" and "Vingt-trois", and they should keep saying it.

**Moving the count out of the prose and into the UI**, the way `dismissRest` already renders as "34
other replies — ⟨reason⟩". It does not fit the sentences that exist: in `halosar-trap` the figure is
the subject of a clause whose next three sentences depend on it. Excising it would rewrite the
paragraph.

## The decision

```yaml
- ply: Nb5
  counts:
    legal: { count: legalReplies, expect: 42 }
    mated: { count: matedBy, ply: 'Nxc7#', expect: 23 }
    stops: { count: notMatedBy, ply: 'Nxc7#', expect: 19 }
  dismissRest:
    reason:
      en: >-
        {Mated} of the {legal} legal replies here leave c7 alone and are mated at once by
        Nxc7#. {Stops} replies do stop the mate.
```

Three kinds of count, which are the three questions the corpus actually asks, all of them about the
set of legal replies to one position:

| `count`        | Derived by                                                     |
| -------------- | -------------------------------------------------------------- |
| `legalReplies` | the length of the legal move list                              |
| `matedBy`      | replaying each legal reply and asking whether `ply` then mates |
| `notMatedBy`   | the complement of `matedBy`, so the two halves cannot disagree |

Five rules make it a gate rather than a decoration:

1. **`expect` is required, and is the only number a person writes.** The build replays and refuses
   the file when they disagree, naming the entry, the node, the count and the figure the position
   actually gives. This is the check that catches the original bug, and it is also what catches a
   count asking the _wrong question_ — an author who miscopies the mating move gets a figure that
   does not match the one they counted.
2. **`expect` is never published.** The prose carries `{name}`, and the build substitutes the figure
   it derived. There is one number and the machine produced it, so a sentence cannot go stale
   against the claim beside it.
3. **A declared count that no prose uses is refused.** Otherwise the gate's own success case is a
   check sitting beside a number still typed by hand, which is #77 with extra steps.
4. **A count belongs only on an opponent node.** It is a claim about what the opponent can reply;
   what the learner plays is the gambit's choice, not a set of moves to count. Same rule, same
   reason, as `dismissRest` and `replyQuality`.
5. **A count used in one language of a sentence is required in all of them.** Rewriting a single
   translation and typing the figure into it is #77 in one locale, and rules 1–4 do not see it. The
   trade is real and is taken deliberately: a translation that deliberately phrases around a figure
   the source states — "most of them" for "nineteen of them" — is refused, and the author has to
   drop the count from that sentence in every language. All six existing claims use every count in
   all three languages, so nothing pays this cost today.

`{Name}` is `{name}` capitalised, because a count often opens a sentence.

## The number speller, and why it is not the weak point

`tools/content/numerals.ts` writes 0–99 in Vietnamese, English and French, and returns nothing above
99 so the validator refuses the claim rather than silently switching a sentence to digits. It exists
so that the derived figure can go into the prose the entries already have.

It handles the cases that make a machine-written numeral sound foreign: Vietnamese `mười lăm`,
`hai mươi mốt`, `hai mươi tư`; French `vingt et un`, `soixante et onze`, `quatre-vingts`. Traditional
French hyphenation rather than the 1990 rectified spelling, because that is what the existing
annotations use.

It is build-time only, deterministic, and unit-tested on its irregular cases. Its failure mode is a
visibly wrong word, not a wrong chess fact — it is not in the same risk class as anything ADR-0005
guards.

**The conversion is verified by construction.** All six existing claims were converted, and the four
entries compile to output **byte-identical** to what they produced before, in all three languages.
The sentences a learner reads did not change; only where their numbers come from did. Those rendered
sentences are pinned in `tools/content/counts.test.ts` so a future change to the speller cannot
reword a lesson quietly.

## What this does not cover, stated plainly

The gate covers counted claims about the legal replies to a position. It does not cover, and no
reasonable version of it would:

- **Arithmetic downstream of a count.** `halosar-trap` also says "the other sixteen leave b7 bare".
  Sixteen is nineteen minus `Qxb5` and the two checks, and "leaves b7 bare" is not a property the
  build can derive. It stays prose, and it stays a review item.
- **Counts of something other than replies.** "Roughly half of Black's legal moves here fail to stop
  it", in `legals-mate`, is hedged and has no figure to check.
- **Whether the sentence around the figure is true.** `{mated} of the {legal} legal replies here
leave c7 alone` — the build settles the two numbers and has nothing to say about `c7`.
- **The SAN an author writes in prose.** "8...Qxb5" in a sentence is unchecked, exactly as it was.

The honest claim is therefore narrow: the specific shape that recurs — and that produced the bug —
is now derived, and the shapes around it are not. `docs/definition-of-done.md` carries the review
item for the rest.

## Consequences

- The content schema gains one optional field on a node. Entries without counts are unaffected, and
  `derived-fields.ts`, the mate pipeline and the PGN round trip are untouched.
- A number in a lesson now costs an author three lines of YAML and a figure they have to have
  actually counted. That is the intended friction.
- No new dependency; `chess.js` was already the rules engine and still never reaches the browser.
- A YAML gotcha worth knowing: prose that _begins_ with `{Mated}` must be quoted, because an
  unquoted scalar opening with `{` is a flow mapping. None of the existing six does.

## What would change this

A claim shape that recurs and that the three counts cannot express — the most likely candidate is
"how many replies allow a mate in two", which would need the mate search rather than a one-ply
replay and belongs with ADR-0005's machinery rather than here.

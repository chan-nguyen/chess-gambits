Every certificate in this directory MUST be refused by `verify.ts`, each for one named
reason. `verify.test.ts` asserts the reason and a fragment of the message for each one.
A verifier with no tests that must fail is not a verifier, and this one is the only guarantee
the product has.

These are machine-generated, then mutated in exactly one place — so the difference between a
proof and a refusal is a single move, which is how it is in reality.

| File                                       | Refused for              | The mutation                                                         |
| ------------------------------------------ | ------------------------ | -------------------------------------------------------------------- |
| `fixture-stalemate-terminal.Kg6.mate.json` | `stalemate-terminal`     | The net's terminal is the shortest known stalemate, called a mate    |
| `fixture-assessment-leaf-inside-net.Kf3…`  | `non-mate-terminal`      | One branch stops at a live position instead of at checkmate          |
| `fixture-missing-underpromotion.Kf3…`      | `defences-not-set-equal` | `c8=B` removed; `c8=Q`, `c8=R` and `c8=N` are all still answered     |
| `fixture-missing-defender-reply.Kf3…`      | `defences-not-set-equal` | One ordinary legal reply, `Be7`, removed                             |
| `fixture-not-minimal.Kf3…`                 | `not-minimal`            | A real net, one move slower than the mate in 2 that exists           |
| `fixture-repetition.Nb1…`                  | `repetition`             | The same net, after a shuffle that reaches the position a third time |
| `fixture-search-cap.Bxd1…`                 | `search-cap`             | Nothing: it is a **valid** mate in 2, verified under a 100-node cap  |

Two of these deserve a note, because what they are is not obvious from the file.

`fixture-search-cap` is not malformed at all. It is the Légal certificate, byte for byte
valid, and the test verifies it with `nodeCap: 100`. At that budget the minimality search
cannot establish that no shorter mate exists, so it returns `unknown` and the claim is
**refused**. Accepting it for want of a refutation is the fail-soft bug ADR-0005 is written
against, and this is where that would show up.

`fixture-stalemate-terminal` also trips `search-disagrees`, and cannot avoid it: an
independent search of the same position finds no mate, because there is none. Two methods
over the same rules disagreeing is itself a refusal, so both fire. The asserted reason is the
stalemate.

The certificates in `../valid/` are the counterpart: they must all verify, with the move
count, the attacker and the mating line that `verify.test.ts` states. Each has a content file
beside it that claims the trap, so `npm run verify:mates` also checks that every claim has a
proof and every proof has a claim.

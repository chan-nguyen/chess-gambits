# 0012. Stockfish runs in the visitor's browser, as a separate GPL program behind a worker

The analysis page (#154) runs Stockfish 19 on the visitor's machine, in a Web Worker, and speaks
to it only in UCI text. The engine files are vendored unmodified with their licence and a source
offer. The application stays MIT. ADR-0010's seam becomes real code, and it streams.

## Status

accepted — the owner asked for the page ("mình muốn thêm 1 trang để phân tích 1 bước đi, khả
năng thắng thua, tựa như chess.com/analysis") and, shown the licence question ADR-0010 said this
would force, asked for it to be planned and built (2026-09-28). This amends ADR-0010 and settles
the question ADR-0003 and ADR-0010 left open.

## The licence question, answered

ADR-0010 recorded that shipping Stockfish means distributing GPL-3.0 code. It also recorded that
driving an engine in a Web Worker over UCI is arm's-length communication rather than linking,
that many chess sites rely on that reading, and that the reading is legally grey. None of that
has changed, and this is not legal advice. What has changed is that the owner has made the call.

What we do so the call is defensible:

- **Two programs, one conversation.** The worker is started from its own URL and sent strings.
  Nothing in `src/` imports, bundles or calls into Stockfish's code. The only engine-facing
  module, `src/components/analysis/stockfish-source.ts`, holds a `Worker` and parses the text it
  sends back. That is the aggregate-and-communicate shape the GPL FAQ describes, not linking.
- **Unmodified, and shipped with its licence and source.** `public/engine/` holds the upstream
  release files byte for byte, `COPYING.txt` (GPL-3.0), and a `README.md` naming the exact
  upstream release, commit and network, with each file's SHA-256. The README and the licence
  are published beside the binary, so anyone who receives the engine from this site also
  receives the terms and the way to the source. `NOTICE` and the About page say the same.
- **Pinned by a test.** `tools/engine/vendored.test.ts` hashes the three files against the README.
  An engine that changed under us, by accident or otherwise, fails the build rather than
  shipping unannounced.

## Which build

| Build (stockfish.js 19.0.0) | Size        | Needs cross-origin isolation | Verdict                  |
| --------------------------- | ----------- | ---------------------------- | ------------------------ |
| full, multi-threaded        | ≈94 MB      | yes                          | no — size and headers    |
| full, single-threaded       | ≈94 MB      | no                           | no — size                |
| lite, multi-threaded        | ≈1.6 MB     | yes                          | no — GitHub Pages cannot |
| **lite, single-threaded**   | **≈1.8 MB** | **no**                       | **yes**                  |

Threads need `SharedArrayBuffer`, which needs COOP/COEP response headers, and ADR-0001 already
records that a static host cannot set response headers. The lite network is weaker than the full
one and still far stronger than any human, which is the audience. 1.8 MB of WASM (≈1.2 MB
gzipped) is downloaded **only by the analysis route**, which `e2e/route-budgets.spec.ts` asserts.

Vendored rather than depended on: the npm package is 200 MB unpacked because it carries every
build, and this site needs two files of it. The same reasoning vendored the piece set and the
openings snapshot.

## The seam, amended

ADR-0010 specified `evaluate(position): Promise<Evaluation | null>`: one answer per position. An
analysis page needs the answer as the search deepens — depth 1 in milliseconds, depth 18 a few
seconds later — and a promise resolves once. So the interface becomes:

```ts
type EvaluationSource = {
  readonly analyse: (fen: string, listener: AnalysisListener) => () => void
}
type AnalysisListener = {
  readonly onUpdate: (evaluation: Evaluation) => void
  readonly onFailure: () => void
}
```

Still asynchronous by construction, which was the part of ADR-0010 it called cheap and easily
forgotten. The returned function stops the search. `onFailure` exists because a worker can fail to
start (an old browser, a blocked download), and a page that waited forever for an answer that is
not coming would be lying by omission. `null`, ADR-0010's "no evaluation here", is now the absence
of an update: a finished game is never sent to the engine at all, because the rules engine already
knows how it ended. Components still compute nothing: they hand a
FEN to a source and render what comes back. The tests hand them a fake source.

## An estimate is not a proof

This site's one rule is that every mate claim is machine-proved and re-verified on every build
(ADR-0005). An engine's `score mate 3` at depth 18 is found by a machine, but it is neither proved
nor verified: a deeper search can withdraw it. So on the analysis page:

- everything is labelled as Stockfish's estimate at a stated depth;
- an engine mate is worded as "Stockfish sees mate in 3", never as a proved mate, and never in
  `--color-mate` or the `MateOutcome` component, which belong to certificates;
- the win/draw/loss figures are Stockfish's own WDL model. That model is fitted to engine games,
  so it calls far more positions drawn than a human game would be, and the page says so;
- the README's statement of the rule names where it applies.

Engine output appears on the analysis page only. The gambit pages keep their authored
assessments, which ADR-0010 requires to be presented as judgements. They get a link to the
analysis page, not an evaluation.

## Consequences

- The CSP gains `worker-src 'self'`, written out even though `script-src 'self'` already covers
  it, because the policy is the list of what the site does. The worker is served without a CSP
  header, so its own policy is the host's: GitHub Pages sends none, and WASM compiles inside it.
- `scripts/static-server.ts` serves `.wasm` as `application/wasm`, as GitHub Pages does. Without
  it, streaming compilation fails and the loader falls back to a slower path, so the e2e run would
  measure a site the visitor does not get.
- The analysis route is lazy-loaded, so its code is not in the entry bundle.
- The board learns to draw arrows (ADR-0003 always planned them as overlay geometry). It still
  knows no chess: the caller passes squares, and the export surface `board-tripwire.test.ts`
  freezes is unchanged, because an arrow is a `LastMove` pair.
- **The board's line count moved at a new rate, and that is worth saying.** ADR-0003's amendment for
  #79 set the budget at 450 so that reaching it within a few tickets would mean the rate had
  changed. It has: 373 on `main` before #153, 401 after its target dots, 437 after this ticket's
  arrows — all presentation, none of it rules, and 13 lines of headroom left. The next presentation
  feature on the board is the one that trips the review, and that review should happen before it
  starts rather than halfway through.

## What would change this

A licensing finding that the worker boundary does not hold, which would move the engine behind
a server this project does not have (ADR-0001). Upstream publishing a build that needs no
isolation and is materially stronger at a similar size. Or the owner asking for engine output on
the gambit pages themselves, which ADR-0010's "assessments are authored" would have to be
revisited for first.

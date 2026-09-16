# 0010. Evaluations sit behind a seam, so an engine can arrive without a rewrite

The owner chose to defer in-browser analysis to v2 while keeping the architecture ready for it.
Everything that needs to know "how good is this position?" asks a single `EvaluationSource`
interface. In v1 the only implementation reads values compiled into the content; a Stockfish
implementation can be added later without touching a component.

## Status

accepted

## The decision

```ts
type EvaluationSource = {
  evaluate(position: Fen): Promise<Evaluation | null>
}
```

Asynchronous from the start, although the v1 implementation answers instantly. An interface that is
synchronous today and must become asynchronous tomorrow propagates the change through every caller —
the async signature is the cheap part of this ADR and the part most easily forgotten.

Returning `null` is a first-class answer meaning "no evaluation available here". v1 returns it for
every position not in the content, which is the honest response for a site with no engine: guessing
is worse than saying nothing.

## Why a Web Worker boundary specifically

When an engine does arrive it will be Stockfish, which is **GPL-3.0**; lichess's WASM build is
**AGPL-3.0-or-later**, which is stricter still. Shipping either means distributing GPL code.

Driving an engine in a Web Worker over UCI messages is arm's-length inter-process communication
rather than linking, which is how many chess sites treat it. That reading is defensible but it is
legally grey and this is not legal advice — it is recorded so that the choice is made deliberately
when the time comes, rather than discovered after the code is written. The seam costs nothing now and
keeps the argument available; a synchronous in-bundle import would foreclose it.

ADR-0003 rejected chessground on the same grounds — letting both the engine and the board be GPL
would have settled the project's licence by accident rather than by decision.

Note what ADR-0005 established after this ADR was written: an engine used as a **build-time oracle**
is not distribution at all, so Stockfish already helps the project today without any of this
shipping. The seam here governs only the separate question of an engine running in the visitor's
browser.

## Consequences

- Components never compute or contain an evaluation. They ask the source and render what comes back,
  including `null`.
- Evaluations in content are authored prose and numbers, not engine output, and the UI presents them
  as assessments rather than as computed facts. `ForcedMate` outcomes are the opposite — machine-
  proved and never authored (ADR-0005) — and the two must never be styled as though they carry the
  same kind of authority.
- Adding the engine later is a new implementation of one interface plus a worker, not a refactor.
- An optional, non-blocking engine check in CI becomes possible without any of this shipping to the
  browser: a scheduled job that warns when an assessment's prose disagrees with an engine's sign.
  Advisory only — it never rewrites an author's words.

## What would change this

The owner asking for analysis of arbitrary positions, which promotes the engine from v2 to now and
forces the GPL question to be answered rather than preserved.

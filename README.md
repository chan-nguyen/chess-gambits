# Chess Gambit Trainer

Learn chess gambits and opening traps as a **branching move tree** — because the question that
actually decides the game is not "what is the main line?" but _"what if my opponent plays something
else?"_

Pick a gambit, walk it move by move, and wherever the opponent has a real choice, see every reply
and where each one leads: either to a **proved forced mate**, or to an **assessed middlegame
position** with a plan.

## The one rule this project is built on

**No "mate in N" on this site was written by a human.**

Opening-trap literature is demonstrably unreliable. Three of the most widely repeated forced-mate
trap lines name the _wrong_ losing move, and several famous "traps" are material wins that get
published as mates. So every mate claim here is produced by machine and re-verified on every build:
an engine finds a candidate, a generator expands the complete forced net, and CI replays the whole
thing with an independent rules engine. A claim that cannot be proved is refused — not downgraded
quietly, and never guessed at.

Everything that is _not_ machine-proved — soundness, evaluations, middlegame plans, how good a reply
is — is labelled as a judgement, because a proof sitting next to an unlabelled opinion does not make
the opinion true, only convincing.

## Running it

```bash
npm install
npm run dev
```

| Command             | What it does                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `npm run dev`       | Dev server, served at the deployed base path so sub-path bugs show up here |
| `npm run build`     | Type-check then build to `dist/`                                           |
| `npm test`          | Unit tests                                                                 |
| `npm run typecheck` | Type-check only                                                            |
| `npm run lint`      | Lint                                                                       |
| `npm run format`    | Format                                                                     |
| `npm run e2e`       | End-to-end tests against the built output                                  |

Node version is pinned in `.nvmrc`.

### Configuration

| Variable    | Default           | Why it exists                                                                                                                                                                       |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASE_PATH` | `/chess-gambits/` | GitHub Pages serves a project site from a sub-path. Set to `/` when deploying to a custom domain. There are no other environment variables, and no secrets — the site has no server |

## How it is built

A static single-page application. No backend, no database, no accounts, no cookies, no analytics,
and **no third-party request at runtime** — which is why the project has no personal data and no
compliance obligations at all. That is a design property, not an accident of being small.

Correctness lives in the **build**, not at runtime: the PGN parser, the rules engine and the mate
prover all run in CI and none of them ship to the browser.

## Documentation

| Document                                         | What is in it                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md)   | Scope, requirements, budgets, risks, plan                             |
| [`docs/CONTEXT.md`](docs/CONTEXT.md)             | Domain model and the invariants CI enforces                           |
| [`docs/design-system.md`](docs/design-system.md) | Information architecture, tokens, components, accessibility floor     |
| [`docs/security.md`](docs/security.md)           | Threat model and security baseline                                    |
| [`docs/adr/`](docs/adr/)                         | Architecture decisions, with the reasoning and what would change them |

## Licence

Code is [MIT](LICENSE). Chess content is [CC BY-SA 4.0](LICENSE-CONTENT) — reuse it, credit it, and
share your version alike. Chess moves themselves are not copyrightable and never were.

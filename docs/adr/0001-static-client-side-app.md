# 0001. Static client-side application, no backend

The product teaches curated chess content that changes only when the maintainer edits it, keeps no
user data beyond a per-browser progress marker, and has no multi-user behaviour. Every capability in
the v1 scope is satisfiable by files served from a CDN, so we ship a pure static client-side
application with no server, no database and no API.

## Status

accepted

## Considered options

| Option                             | Licence | Cost to run                     | Meets v1 scope                             | Ops burden for a solo maintainer                          | Cost to leave                                          |
| ---------------------------------- | ------- | ------------------------------- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------ |
| **Static client-side app**         | n/a     | **$0**                          | Yes — all of F1–F15                        | None. Nothing to patch, restart or back up                | Low. Adding a backend later is additive, not a rewrite |
| Static site + serverless functions | n/a     | $0 at low volume, metered above | Yes, but nothing in scope needs a function | A second runtime, a second failure mode, cold starts      | Low                                                    |
| Full application server + database | n/a     | ~$5–20/month                    | Yes, plus out-of-scope features            | Real: patching, backups, tested restores, uptime, secrets | High. The data would have to be migrated back out      |

**Why this one:** the binding constraints decide it outright. Budget is $0/month. The maintainer is
one person who also has to author the chess content, so operational attention is the scarcest
resource in the project. And the scope contract deliberately excludes accounts and sync, which are
the only requirements that would have forced a server.

The second-order benefit is larger than the cost saving: with no server, no database and no
accounts, the project has **no personal data, no secrets in production, no authentication surface,
and no compliance obligations at all**. That is not an accident of being small — it is a design
property, recorded here so that a future change is recognised as giving it up.

**Why not the others:** serverless functions would add a runtime and a failure mode to support
zero requirements — speculative infrastructure is still infrastructure. A server and database would
cost money, demand backup-and-restore discipline the project cannot sustain from one person's spare
time, and introduce an authentication surface for a site that authenticates nobody.

## Consequences

- Progress (F10) lives in `localStorage`. It is per-browser and per-device, and its loss is an
  accepted, non-critical event. Cross-device sync is impossible without revisiting this ADR.
- All content ships to the client. There is no private content and no access control — everything
  served is public by construction. Nothing secret may ever enter the content pipeline.
- Forced-mate verification and content validation happen at **build time**, not at request time. The
  build is therefore the only place correctness is enforced, which raises the importance of CI from
  a convenience to a load-bearing control.
- No server means no server-side rendering, so first paint depends on the JavaScript bundle. This is
  why the 200KB budget in `design-system.md` is enforced rather than aspirational.
- Response headers cannot be set on a static host, which constrains the security baseline. Recorded
  in `docs/security.md` rather than discovered later.

## What would change this

Any of: the owner asks for accounts or cross-device sync; content needs to be editable by people
without repository access; or a feature requires keeping a secret. Each of those makes the no-server
property impossible to retain, and the trade recorded above would have to be made again explicitly.

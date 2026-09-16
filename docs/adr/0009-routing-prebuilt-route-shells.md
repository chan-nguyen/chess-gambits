# 0009. Deep links: pre-built route shells, not hash routing and not the 404 trick

Every route the site can serve is emitted at build time as its own `index.html` at the matching
path. GitHub Pages then serves real, clean URLs with genuine HTTP 200 responses, with no hash, no
redirect flash, and no dependency on a static host behaving like a server.

## Status

accepted

## Context

Requirement F8 — a pasted URL restores the exact board, branch and language — is load-bearing for the
whole product, and GitHub Pages offers no rewrites, no redirects and no server-side routing
(ADR-0007). This is the decision that determines what every published link looks like forever, so it
is genuinely one-way: changing it later breaks every URL anyone has shared.

## Considered options

| Option                         | URLs                                     | HTTP status on a deep link                                                                                  | Cost                                                                                   |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Pre-built route shells**     | Clean: `/vi/gambits/evans-gambit?line=…` | **200**                                                                                                     | A ~20-line build step, no dependency                                                   |
| `404.html` copy-of-index trick | Clean                                    | **404** — cannot be overridden. Crawlers, uptime monitors and non-JS clients see every deep link as missing | Zero, but the status is a lie                                                          |
| Hash routing                   | `/#/vi/gambits/evans-gambit`             | 200                                                                                                         | Zero config, but permanently ugly and weak for sharing                                 |
| Full pre-rendering             | Clean                                    | 200                                                                                                         | Real content in the HTML, but needs a rendering framework and a headless browser in CI |

Shells are **not** byte-identical copies. A copied `index.html` would ship `<html lang="vi">` on
every French route until JavaScript runs — a WCAG 3.1.1 _Language of Page_ failure at **Level A**, in
a product claiming AA — and would give 1,800 distinct pages the same `<title>`, so browser history,
bookmarks and every link preview in Slack or Messenger would say nothing about which gambit or branch
the link points at. For a product whose headline feature is "copy this URL and it restores the exact
board", that is the difference between a shareable artefact and a string. The generator already has
the compiled catalogue, so each shell is emitted with its own `lang`, `<title>`, description,
`og:*` tags, `hreflang` alternates and canonical — about fifteen extra lines in the same build step.

**Why this one:** the route set is finite and known at build time — three locales × (home, catalogue,
about) plus three locales × each gambit. Emitting a copy of `index.html` at each of those paths is
file copying, not rendering: no framework, no dependency, no headless browser. It is the only option
that gets clean URLs _and_ honest status codes, and at roughly 2–3KB per shell — a built `index.html`
plus the per-shell head below — 1,003 gambits in three locales is about 7MB against a 1GB limit.

**Why not the others:** the 404 trick publishes links that report themselves as broken, which is a
poor fit for a project whose entire premise is not saying things that are untrue. Hash routing is
robust and free, but it is a permanent cosmetic cost on the one artefact users share, and migrating
away from it later would break every shared link. Full pre-rendering is the better long-term answer
if search traffic ever matters, and shells are a strict subset of that work — this choice does not
foreclose it.

## Consequences

- The build must enumerate routes from the compiled catalogue. That makes route generation depend on
  content, so a new gambit produces a new shell with no code change — which is requirement F11
  working as intended.
- `404.html` is still emitted, and now it means what it says: a genuinely unknown path.
- `.nojekyll` ships in the output so GitHub Pages never applies Jekyll processing to Vite's
  underscore-prefixed chunk filenames.
- The base path is configuration, not a constant. Adding a custom domain later moves the site from
  `/<repo>/` to `/`, so it is driven by an environment variable from the start rather than hard-coded
  into router paths.
- The shell count grows with the catalogue. It is far from any limit, but it is worth watching as
  breadth increases, and it is covered by the existing hosting tripwire.
- Playwright tests must run against the **built output on a static server** rather than the Vite dev
  server. Base-path and deep-link behaviour are precisely what unit tests cannot cover.

## What would change this

Search traffic becoming a real requirement, which would justify upgrading shells to full
pre-rendering — an additive change that keeps every URL identical.

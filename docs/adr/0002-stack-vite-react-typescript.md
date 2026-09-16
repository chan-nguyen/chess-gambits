# 0002. Vite + React + TypeScript

The product is a fully client-side interactive application (ADR-0001) deployed to a static host
(ADR-0007). Vite 8.3.0 with React 19.3.0 and TypeScript 7.0.2 is the stack: it is the one that
treats a sub-path deployment as a one-line configuration rather than a series of silent failures,
and it ships roughly half the JavaScript of the alternative.

## Status

accepted

## Considered options

Versions and licences verified against the npm registry on 2026-09-16.

| Option                        | Licence | Base-path handling                                                                                                                                                                  | Hello-world bundle | Fit                                                                                                                                                              |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite 8.3.0 + React 19.3.0** | MIT     | `base: '/<repo>/'` — one line; rebases HTML, JS-imported assets, CSS `url()`, and `public/`. The dev server _also_ serves at the base path, so sub-path bugs surface in development | **67.8 KB gzip**   | Purpose-built for a client-side app                                                                                                                              |
| Astro 7.3.2                   | MIT     | `site` + `base`, but raw `<a href>` and `public/` files are **not** prefixed — a documented footgun                                                                                 | 69.1 KB gzip       | Islands architecture optimises away hydration; this app is ~100% hydrated surface, so the model buys nothing                                                     |
| Next.js 16.3.5 static export  | MIT     | Worst, and **fails silently**: `basePath` misses `next/image` and `public/`; a measured build emitted an image route that cannot exist on a static host, and exited 0               | **133.4 KB gzip**  | Static export disables Rewrites, Redirects, Headers, ISR, Server Actions and Image Optimization — paying for a full-stack framework and switching most of it off |

**Why this one:** the binding constraints are a 200KB initial-JS budget and a host that serves from
`/<repo>/` with no ability to rewrite. Vite wins both outright. Next's export mode ships twice the
JavaScript before a line of product code exists, which spends a third of the budget on framework
runtime, and its own documentation suggests an nginx rewrite block for sub-path serving — which
GitHub Pages cannot do. Astro's strength is minimising hydrated surface, and this application is
hydrated surface.

**Why not the others:** Astro would degrade to a slower Vite with a sub-path footgun. Next would be
a framework fighting its own deployment target.

## Consequences

- React 19.3.0 is the current stable release and there is no reason to start a greenfield project
  behind it. ADR-0003 originally made 19 a hard requirement via a library peer range; that library
  was since dropped, so this is now a preference rather than a constraint.
- No server rendering, so first paint depends on the bundle. The 200KB budget is enforced in CI
  rather than hoped for.
- TypeScript 7 is the Go-native compiler. Should it prove troublesome, pinning back to 5.x is a
  configuration change and no code change — this is a two-way door recorded here only because it sits
  next to genuine one-way choices.
- Routing is React Router 8.4.0 (MIT). See ADR-0009 for how its URLs survive a static host.

## What would change this

Server-side rendering becoming necessary — which would mean either SEO turning into a real
requirement or the catalogue growing past what a client can filter comfortably. Both are tripwires
in `PROJECT-PLAN.md`.

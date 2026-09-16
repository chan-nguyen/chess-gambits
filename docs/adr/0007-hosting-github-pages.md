# 0007. Host on GitHub Pages from a public repository

The application is a static bundle (ADR-0001) with a $0 budget and a solo maintainer. The source is
already on GitHub, and a public repository gets Pages hosting and Actions minutes at no cost, so the
site is built by Actions and published to GitHub Pages — one vendor, one dashboard, one set of
credentials.

## Status

accepted

## Considered options

| Option                        | Licence | Cost to run  | PR previews | Extra vendor                         | Cost to leave                   |
| ----------------------------- | ------- | ------------ | ----------- | ------------------------------------ | ------------------------------- |
| **GitHub Pages, public repo** | n/a     | **$0**       | No          | None — already using GitHub          | Very low: it is a static bundle |
| Cloudflare Pages              | n/a     | $0 free tier | Yes         | Yes — a second account and dashboard | Very low                        |
| Netlify / Vercel free tier    | n/a     | $0 free tier | Yes         | Yes                                  | Very low                        |

**Why this one:** chosen by the owner. The deciding factor is that it adds no third party: one
account, one place to look when something breaks, one set of permissions to get right. For a
solo-maintained project, fewer moving parts is a quality property, not a compromise. Exit cost is
near zero in every row — this is a two-way door wearing a one-way door's clothes, which is precisely
why it did not deserve a long analysis.

**Why not the others:** Cloudflare Pages and Netlify both offer per-PR preview deployments, which
are genuinely valuable for a visual product, and this is the one real thing being given up. The
mitigation is that reviewers run the site locally, and that the visual surface is covered by
Playwright viewport tests rather than by eyeballing a preview URL.

## Consequences

- **The site is served from a sub-path** (`/<repo>/`) unless a custom domain is configured. Every
  asset URL and every client-side route must respect a configurable base path. This must be settled
  in the walking skeleton — it is cheap then and expensive after every route exists.
- **There is no server-side routing.** Deep links (F8, which the whole sharing story depends on)
  need an explicit strategy on a static host. This is called out as a Phase 2 risk and must be
  proven working in the walking skeleton, not assumed.
- **Response headers cannot be set.** Security controls that are normally headers must be delivered
  another way or accepted as absent — see `docs/security.md`.
- The repository is public, so its entire history is public. No secret may ever be committed, and
  secret scanning in CI is a requirement rather than a nicety.
- Free-tier limits (site size, bandwidth, build frequency) apply. They are recorded with the running
  cost in `PROJECT-PLAN.md` and are a tripwire, so reaching one is planned rather than discovered.

## What would change this

Per-PR preview deployments becoming necessary — for example if the owner starts accepting content
contributions from other people and needs to see a branch rendered before merging. Cloudflare Pages
is the pre-selected alternative and the migration is a workflow change, not a rewrite.

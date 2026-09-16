# Vendored opening dataset

A snapshot of [`lichess-org/chess-openings`](https://github.com/lichess-org/chess-openings), which
its README dedicates to the public domain under CC0. The commit it was taken from, and a SHA-256 of
every file, are recorded in `source.json`; `npm run catalogue:fetch` refreshes all of it together.

It is committed rather than downloaded during the build for three reasons. A build that reaches the
network is not reproducible, so a green CI run would stop being evidence that the same input
produces the same catalogue. A deploy would start depending on a third party being up. And the
"every gambit-named row has a written decision" gate in `classification.yaml` would fire on unrelated
pull requests whenever upstream added a row — here it fires only when a maintainer deliberately
refreshes the snapshot, which is exactly when someone should be looking.

Nothing in this directory is edited by hand. Names, ECO codes and move sequences come from upstream;
everything this project says _about_ an opening is written here from scratch (ADR-0008).

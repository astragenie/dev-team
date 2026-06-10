# Product Backlog (legacy — superseded)

This file is preserved as historical reference. The active product backlog
lives in **`docs/backlog/`** as one markdown file per feature
(`FEAT-NNN.md` in `pending/` → `triaged/` → `in-progress/` → `done/`).

See `docs/backlog/README.md` for the schema.

Cross-Slice Continuation HARD RULE in `CLAUDE.md` scans `docs/backlog/` for
the next unit of work; this file is no longer read by the loop.

Migrate any unfinished entries from this file into per-feature files via
`/loop:backlog add` or the one-off
`scripts/migrate-product-backlog.mjs` migration script shipped with the
plugin.

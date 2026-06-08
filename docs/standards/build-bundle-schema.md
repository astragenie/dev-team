# Build Bundle Schema

Build bundles are artifacts written by `crew:builder` / `crew:builder-be` / `crew:builder-fe` on completion and inlined by `/crew:review` / `/crew:validate` into reviewer/validator dispatch prompts. They preload the builder's working set so downstream agents skip re-Read round-trips and arrive with builder context.

## Path

```
.claude/artifacts/crew/bundles/{sliceId}/{builderName}-{runId}-build-bundle.md
```

- `sliceId` — current `currentRun.slice` from `.claude/state/crew/workflow-state.json`. Bundles written without a resolvable slice land under `bundles/orphan/`.
- `builderName` — one of `builder`, `builder-be`, `builder-fe`.
- `runId` — ISO compact UTC: `YYYYMMDDTHHMMSSZ`.

## Frontmatter

```yaml
---
slice: SLICE-NN          # or "unknown" for orphan bundles
builder: builder-be
run_id: 20260608T223000Z
feat: FEAT-NNN           # optional
files_touched: [path/a.ts, path/b.ts]
files_read: [path/c.ts, path/d.md]
files_read_skipped:
  - { path: path/e.ts, reason: outside-repo }
diff_stat: { files: 2, additions: 47, deletions: 5 }
truncated: false
truncation_reason: null  # or "size-cap"
schema_version: 1
---
```

Required: `slice`, `builder`, `run_id`, `files_touched`, `files_read`, `diff_stat`, `truncated`, `schema_version`.
Optional: `feat`, `files_read_skipped`, `truncation_reason`.

`files_read_skipped[].reason` ∈ `{outside-repo, deleted, binary}`.

## Sections (fixed order)

1. `## Handoff` — verbatim handoff body from `crew.ts write-handoff`.
2. `## Diff` — output of `git diff` for changed files.
3. `## Files touched` — full contents of each file in `files_touched`, alphabetical, each fenced with a path header `### path/a.ts`.
4. `## Files read` — full contents of each file in `files_read`, alphabetical, same fencing pattern.

Determinism rule: identical `BundleInputs` produce byte-identical bundles. No timestamps in section bodies. Alphabetical ordering within each file-list section.

## Size cap

Soft cap: 200 KB. When exceeded, drop entries in this order:
1. `Files read` section (LRU by `last_read_at` from cost-hygiene state).
2. `Files touched` section (alphabetical, last-named first).

Set `truncated: true` and `truncation_reason: size-cap` when truncation occurs.

## Binary files in `files_touched`

Replace contents with `<binary file, N bytes, sha=…>` placeholder. SHA is `sha256` hex (first 16 chars).

## Outside-repo paths

`files_read` paths resolving outside the repo root are dropped from the bundle and recorded in `files_read_skipped` with `reason: outside-repo`. Protects against accidental ingest of files Read outside the project (e.g., `~/.aws/credentials`).

## Mtime tiebreak

When two bundles in the same `bundles/{slice}/` dir share an mtime within 1 second, the inliner picks the alphabetically-last filename.

## schema_version migration log

| Version | Date | Change |
|---|---|---|
| 1 | 2026-06-08 | Initial schema |

# Build Bundle — Context Preloading for Reviewer / Validator

**Date:** 2026-06-08
**Author:** lead (via /superpowers:brainstorming)
**Status:** Draft — awaiting user review

---

## Background

Competitor research (`.claude/artifacts/crew/research/20260608T220200Z-competitor-matrix-agent-crews.md`) flagged the Anthropic Claude Agent SDK session-fork primitive as a stealable feature: when a reviewer or validator is spawned to evaluate a builder's work, having access to the builder's already-loaded context yields a quality and cost win.

The Crew harness ships as a Claude Code plugin and does not have access to a literal session-fork API. The closest equivalent achievable at the plugin layer is **prompt-prefix replay** — the builder writes a structured snapshot of its working set to an artifact, and downstream review / validate dispatches inline that snapshot. The effective benefit is context preloading: the reviewer arrives with the builder's investigation already in its prompt and skips a round of file-reading and rediscovery.

This spec covers ONE steal from that research. It is the first in a series; the remaining ranked opportunities (memory compaction, per-tool approval flags, role guardrails, CodeAct loop-collapsing) get their own spec/plan/build cycles.

## Goal

Reduce `review:needs_fix` rebound count in the autonomous loop by giving the reviewer and validator the builder's full working set inline. Quality win is the primary success criterion; cost-neutral-to-up is acceptable.

## Non-goals

- Literal cache forking (requires SDK-level changes outside the plugin).
- Bundle reuse across slices (single-slice scope only).
- Bundle reuse across builder variants in the same slice (each builder run writes its own bundle).
- Automatic bundle pruning (artifact retention left to a later decision if disk pressure emerges).

## Success criteria

1. Every `crew:builder`, `crew:builder-be`, `crew:builder-fe` invocation writes a build bundle on successful return.
2. Every `/crew:review` and `/crew:validate` dispatch in a slice with a bundle inlines that bundle into the subagent prompt under `## Builder context (preloaded — do not re-Read these files)`.
3. Bundle write failures are non-blocking — reviewer / validator fall back to today's handoff-only dispatch.
4. New `scripts/validate-bundles.ts` validator is wired as a hard CI gate.
5. Median `review_rebound_count` over a 10-slice rolling window trends down after rollout. Recorded in a follow-up DEC if signal materializes.

## Subsystem

### Components

**Builder side (writer)**
- `agents/builder.md`, `agents/builder-be.md`, `agents/builder-fe.md` — appended instruction in `## Output` section: before returning the completion message, invoke the bundle writer CLI and include the bundle path in handoff frontmatter under `bundle_path:`.
- `scripts/build-bundle-write.ts` — CLI wrapper that delegates to the assembler.
- `scripts/lib/build-bundle/assemble.ts` — pure TS module, Node 22.6+ strip-types.

**Main-thread side (reader / inliner)**
- `commands/review.md`, `commands/validate.md` — added build step that resolves slice, finds latest bundle, reads it, and inlines into the dispatch prompt body. (These are the `crew` plugin commands; the `crew:` prefix is plugin namespacing, not a subdirectory.)
- Shared helper module `scripts/lib/build-bundle/inline.ts` — pure function from bundle path → inline header string.

**Schema + governance**
- `docs/standards/build-bundle-schema.md` — schema source of truth, migration log for `schema_version`.
- `docs/routing-table.md` — new row tying builders → bundle writer and reviewer/validator → bundle inliner.
- `scripts/validate-bundles.ts` — schema validator joining the existing hard validator family.

### Interfaces

`scripts/lib/build-bundle/assemble.ts`:

```ts
export interface BundleInputs {
  sliceId: string;
  builderName: 'builder' | 'builder-be' | 'builder-fe';
  runId: string;
  feat?: string;
  handoffBody: string;
  filesTouched: string[];
  filesRead: string[];
}

export interface BundleOutput {
  path: string;
  bytes: number;
  truncated: boolean;
  filesReadSkipped: Array<{ path: string; reason: 'outside-repo' | 'deleted' | 'binary' }>;
}

export async function assembleBuildBundle(
  inputs: BundleInputs
): Promise<BundleOutput>;
```

`scripts/lib/build-bundle/inline.ts`:

```ts
export interface InlineOptions {
  sliceId: string;
  bundlesRoot?: string; // defaults to .claude/artifacts/crew/bundles
  supportedSchemaVersion?: number; // defaults to 1
}

export async function inlineLatestBundle(
  opts: InlineOptions
): Promise<string>; // returns "" on no-bundle / malformed / version-too-high
```

### Bundle file path

```
.claude/artifacts/crew/bundles/{sliceId}/{builderName}-{runId}-build-bundle.md
```

- `sliceId` resolved from `.claude/state/crew/workflow-state.json` (`currentRun.slice`).
- `builderName` ∈ `{builder, builder-be, builder-fe}`.
- `runId` is ISO compact UTC: `YYYYMMDDTHHMMSSZ`.

### Bundle schema

Frontmatter:

```yaml
---
slice: SLICE-NN
builder: builder-be
run_id: 20260608T223000Z
feat: FEAT-NNN
files_touched: [path/a.ts, path/b.ts]
files_read: [path/c.ts, path/d.md]
files_read_skipped:
  - { path: path/e.ts, reason: outside-repo }
diff_stat: { files: 2, additions: 47, deletions: 5 }
truncated: false
truncation_reason: null
schema_version: 1
---
```

Sections in fixed order:

1. `## Handoff` — verbatim handoff body from `write-handoff` CLI.
2. `## Diff` — `git diff` output for changed files.
3. `## Files touched` — full contents of each file in `files_touched`, fenced with path header.
4. `## Files read` — full contents of each file in `files_read`, fenced with path header.

Deterministic ordering: alphabetical within each file-list section. Diff sections follow git's natural order.

### Data flow

1. Slice starts via `/loop:slice start`; `workflow-state.currentRun.slice` is set.
2. Main thread dispatches a builder variant.
3. Builder runs; existing `hooks/record-read-content.ts` continues to log every `Read` to `.claude/logs/`.
4. Builder writes its handoff via `write-handoff` CLI.
5. Builder invokes `node scripts/build-bundle-write.ts` with `--slice`, `--builder`, `--run`, `--feat`, `--handoff <path>`. The CLI loads the handoff body, pulls the `files_read` ledger entries from `.claude/logs/` scoped to the builder's run window, snapshots `files_touched` from working tree, computes `diff_stat` via `git diff --numstat`, and atomically writes the bundle (tmp + rename).
6. Builder returns; handoff frontmatter has `bundle_path: ...`.
7. `/crew:review` or `/crew:validate` runs its command body:
   - Resolves current slice from `workflow-state.json`.
   - Globs `.claude/artifacts/crew/bundles/{slice}/*-build-bundle.md`.
   - Picks the latest mtime (tiebreak: alphabetically last).
   - Reads the bundle.
   - Inlines content into the dispatch prompt under `## Builder context (preloaded — do not re-Read these files)`.
8. Reviewer / Validator subagent runs with builder's working set already in its prompt and skips re-reading the listed files.

On `/crew:fix` rebound, the builder writes a fresh bundle (`run_id` advances). The inliner always picks the newest by mtime, keeping the retry cycle consistent.

### Error handling

| Failure | Behavior |
|---|---|
| `build-bundle-write.ts` exits non-zero | Builder logs error under handoff `## Bundle write failure` section. Returns success without `bundle_path` in handoff frontmatter. Reviewer / validator skip inline step, fall back to handoff-only dispatch. **Non-blocking.** |
| File in `files_read` deleted mid-run | Skipped silently. Added to `files_read_skipped` with reason `deleted`. |
| Binary file in `files_touched` | Replaced with `<binary file, N bytes, sha=…>` placeholder. |
| Bundle exceeds soft cap (default 200KB) | Truncate `files_read` section first (LRU by read order), then `files_touched` last. `truncated: true` set with `truncation_reason: size-cap`. |
| Path outside repo root in `files_read` | Dropped, added to `files_read_skipped` with reason `outside-repo`. |
| `workflow-state.json` unreadable / no slice | Bundle written to `bundles/orphan/`, frontmatter `slice: unknown`. Inliner skips orphan bundles, falls back. |
| Bundle file missing on inline step | Returns empty string. Dispatch proceeds with today's prompt. Single-line warn log. |
| Bundle frontmatter unparseable | Returns empty string + warn. |
| `schema_version` > inliner's supported version | Returns empty string + warn. Forward-compatible: lower versions accepted as long as inliner can render. |
| Multiple bundles, identical mtime within 1 second | Alphabetically-last wins (deterministic). Documented in schema doc. |
| Bundle has `truncated: true` | Inlined with appended warning line: `> NOTE: builder bundle was size-capped, reviewer should manually re-read suspect files`. |

### Security

- Bundle is plain Markdown over repo files only. No secrets injected by the assembler.
- Builder agent is already trusted to Read repo files — same trust boundary.
- `git diff` respects `.gitignore`; ignored files stay out of the diff section.
- Assembler rejects `files_read` paths outside repo root (`reason: outside-repo`). Protects against accidental ingest of files Read by the builder outside the project (e.g. `~/.aws/credentials`).

## Artifact policy

Bundles live under `.claude/artifacts/crew/bundles/` and are **committed**, matching the existing artifact policy in `CLAUDE.md` (durable cross-machine history). Per-slice subdirectory avoids global growth. No automatic pruning — retention is a future decision if disk pressure emerges.

`brief-me` gains one new summary line: `bundles: N written this slice, M malformed, K size-capped`. Surfaces hot spots without log diving.

## Testing

### Unit — `tests/build-bundle-assemble.test.ts`

Targets `scripts/lib/build-bundle/assemble.ts`. Node 22.6+ strip-types runtime.

- Happy path: 2 touched + 3 read files → bundle written, frontmatter populated, sections in fixed order, deterministic byte output across two runs with identical inputs.
- `files_read` ledger references a deleted file → skipped, `files_read_skipped` populated.
- Binary file in `files_touched` → placeholder + sha.
- Soft cap exceeded → `files_read` truncated first (LRU), `truncated: true` set.
- Path outside repo root in `files_read` → dropped, `reason: outside-repo`.
- No current slice in `workflow-state.json` → written to `bundles/orphan/`, `slice: unknown`.
- Atomic write: crash mid-write leaves no partial file.
- `git diff --numstat` parse: correct `diff_stat`.

### Unit — `tests/build-bundle-inline.test.ts`

Targets `scripts/lib/build-bundle/inline.ts`.

- Bundle present → returns string starting with `## Builder context (preloaded — do not re-Read these files)` followed by bundle body.
- No bundle → empty string, no throw.
- Malformed frontmatter → empty string + warn log line.
- `schema_version > supportedSchemaVersion` → empty string + warn log line.
- Multiple bundles, mtime tiebreak → alphabetically-last selected.
- `truncated: true` bundle → inlined plus appended warning header.

### Integration — `scripts/e2e-smoke.mjs`

Extend the existing smoke. After running `/crew:build` against the sample repo:

1. Assert bundle file exists under sample repo's `.claude/artifacts/crew/bundles/{slice}/`.
2. After reviewer dispatch: assert reviewer prompt contained `## Builder context (preloaded` header.
3. Reviewer artifact references at least one file from the bundle's `files_touched`.

Failure of any new assertion = smoke fails = CI red.

### Schema validation — `scripts/validate-bundles.ts`

- Walks `.claude/artifacts/crew/bundles/**/*.md`.
- Parses each, asserts required frontmatter fields present + `schema_version` known.
- Exits non-zero on any malformed bundle.
- Wired as CI gate step 5.5 in `.github/workflows/test.yml` between `validate-slices.ts` and the routing-table check.
- No advisory mode — bundles are committed artifacts, malformed = block CI.

### Telemetry hook

Add `review_rebound_count` field to the existing `.claude/artifacts/crew/grade/` template (the loop slice-grade artifact). Already implicitly tracked via cost reports; this promotes it to an explicit field for quality-win measurement. Win threshold: median rebound count drops over a rolling 10-slice window.

No production benchmark gate. Quality metric is the success criterion.

### Manual QA gate

After the first slice using the system:
- Spot-check 2 bundles for size + content sanity.
- Compare reviewer turn count + tool-use count vs prior 5 slices (sanity check on the quality-win hypothesis).
- Record observation in `docs/decisions/DEC-NNN-build-bundle-validation.md` if the ratio shifts materially.

## Impact summary

Files added:
- `scripts/build-bundle-write.ts`
- `scripts/lib/build-bundle/assemble.ts`
- `scripts/lib/build-bundle/inline.ts`
- `scripts/validate-bundles.ts`
- `docs/standards/build-bundle-schema.md`
- `tests/build-bundle-assemble.test.ts`
- `tests/build-bundle-inline.test.ts`

Files modified:
- `agents/builder.md`, `agents/builder-be.md`, `agents/builder-fe.md` — write step in Output section.
- `commands/review.md`, `commands/validate.md` — read+inline step before dispatch.
- `docs/routing-table.md` — routing row.
- `scripts/e2e-smoke.mjs` — three new assertions.
- `.github/workflows/test.yml` — new validator step.
- `package.json` — `validate-bundles` script.
- `CHANGELOG.md` — release note under next minor version.
- `scripts/lib/briefing/collect.ts` (or equivalent `brief-me` source) — bundle summary line.
- Grade template under `.claude/artifacts/crew/grade/` — new `review_rebound_count` field.

## Open questions

None at design time. Schema can evolve via `schema_version` bumps; bundle retention policy deferred until repo size pressure observed.

## Out of scope (separate specs in the steal series)

- Memory compaction (Mastra Observer+Reflector).
- Per-tool `requires_approval` flag (Pydantic AI).
- Per-role I/O guardrails (OpenAI Agents SDK).
- CodeAct loop-collapsing (MAF).
- Remaining ranked items in `.claude/artifacts/crew/research/20260608T220200Z-competitor-matrix-agent-crews.md` sections 5.

# Plugin Performance & Quality — 10 Mechanical Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 10 independent mechanical improvements (5 performance, 5 quality) to the hero-crew plugin scripts and CI config — zero agent prompt edits, all `autonomous_safe: true`.

**Architecture:** Each improvement is self-contained. Perf items target I/O hot paths and script startup; quality items consolidate duplication and split large modules. All must pass the full self-verify gate (`lint`, `typecheck`, `node --test`, all 4 validators) independently.

**Tech Stack:** Node 22.6+ (strip-types), TypeScript strict, ESLint flat config, GitHub Actions CI

---

## Scope

### In scope
- `scripts/lib/wakeup.mjs` — I/O hot-path fixes
- `scripts/lib/briefing/collect.ts` — parallel collection + split
- `scripts/lib/session-cost-scanner.ts` — pure-function extraction
- `scripts/crew.ts` — Flags/FLAG_SPEC single source of truth
- `scripts/lib/fs-utils.ts` (new) — shared file utilities
- `scripts/validate-all.ts` (new) — concurrent validator runner
- `scripts/prune-artifacts.ts` (new) — artifact pruning script
- `commands/prune-artifacts.md` (new) — CLI command definition
- `.github/workflows/test.yml` — routing-table gate promotion
- `.claude/` hook config — FEAT-029 reread hook default-on
- `package.json` — new `validate:all` script entry

### Out of scope
- Agent prompt edits (`agents/*.md`)
- Skill edits (`skills/**`)
- Routing-table content changes
- Any behavioral change visible to end-users beyond `crew prune-artifacts`

---

## FEAT Catalog

### P1 — serial-stat-fix

**Files:** `scripts/lib/wakeup.mjs`

**Problem:** `countFiles()` (lines 57–71) and `listFilesNewestFirst()` (lines 78–93) call `await fs.stat()` inside a serial loop — N syscalls per directory.

**Fix:**
- `countFiles(dir)`: replace `for await` + `stat()` with `readdir(dir, {withFileTypes:true})`; count entries where `entry.isFile()`
- `listFilesNewestFirst(dir)`: replace with `readdir+withFileTypes`, then `Promise.all(entries.map(e => stat(join(dir, e.name))))` for mtime sort — one batch

**Acceptance:**
- Existing tests for `countFiles` pass
- New test: N-file directory returns correct count; no serial stat path exercised
- `npm run lint` clean

---

### P2 — FEAT-029: reread-hook-default-on

**Files:** `.claude/hooks/` config (locate exact path), any opt-in docs

**Problem:** Cost-hygiene reread hook is opt-in; 114 redundant Reads/slice identified.

**Fix:**
- Change default from opt-in to opt-out
- `CREW_REREAD_HOOK=0` env var disables
- Update any documentation that describes it as opt-in

**Acceptance:**
- Hook fires on a synthetic double-Read sequence without manual enable
- `CREW_REREAD_HOOK=0` suppresses it
- Docs updated

---

### P3 — validate-parallel

**Files:** `scripts/validate-all.ts` (new), `package.json`

**Problem:** Four validate-* scripts run sequentially in CI and manually.

**Fix:**
- New `scripts/validate-all.ts`: `Promise.all([validateManifests(), validateSkills(), validateAgents(), validateSlices()])`, collect all failures, exit non-zero if any fail
- Add `"validate:all": "node --experimental-strip-types scripts/validate-all.ts"` to `package.json` scripts

**Acceptance:**
- `npm run validate:all` exits 0 on clean repo
- `npm run validate:all` exits 1 and prints all failures when one validator fails
- Individual validate-* scripts unchanged

---

### P4 — briefing-parallel

**Files:** `scripts/lib/briefing/collect.ts`

**Problem:** Top-level data collection calls (git log, cost report reads, workflow state reads) are sequential despite having no data dependencies on each other.

**Fix:**
- Audit `collect.ts` for independent top-level async calls
- Wrap independent branches in `Promise.all`; preserve any dependency order where it exists
- No output change — same briefing content, lower latency

**Acceptance:**
- All existing briefing tests pass
- No output diff on a real repo run
- `npm run typecheck` + `npm run lint` clean

---

### P5 — artifact-prune

**Files:** `scripts/prune-artifacts.ts` (new), `commands/prune-artifacts.md` (new)

**Problem:** `.claude/artifacts/crew/` accumulates indefinitely; file scanning slows down over time.

**Fix:**
- `scripts/prune-artifacts.ts`: scan `.claude/artifacts/crew/` subdirs, delete files where `mtime < Date.now() - days * 86400000`
- Flags: `--older-than <days>` (default: 90), `--dry-run` (print list, no delete), `--repo <path>`
- `--dry-run` is always safe; destructive only without `--dry-run`
- `commands/prune-artifacts.md`: registers `crew prune-artifacts` command

**Acceptance:**
- `--dry-run` lists files without deleting
- Destructive mode deletes only files matching age threshold
- Rejects invalid `--older-than` (NaN, negative, zero)
- Unit tests for age filter logic (pure function, no I/O)

---

### Q1 — fs-utils

**Files:** `scripts/lib/fs-utils.ts` (new), 5 callers of `pathExists`, 2 callers of `readJson`

**Problem:** `pathExists()` defined in 5 separate files; `readJson()` defined in 2 files.

**Callers to update:**
- `scripts/lib/briefing/collect.ts`
- `scripts/lib/deployment-guidance/read.ts`
- `scripts/lib/fleet.ts`
- `scripts/lib/installer/util.ts` (currently exports its own — re-export from fs-utils instead)
- `scripts/lib/wakeup.mjs`
- `scripts/validate-manifests.ts` (readJson)

**Fix:**
- `scripts/lib/fs-utils.ts`: export `pathExists(p: string): Promise<boolean>` and `readJson<T>(p: string): Promise<T>`
- Update all callers to import from `fs-utils`
- Delete local definitions

**Acceptance:**
- All 7 call sites import from `scripts/lib/fs-utils.ts`
- Unit tests: `pathExists` for existing/missing path; `readJson` for valid JSON, missing file, malformed JSON
- `npm run typecheck` + `npm run lint` clean

---

### Q2 — flags-dedup

**Files:** `scripts/crew.ts`

**Problem:** `FLAG_SPEC` (runtime array, ~90 entries, lines 13–90) and `Flags` interface (TypeScript, lines 92–165) both enumerate the same flags — drift-prone.

**Fix:**
- Derive `Flags` type from `FLAG_SPEC` using a mapped type:
  ```ts
  type Flags = { [K in typeof FLAG_SPEC[number] as K['name']]: K extends { type: 'boolean' } ? boolean : string | undefined }
  ```
  (exact shape depends on FLAG_SPEC structure — builder determines correct derivation)
- Remove the hand-written `Flags` interface
- TypeScript compiler enforces sync at build time

**Acceptance:**
- `npm run typecheck` passes with derived type
- No runtime behavior change
- Test: flag count from `FLAG_SPEC.length` equals known baseline (prevents accidental removal)

---

### Q3 — collect-split

**Files:** `scripts/lib/briefing/collect.ts` (712 lines → thin orchestrator), new `briefing/git.ts`, `briefing/cost.ts`, `briefing/workflow.ts`

**Problem:** `collect.ts` handles git log, cost report parsing, and workflow state — 3 concerns in one 712-line file.

**Fix:**
- `briefing/git.ts`: git log, branch, recent commits functions
- `briefing/cost.ts`: cost report parsing, model burn, cache metrics
- `briefing/workflow.ts`: workflow state, badges, artifact reads
- `briefing/collect.ts`: thin orchestrator (~80 lines) importing from the 3 modules

**Size constraints:** Each new file ≤ 250 lines; orchestrator ≤ 80 lines

**Acceptance:**
- All existing briefing tests pass
- No output change in briefing content
- Each new file has a single clear concern
- `npm run lint` clean (no new max-lines violations)

---

### Q4 — scanner-extract

**Files:** `scripts/lib/session-cost-scanner.ts` (582 lines), new `scripts/lib/session-cost-scanner/compute.ts`

**Problem:** Pure computation functions (token aggregation, model-burn accumulation, cache hit calculation) are entangled with I/O in a dense 582-line file.

**Fix:**
- Identify pure functions (no `fs`, no side effects)
- Extract to `session-cost-scanner/compute.ts`
- `session-cost-scanner.ts` becomes thin I/O wrapper calling compute functions

**Acceptance:**
- Extracted functions have no I/O dependencies — testable without mocks
- Unit tests for pure functions (input → expected output)
- Existing integration tests for scanner pass
- `npm run typecheck` + `npm run lint` clean

---

### Q5 — routing-gate

**Files:** `.github/workflows/test.yml`

**Problem:** `validate-routing-table.ts` step has `continue-on-error: true` — routing violations don't fail CI.

**Fix:**
- Confirm `validate-routing-table.ts` exits 0 on current `main`
- Remove `continue-on-error: true` from the CI step

**Acceptance:**
- CI passes on clean repo
- A deliberate routing-table violation (tested locally) causes CI to fail
- No other CI step changed

---

## Delivery order

Recommended sequence for the loop:

1. Q1 (fs-utils) — unblocks P1 (wakeup.mjs can use shared pathExists after fix)
2. P1 (serial-stat-fix)
3. P2 (FEAT-029)
4. P3 (validate-parallel)
5. P4 (briefing-parallel) — can run after Q3 or independently
6. Q2 (flags-dedup)
7. Q3 (collect-split) — prerequisite awareness: P4 may touch same file; sequence after P4
8. Q4 (scanner-extract)
9. P5 (artifact-prune)
10. Q5 (routing-gate) — last; safest to promote gate after all other fixes pass CI

---

## Self-verify gate (all FEATs)

Every FEAT must independently pass before handoff:

```
npm run lint          # zero warnings
npm run format:check  # or npm run format then re-check
npm run typecheck
node --test --experimental-strip-types
node ./scripts/validate-manifests.ts
node ./scripts/validate-skills.ts
node ./scripts/validate-agents.ts
node ./scripts/validate-slices.ts
```

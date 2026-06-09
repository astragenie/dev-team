# Loop↔Crew State Contract — Design

- **Date:** 2026-06-10
- **Status:** approved (brainstorming session)
- **Phase:** 1 of the crew/loop interaction-workflow program
- **Repos:** `loop` (C:\work\mega\loop, primary), `hero-crew` (consumer/migration)
- **Related:** FEAT-144 (loop CLI ignores configured backlogRoot), FEAT-138
  (CI red — drift; only state-shaped failures in scope here)

## Problem

Loop↔crew state lives in many hand-maintained surfaces that must agree but
have no contract keeping them honest:

- `loop backlog add` (and an unknown subset of other subcommands) never loads
  `.claude/loop.json`, so writes fall back to default paths while config-aware
  code (github-sync) resolves the configured ones. Result in hero-crew: **two
  diverged backlog trees** (`docs/backlog/` vs `.claude/artifacts/loop/backlog/`)
  with contradictory FEAT states (FEAT-121, FEAT-129), FEATs existing in only
  one tree (FEAT-120, FEAT-136/137), a wrong session-start snapshot, and id
  collisions pending (both trees mint from their own max id).
- Verified at loop v0.35.0: `config-resolver.mjs` exists but adoption is
  partial — `runBacklogAdd` (scripts/loop.mjs:448) still skips `resolveConfig`.
  The failure class is "some commands load config, some don't."
- State file shapes (FEAT frontmatter, slice files, grades, decisions) have no
  validated schema; invalid files are discovered only when a consumer breaks.

## Decisions (from brainstorming)

1. **Scope:** interaction redesign program; phase 1 = state unification.
   Phases 2–4 (named, not designed here): machine-readable routing registry +
   generated agent skill-blocks; handoff ceremony tiering; prompt↔test↔doc
   drift prevention.
2. **Authority:** the single state root is `.claude/artifacts/loop/` (the loop
   CLI default). `docs/backlog/` is merged in and deleted.
3. **Approach:** B — full schema contract + CLI write-guards + `loop doctor`
   (not just config plumbing).

## Architecture

One authoritative state root per repo, governed by a versioned schema contract
owned by the **loop repo**. Three enforcement layers:

1. **Config resolution at the dispatcher** — a subcommand cannot see a
   different root than its siblings.
2. **Write-guard** — no code path can write state outside the resolved root or
   write a schema-invalid file.
3. **`loop doctor`** — detector (CI) and repairer (interactive) for divergence
   that predates the guards or arrives from outside (manual edits, older
   plugin versions).

Crew-owned state (`.claude/state/crew/workflow-state.json`) stays governed by
crew's existing `scripts/lib/schemas.ts`; this contract covers the loop-owned
surfaces crew reads.

## Components

### C1. Schema contract (loop repo)

- New `schemas/` directory + `scripts/lib/state-schemas.mjs` exposing
  `validateFeat`, `validateSlice`, `validateGrade`, `validateDecision`,
  `validateLoopJson` — plain-JS validators (no new deps), each returning
  `{ ok, issues: string[] }`.
- Every schema carries `schemaVersion`. `loop.json` already has
  `schemaVersion: 1`; FEAT/slice frontmatter gains it, defaulted when absent
  (absent ⇒ version 1; validators never hard-fail solely on a missing version).
- Contract documented once in loop `docs/state-contract.md`. hero-crew's
  `docs/standards/loop-json-schema.md` becomes a pointer to it (no parallel copy).

### C2. CLI hardening (loop repo)

- `resolveConfig(repoPath)` called **once** in the command dispatcher; the
  resolved config object is passed into every runner. Individual `runX`
  functions lose the ability to load (or skip) config.
- All state writes route through one `state-paths` module; it throws
  (loudly, with the refused path and the resolved root) on any target outside
  the resolved roots.
- `backlog-writer` (and slice/grade/decision writers) validate frontmatter via
  C1 before writing. Invalid ⇒ error with issues list; nothing written.

### C3. `loop doctor` (loop repo)

- `loop doctor --check` — CI mode; exit 1 with findings report. Detects:
  - dual/stray state trees (any state directory outside the resolved root)
  - FEAT/slice id collisions across trees
  - schema-invalid state files
  - config-vs-reality mismatches (configured root missing, default root
    populated while config points elsewhere)
  - cross-tree state contradictions (same FEAT, different lifecycle state)
- `loop doctor --fix` — merges stray trees into the authoritative root,
  resolving per-FEAT state conflicts by git history (latest authoritative
  transition wins); writes a migration report artifact **before** moving
  anything; never deletes file content — moves/merges only (removing a
  directory left empty after all its files were merged is allowed).

### C4. hero-crew migration

1. Remove path overrides (`backlogRoot`, `backlogPath`, `slicesRoot`,
   `aiLoopRoot`, …) from `.claude/loop.json` where they merely restate or
   contradict defaults — chosen authority **is** the default.
2. Run `loop doctor --fix`: merge `docs/backlog/` (~84 files incl.
   FEAT-139–144) into `.claude/artifacts/loop/backlog/`; delete `docs/backlog/`.
3. Update CLAUDE.md "Backlog discipline" section to the new path; regenerate
   `loop-snapshot.md` via `/loop:snapshot-memory`.
4. Add CI step: `loop doctor --check` (hard gate).
5. github-sync hook: no change needed — with overrides gone it defaults to the
   artifacts tree.

### C5. Release

- Loop ships **v0.36.0** (minor: new command + contract).
- hero-crew bumps the marketplace pin, refreshes plugin cache, closes FEAT-144
  citing this spec.

## Error handling & rollback

- Migration lands as one commit — git-revertible.
- Doctor writes its report artifact before any move; the report lists every
  planned action (source → destination, conflict resolution chosen, evidence).
- Write-guard and validators fail loudly and write nothing on violation.
- Validators/doctor never auto-delete; `--fix` moves, merges, or rewrites with
  the report as audit trail.

## Testing

Loop repo:

- Table-driven dispatcher test: every registered subcommand receives the
  resolved config (guards the FEAT-144 class permanently).
- Schema fixture tests: valid + invalid fixture per state type.
- Doctor tests against fixture repos: dual trees, id collisions, contradictory
  states, config mismatch — `--check` finds them; `--fix` produces a clean
  `--check` afterward and a complete report.

hero-crew:

- Post-migration `loop doctor --check` green in CI.
- FEAT-138's state-shaped test failures (live workflow-state schema) resolved
  by migration; prompt-content drift failures remain in FEAT-138's scope.

## Out of scope (later phases)

- Phase 2: machine-readable routing registry; agent "Skills you consult"
  blocks generated from it; routing validator becomes a hard gate including
  file-existence checks for every reference (initial evidence: 4 unresolved
  skill IDs, 2 agent-block inconsistencies, 4+ broken references found by
  ad-hoc sweep on 2026-06-10).
- Phase 3: handoff ceremony tiering (light/standard/full by work size).
- Phase 4: prompt↔test↔doc drift prevention (generated assertions or a single
  source of truth for agent prompt contracts).

## Acceptance criteria

1. Every loop CLI subcommand resolves config through the dispatcher; the
   dispatcher test proves it.
2. State writes outside the resolved root are impossible (write-guard test).
3. Schema-invalid state files cannot be written; validators report issues.
4. `loop doctor --check` detects all five divergence classes on fixtures;
   `--fix` repairs them with a pre-action report.
5. hero-crew has exactly one backlog tree (`.claude/artifacts/loop/backlog/`),
   id-collision-free, schema-valid, with CLAUDE.md and snapshot regenerated.
6. CI in both repos runs the new checks as hard gates and is green.
7. Loop v0.36.0 released; hero-crew pin bumped; FEAT-144 closed.

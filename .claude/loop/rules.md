# Autonomous Loop — HARD RULES

Plugin-managed by `/loop:install`. Do not edit by hand.

## Autonomous Loop Instruction — HARD RULE

**Run autonomously until ALL acceptance criteria for the current slice are met. Do NOT ask the user for confirmation, clarification, or approval at any point during implementation. Do NOT stop after implementation — run review, fix all findings, run validation, then write artifacts and push. Only stop when every acceptance criterion is marked PASS with evidence (per `docs/ai-loop/01-loop-control/EVIDENCE_RULES.md`), or the work is externally blocked (missing infrastructure, secret, or external dependency that cannot be resolved without the user). If blocked, state the blocker clearly and stop there.**

## Cross-Slice Continuation — HARD RULE

After all acceptance criteria for the current slice are PASS with evidence and all artifacts written, automatically pick the next unit of work using the following scan order — without user confirmation:

1. **Scan `docs/specs/`** — for any spec with `status: approved` and empty `derived_features`, decompose it: `/loop:spec decompose --id SPEC-NNN --features "title 1; title 2; ..."`. The agent reads the spec body and supplies the feature titles. New FEAT files land in `docs/backlog/pending/`.

2. **Scan `docs/backlog/pending/`** — if any pending entries exist, run `/loop:backlog triage` to fill `priority`, `category`, `target_release` heuristically and move each to `docs/backlog/triaged/`.

3. **Pick the highest-priority triaged feature** — break P0 > P1 > P2 > P3 ties by most recently triaged. Promote it: `/loop:slice from-feature --id FEAT-NNN`. The plugin creates a new slice file under `docs/ai-loop/slices/pending/`, moves the feature to `docs/backlog/in-progress/`, and cross-links them via frontmatter (`slices: [SLICE-NN]` on the feature; `feature: FEAT-NNN` on the slice).

4. **Begin the Wiggin Loop on the new slice.** Acceptance criteria, evidence, review per `docs/ai-loop/01-loop-control/`.

5. **On slice close** — run the Slice Close Ceremony (next section). Do NOT skip this and move on to the next slice — every artifact emitted by the ceremony is part of the slice's evidence record.

If `docs/backlog/pending/` and `docs/backlog/triaged/` are both empty AND `docs/specs/` has no undecomposed approved specs, the agent has reached either stop condition A (every spec satisfied — confirm with `/loop:spec status`) or stop condition B (externally blocked). Surface which and stop. Never stop because the backlog "feels empty" — confirm via the explicit scan first.

## Slice Start Ceremony — HARD RULE

Open every slice through the canonical start command **before** beginning acceptance-criteria work. Skipping it leaves `workflow-state.json.currentRun` pinned to the previous slice (or a stale "verification" run), so the close ceremony's cost auto-emit attributes the new slice's spend to the wrong window.

Run, in order:

1. **Identify the next slice.** If `docs/superpowers/plans/*.md` exists and has unchecked `## Task N: SLICE_NN — Title` headings, pick the first unchecked one. Otherwise fall back to Cross-Slice Continuation (scan `docs/specs/` → `docs/backlog/pending/` → `docs/backlog/triaged/`).
2. **`/loop:slice start --id SLICE-NN`** — this rotates `currentRun` via `crew write-run-brief`, seeds the goal from the slice file's `## Objective` block when present, and rewrites `.claude/state/crew/slice-progress.md`.
3. **Inspect the return.** Confirm `runBrief.artifactPath` (or `runBrief.runBriefPath`) is populated and `workflow-state.json.currentRun.title` equals `SLICE-NN: <title>`. If not, surface the error and stop — do not proceed with implementation against a stale run.
4. **Dispatch implementation via `/crew:build`.** The `slice start` return includes a `dispatchInstruction` — a literal prompt for a subagent. Hand it to a `crew:builder` (or generic `claude`) subagent. **Do not implement inline.** The loop's job is to pick slices, rotate state, and close them; the slice work itself runs through crew's `build.md` workflow (frame → implement → review → validate → synthesize) so it inherits the standard artifact protocol and gets its own bounded conversation context.
5. **Wait for the subagent's completion report.** It will tell you what shipped, what was reviewed, what was validated. Then run the Slice Close Ceremony (next section).

Exception: manual invocations may pass `--no-dispatch` (e.g., debugging the loop itself, or a tiny inline change you don't want to spawn a subagent for). The autonomous loop should never pass `--no-dispatch`.

## Dispatch Discipline — HARD RULE

The autonomous loop is an **orchestrator**, not an implementer. Every code-bearing unit of work runs through a crew subagent. Decision matrix:

| Situation | Dispatch |
|---|---|
| Slice implementation (acceptance criteria work) | `/crew:build` subagent |
| Bug found during slice (test fail, regression, integration error) | `/crew:fix` subagent |
| Independent code review pass | `/crew:review` subagent (or the configured reviewer ladder) |
| Behavior validation when something is runnable | `/crew:validate` subagent |
| Deployment / shipping a reviewed change | `/crew:ship` subagent |
| Trivial inline fixup (typo, fixture path, single-line patch) | Inline is fine — but log it in the run-brief |

Pivot triggers — any of these during a slice means **stop, dispatch `/crew:fix`, then resume**:

- A review_result with `status: needs_fix`
- A validation_result with `status: fail`
- A build/test failure that requires a root-cause hunt (not a one-line patch)

When in doubt, prefer dispatch. A subagent run produces its own artifact trail; an inline patch hides in the loop's conversation and loses cost/grade attribution.

## Build Entry Points

For one-glance visibility into all slices in the active plan: `cat .claude/state/crew/slice-progress.md`. The dashboard is rewritten by start + close ceremonies; trust it over manual inspection of slice files or commits.

## Build Entry Points

Two ways to start work in this repo. Pick one per session — do **not** mix.

- **`/crew:build` (interactive, single slice or scoped task).** Lead-driven, lighter ceremony. No `slice start` required; no run-brief mandatory. Use when the user is at the keyboard and wants a single focused change. The Slice Close Ceremony **still applies** if the change closes a slice, but the start ceremony is optional.
- **Autonomous loop (unattended, multi-slice).** Full ceremony required. Slice Start (run-brief + slice-progress) → Wiggin Loop → Slice Close (handoff + final-synthesis + cost auto-emit). Invoked via `/loop`, `ScheduleWakeup`, or `CronCreate`. Every slice must rotate `currentRun`.

Never run both simultaneously against the same branch — they will race on `workflow-state.json` and the second writer wins.

## Slice Close Ceremony — HARD RULE

When every acceptance criterion on the current slice is PASS with evidence, close the slice through the canonical ceremony **before** picking up the next slice. Manual file moves + a `docs(slice): mark SLICE_NN complete` commit are NOT a substitute — they bypass the artifact fan-out and leave `handoffs/`, `runs/`, `cost/`, and `cost-insights/` empty.

Run, in order:

1. **`/loop:slice complete --id SLICE-NN`** — atomically moves the slice file to `completed/`, moves the linked feature to `done/`, reconciles parent SPEC status, AND fans out three artifacts in parallel:
   - `.claude/artifacts/crew/handoffs/<timestamp>-slice-nn-complete.md`
   - `.claude/artifacts/crew/runs/<timestamp>-slice-nn-final-synthesis.md` (auto-emits `cost-report` → `.claude/artifacts/crew/cost/` and `cost-advise` → `.claude/artifacts/crew/cost-insights/`)
   - `cost-report` invoked via the hero-crew `cost-slice` CLI as a redundant safety net
2. **`/loop:slice grade --id SLICE-NN`** + **`/loop:slice grade-write --id SLICE-NN`** — capture scores, lessons, decisions. Skipping grading loses the self-improvement signal for this slice.
3. **Inspect the ceremony return** — verify `handoff.handoffPath`, `synthesis.synthesisPath`, and `costReport.usd` are all populated. If any returned `{ error: ... }`, surface the error and fix it before continuing; do not silently move on.
4. **Then** apply Cross-Slice Continuation to pick the next unit of work.

Expected artifact set per slice (all must exist before Cross-Slice Continuation):

- `reviews/` — written during the slice via `crew write-review-result`
- `validations/` — written during the slice via `crew write-validation-result` (per-slice runtime evidence, not just phase-gate)
- `runs/run-brief-*.md` — opened at slice start via `crew write-run-brief`
- `runs/final-synthesis-*.md` — emitted by the ceremony
- `handoffs/*.md` — emitted by the ceremony
- `cost/*-cost-report-*.md` + `cost-insights/*-cost-advise-*.md` — auto-emitted by the ceremony

If any of these is missing for a closed slice, the close is incomplete. Re-run the ceremony or invoke the missing `crew write-*` command directly before continuing.

## Phase Completion Gate — HARD RULE

When a phase of work completes (last slice in a phase marked COMPLETED in `approved-slices.md`), run the configured phase-gate suite by invoking `/loop:phase-gate`. The plugin executes every stage configured in `.claude/loop.json` (build, test, frontend build, infra plan, Aspire boot + healthchecks) via `execFile` — no shell interpretation, no injection surface — captures all output, and writes a single validation artifact under `.claude/artifacts/crew/validations/phase-<N>-gate-<date>.md` through `crew write-validation-result`. Do NOT proceed to the next phase if the gate returns FAIL. Do NOT hand-author the gate artifact; let the plugin own it for evidence quality.

## Worktree Parallelism — HARD RULE

Multiple features can be developed concurrently by running an autonomous loop in each git worktree. Each worktree is an isolated working directory with its own `.claude/state/crew/workflow-state.json` and `slice-progress.md` — no state races.

**Setup:**

1. Create one worktree per feature branch: `git worktree add ../repo-feat-a feat-a`.
2. Each worktree gets its own `.claude/loop.json` (copy or git-tracked per branch).
3. Run `/loop` independently in each worktree terminal pane or scheduled invocation.

**Cost attribution in parallel mode:**

`tryWriteCostReport` auto-detects the worktree topology at close time:
- Linked worktree (git-common-dir ≠ git-dir) **or** multiple worktrees present → passes `--source-project <worktree-slug>` so cost windows do not bleed between sibling loops.
- Single worktree → passes `--aggregate-all` to capture cross-repo session work.

No manual flag needed — detection is automatic.

**Fleet view:**

Run `node hero-crew/scripts/crew.mjs fleet --repo "$PWD"` from any worktree to see all sibling active loops, their current IN_PROGRESS slice, and progress counts. The command scans the parent directory for `.claude/state/crew/slice-progress.md` files; no coordination required.

**Constraints:**

- Each worktree must be on its own branch. Checking out the same branch in two worktrees is a git error.
- Never push from inside the autonomous loop. The user reviews + pushes per worktree; the only collision risk is two worktrees trying to push the same remote branch, which git will reject cleanly.
- Do not run both `/crew:build` (interactive) and autonomous loop simultaneously on the same worktree — they race on `workflow-state.json`.

## First Action — Starting the Loop

Read in this order, then pick the highest-priority PENDING slice:

1. `docs/ai-loop/00-entry/MASTER_PROMPT.md` — persona, stack, mandatory reading
2. `docs/ai-loop/backlog/approved-slices.md` — pick highest-priority PENDING slice
3. The slice file listed in `approved-slices.md` (under `docs/ai-loop/slices/`)
4. `docs/ai-loop/01-loop-control/WIGGIN_LOOP.md` — the loop sequence
5. `docs/ai-loop/01-loop-control/EVIDENCE_RULES.md` — how to mark PASS / PARTIAL / FAIL / BLOCKED
6. `docs/ai-loop/01-loop-control/STOP_CONDITIONS.md` — when the loop is allowed to stop

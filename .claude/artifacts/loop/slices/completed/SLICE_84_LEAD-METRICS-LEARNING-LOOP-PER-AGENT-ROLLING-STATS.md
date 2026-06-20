---
id: SLICE-84
title: FEAT-159 SLICE-A — Per-agent rolling stats aggregator + CLI (no lead integration)
status: completed
feature: FEAT-159
phase: null
priority: P2
target_release: null
requires_validation: true
risk: medium
autonomous_safe: true
developer_type: agent
estimated_complexity: medium
created: 2026-06-20
updated: 2026-06-20
depends_on: [FEAT-149, FEAT-150, FEAT-151]
touches_files: [scripts/lib/agent-stats-aggregator.ts, scripts/crew.ts, tests/agent-stats-aggregator.test.ts, tests/fixtures/agent-stats/dispatch-timing-seed.jsonl, tests/fixtures/agent-stats/grades-seed.jsonl, docs/observability/agent-stats.md]
touches_files_confidence: declared
file_line_budgets: null
completed_at: 2026-06-20
---
# SLICE-84 — FEAT-159 Part A: per-agent rolling stats aggregator + CLI

Implements the **aggregator layer** of FEAT-159 (per-agent rolling stats), bounded to pure additive work: a JSONL reader, a stats computer, an artifact writer, a CLI subcommand, and unit tests. Defers cost-report integration and lead-consumer wiring to follow-up slices so this SLICE stays `autonomous_safe: true` and avoids editing `agents/lead.md` (per CLAUDE.md governance: lead prompt edits are `autonomous_safe: false`).

## Objective

Build the read-only aggregation substrate for per-agent rolling stats over the existing Phase 1 telemetry (`dispatch-timing.jsonl`, `bash-gates.jsonl`, slice grade JSON, review/validation artifacts). Emit a versioned JSON artifact per run under `.claude/artifacts/crew/agent-stats/` and expose an ad-hoc lookup CLI. Lead consumption is intentionally NOT wired here — that's a follow-up `autonomous_safe: false` slice.

## In scope

### 1. New: `scripts/lib/agent-stats-aggregator.ts` (≤250 lines)

Pure-function module. No I/O at the top level — file reads happen inside named async functions so callers can stub fixtures. Exports:

- `type AgentStatsRow` — the per-agent record shape:
  ```ts
  {
    agent: string;
    window: string;              // e.g. "last_10_slices"
    sample_count: number;        // dispatches matched in window
    pass_rate: number;           // 0..1, dispatches whose slice graded >= 0.7 avg
    mean_wall_ms: number;
    mean_tokens: number;         // mean(tokenIn + tokenOut)
    review_rework_rate: number;  // 0..1, fraction with >= 1 review_needs_fix artifact
    validation_fail_rate: number;// 0..1, fraction with >= 1 validation_fail artifact
    median_dispatches_to_pass: number; // per-slice dispatch count to first PASS
  }
  ```
- `type WindowSpec` — `{ kind: "last_n_slices"; n: number }` (open enum so a future `last_n_days` is non-breaking).
- `async function aggregateAgentStats(opts: { repo: string; window: WindowSpec; agents?: string[] }): Promise<AgentStatsRow[]>` — main entry. Reads dispatch-timing.jsonl + grade artifacts from `.claude/artifacts/loop/grades/` + review/validation artifacts from `.claude/artifacts/crew/{reviews,validations}/`. Filters by slice window (last N slices by `graded_at` desc). Optional `agents` filter.
- `async function writeAgentStatsArtifact(repo: string, rows: AgentStatsRow[], window: WindowSpec): Promise<string>` — writes `<repo>/.claude/artifacts/crew/agent-stats/<ISO8601Z>-agent-stats-<window-slug>.json` and returns the path.

Reuse the existing `DispatchRow` type + reader pattern from `scripts/lib/dispatch-timing-reader.ts` — do NOT re-implement the JSONL parser. Import + call.

### 2. Edit: `scripts/crew.ts` — add `agent-stats` subcommand (≤80 lines added)

```
node scripts/crew.ts agent-stats [--agent <name>] [--window last_n_slices:<N>] [--repo <path>]
```

Defaults:
- `--window` → `last_n_slices:${process.env.CREW_AGENT_STATS_WINDOW ?? '10'}`
- `--repo` → `process.cwd()`
- `--agent` absent → all agents present in window

Output: pretty table to stdout + always-writes the artifact file (so the CLI doubles as the "generate this artifact" command for CI / loop ceremony).

### 3. New: tests `tests/agent-stats-aggregator.test.ts` (≤300 lines)

Seeded JSONL + grade fixtures under `tests/fixtures/agent-stats/`. Cases:

- AC-T1: 3 agents × 5 dispatches each, window `last_5_slices`, validates pass_rate / mean_wall_ms / mean_tokens / sample_count.
- AC-T2: window narrows result set — same fixtures, window `last_2_slices` returns only the most-recent 2 slices' agents.
- AC-T3: `review_rework_rate` — fixture with a slice whose review artifact has `decision: needs_fix` counts as rework for the agent who built that slice.
- AC-T4: `validation_fail_rate` — analogous, validation artifact `decision: fail`.
- AC-T5: `median_dispatches_to_pass` — fixture with a slice that took 3 dispatches before review/validation PASS reports 3 for the agent.
- AC-T6: empty window (no slices match) → returns empty array + writes artifact with `rows: []`.
- AC-T7: `--agent` filter trims the returned + written set to that agent only.

Use `node:test` + `node:assert/strict` (matches existing telemetry test style — see `tests/telemetry-otel-bridge.test.ts`). Bun-runnable.

### 4. New: `docs/observability/agent-stats.md` (≤120 lines)

Describes:
- Artifact shape + window semantics.
- CLI invocation + defaults + `CREW_AGENT_STATS_WINDOW` env.
- Source JSONL files + how to seed local fixtures.
- Explicit "lead does NOT yet read this" note pointing at follow-up slice.

## Out of scope (deferred to follow-up slices)

- **Cost-report writer integration** — appending an agent-stats summary section to the per-slice cost report. Touches `scripts/lib/cost-report-*.ts` and is a behavior change to existing artifact shape. Separate slice with reviewer attention to backwards-compat of grade-loader.
- **Lead consumption at slice-start (Step 3 model/agent picking)** — edits `agents/lead.md`. `autonomous_safe: false` per CLAUDE.md governance. Separate slice gated on human-in-loop review.
- **`last_n_days` window** — schema reserves the slot but only `last_n_slices` is implemented here.
- **Cross-window deltas / regression detection** — flagging "agent X got slower than its own baseline". Useful but out of scope for the first cut.

## Acceptance criteria

- [ ] AC-1: `bun run typecheck` clean. `bun run lint scripts/lib/agent-stats-aggregator.ts scripts/crew.ts` zero warnings.
- [ ] AC-2: `bun test tests/agent-stats-aggregator.test.ts` — all 7 cases (AC-T1..T7) PASS.
- [ ] AC-3: `node scripts/crew.ts agent-stats --window last_n_slices:10 --repo "$PWD"` produces stdout table + writes `.claude/artifacts/crew/agent-stats/<ISO>-agent-stats-last_n_slices_10.json` with the documented shape. Verified by hand-running against this repo's current artifacts and inspecting the JSON.
- [ ] AC-4: `agent-stats-aggregator.ts` ≤ 250 LOC; `tests/agent-stats-aggregator.test.ts` ≤ 300 LOC; `scripts/crew.ts` net add ≤ 80 LOC. Validated via `wc -l`.
- [ ] AC-5: No edits to `agents/lead.md`, `scripts/lib/cost-report-*.ts`, or any file outside `touches_files` frontmatter. Validated via `git diff --stat` at handoff.
- [ ] AC-6: Empty/missing JSONL sources do NOT throw — they return empty stats. Verified via AC-T6 + a "nuked telemetry dir" manual smoke (rename `.claude/artifacts/loop/grades/` to a sibling temporarily, run CLI, expect empty table + empty-rows JSON).
- [ ] AC-7: `docs/observability/agent-stats.md` exists with the four documented sections (shape, CLI, sources, lead-not-wired note).

## Done When

- all acceptance criteria PASS with evidence
- `bun run test` overall (full suite) does not regress (baseline already has ~21 pre-existing failures unrelated; this slice must not add new ones)
- feature `FEAT-159` stays in `in-progress/` until the follow-up slice(s) close (parent FEAT covers 3 deliverables, this slice closes 1 — the aggregator. Update `FEAT-159` frontmatter `partial_progress` field on slice close; do NOT move FEAT to `done/`)
- Crew `final-synthesis` artifact written
- slice file moved from `slices/pending/` to `slices/completed/`

## Reviewer ladder

- Reviewer A: `crew:inspector` — correctness/regression lens, especially around aggregator math (pass_rate denominator handling when window has zero qualifying slices; median calculation with even-count arrays; rate when sample_count = 0).
- Reviewer B: `crew:3rdparty:typescript-reviewer` — TypeScript/Zod boundary lens, especially around the open `WindowSpec` discriminated union and the `AgentStatsRow` exported contract (this becomes the cost-report / lead consumer interface in follow-up slices, so stability matters).
- Validator: `crew:verifier` — runs AC-3 (CLI smoke) + AC-6 (nuked telemetry smoke) and produces the validation artifact.

---
id: SLICE-19
status: completed
feature: FEAT-101
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-19: # FEAT-101 — Perf win 1: tail-read events.jsonl

Implements FEAT-101. See [feature file](../../../backlog/in-progress/FEAT-101.md) for product context.

## Objective

`brief-me` and the cost scanner read all of `.claude/logs/events.jsonl` (~860 KB, 3.4k lines on this repo today) to surface the last few `session_start` events. Reverse-reading the last ~64 KB is enough to find the latest few events in practice. Estimated saving: 200–400 ms cold / 50–100 ms warm per `brief-me`.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: A `tailReadJsonl(filePath, options)` helper exists (under `scripts/lib/`) that reads the last N bytes (configurable, default 64 KB), discards the truncated first line, and yields parsed objects.
- [ ] AC-2: Callers in `scripts/lib/briefing/collect.mjs` and `scripts/lib/session-cost-scanner.mjs` that previously full-read events.jsonl to extract recent `session_start` events now use the new helper.
- [ ] AC-3: ≥3 unit tests cover: (a) happy path with multi-line tail, (b) tail boundary discards partial leading line, (c) file smaller than tail-window reads in full.
- [ ] AC-4: `brief-me` output is byte-identical to pre-change baseline for a fixture repo (regression test).
- [ ] AC-5: PR body includes `time` measurement comparison: 5 baseline runs vs 5 post-change runs, p50 + p95 deltas reported.
- [ ] AC-6: All existing CI gates green.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-101 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...

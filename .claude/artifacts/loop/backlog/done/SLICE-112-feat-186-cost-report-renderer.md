---
id: SLICE-112
parent: FEAT-186
status: done
priority: P2
created: 2026-07-01
title: "FEAT-186 S3 — per-slice cost report renderer unified (with backward-compat)"
stack: typescript
autonomous_safe: false
est_days: 2
depends_on: [SLICE-110]
touches_files:
  - scripts/lib/cost/cost-report-renderer.ts
  - scripts/lib/cost/cost-report-renderer.test.ts
  - tests/fixtures/cost-reports/dual-pipeline.json
  - tests/fixtures/cost-reports/legacy-eval-only.json
  - tests/fixtures/cost-reports/legacy-gepa-only.json
---

# SLICE-112: FEAT-186 S3 — cost report renderer unification

## Source

FEAT-186 `proposed_slices` S3 (2026-06-29 pm-decompose). Materialized 2026-07-01 for parallel dispatch with SLICE-111 after SLICE-110 publishes.

## Scope

Update `.claude/artifacts/crew/cost/<slice>.md` renderer to emit unified table:

- **Rows**: `(pipeline, provider)` tuples
- **Columns**: `usd`, `latency_ms`, `tokens`, `cache`
- **Bottom**: totals row

Backward-compat: existing eval-only and gepa-only reports written under old shape continue to render in brief-me without crash (degenerate case = single-row table). **No migration script.**

Fixture-driven snapshot test covers 4 cases:
1. Dual-pipeline slice
2. Eval-only slice (legacy shape)
3. Gepa-only slice (legacy shape)
4. Pre-186 mixed legacy fixture

## Acceptance criteria

**AC-1 (unified table shape):** `renderCostReport(entries: CostEntry[])` produces markdown table with `(pipeline, provider)` rows and `usd/latency_ms/tokens/cache` columns. Totals row at bottom sums `usd` and `latency_ms`; `tokens` and `cache` totals are `-` if any row is missing them.

**AC-2 (single-row degenerate case):** Report with 1 entry (eval-only OR gepa-only) renders a valid single-row table with totals row still present. No crash. No `undefined` cells.

**AC-3 (backward-compat pre-186 fixtures):** Fixtures pulled from **real** pre-186 on-disk artifacts under `.claude/artifacts/crew/cost/` (NOT synthetic). At least 2 legacy fixtures — one eval-only, one gepa-only — render without crash. Snapshot test asserts identical output pre/post rendered shape.

**AC-4 (Windows LF fixture pin):** Snapshot fixtures locked to LF via `.gitattributes` `tests/fixtures/cost-reports/** text=lf`. Test asserts fixture line endings pre-read to prevent silent CRLF snapshot drift.

**AC-5 (Biome + typecheck green):** `bun run lint` zero warnings, `bun run typecheck` clean.

**AC-6 (SLICE-110 dependency):** Renderer consumes `JudgeCost` type from `@astragenie/gepa-core`. Import chain green; `bun run test` passes.

## Risks

- **Backward-compat trap (AC-3)**: Fixtures MUST come from real pre-186 artifacts. Synthetic shapes risk drifting from actual on-disk schema. Mitigation: builder MUST `cp .claude/artifacts/crew/cost/<real-old-slice>.md.json → tests/fixtures/cost-reports/legacy-*.json` and freeze — not hand-write.
- **CRLF/LF snapshot flip**: Windows contributors clone with CRLF unless `.gitattributes` pins fixtures LF. Mitigation: AC-4 gitattributes pin + fixture pre-read assertion. See memory `biome-cognitive-complexity-threshold` for related Windows/Biome trap during recent gepa-core LF-pin session.
- **Renderer complexity**: unified table with degenerate cases may push cognitive-complexity over the 15 threshold. Mitigation: extract row-builder + totals-builder into named helpers (biome.json threshold = 15 per memory `biome-cognitive-complexity-threshold`).

## Out of scope (deferred)

- brief-me reader — S4 (SLICE-113).
- Asymmetry heuristic + Langfuse emission — S5 (SLICE-114).
- Migration script for pre-186 reports — explicitly NOT required per AC-3 (render-tolerant, no rewrite).
- dailyCapMeter wiring — SLICE-111.

## Dispatch notes

- Autonomous_safe=false: cross-plugin type consumption + renderer contract change. Human review at handoff.
- Single-repo (dev-team only) — unlike SLICE-111 which spans gepa-core + dev-team.
- Parallel with SLICE-111: no file overlap. Sibling worktrees safe.

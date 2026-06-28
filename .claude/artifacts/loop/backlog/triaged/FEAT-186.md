---
id: FEAT-186
status: triaged
priority: P2
category: capability
target_release: null
created: 2026-06-28
depends_on: [FEAT-184, FEAT-185]
slices: []
derived_from: null
pm_customer_impact: 0.70
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.70
pm_technical_risk: 0.55
pm_dependency_depth: 0.75
composite_score: 0.55
autonomous_safe: false
tags: [evals, gepa, cost-accounting, telemetry, contract]
triage_notes: "Triaged 2026-06-28 — spun out of FEAT-185 AC-7 per architect-reviewer (2026-06-28) because cost-aggregation is a CONTRACT DECISION not a refactor side-task. Keeping it in 185 made the snapshot-diff gate (185 AC-4) hard to interpret because two variables (provider location + cost shape) would change at once; splitting isolates the variable. Production-safety motivation (NOT hygiene): FEAT body Option 3 rejection quoted — dailyCapMeter in gepa-core (design spec line 326-333) enforces budget caps, but without a unified shape the meter sees one pipeline's costs but not the other → budget overruns become silent. Cost analog: FEAT-159 SLICE-85 ($51) for single observability append × 3-4 surfaces (dailyCapMeter, per-slice cost report renderer, brief-me, Langfuse) → effort 0.55 (pure contract definition + dual-pipeline wiring, no transport-layer changes). No grade weak dimensions (5-grade rolling avg: arch 0.86 / reliability 0.88 / observability 0.83 / prod-readiness 0.86 / security 0.86 / test-conf 0.92 / product-completeness 0.81; all >= 0.80). Composite 0.55 → P2: customer 0.70 (production-safety budget-overrun gap, stronger than typical cleanup FEAT), strategic 0.70 (cross-cuts evals + GEPA but resolves real production-safety gap), effort 0.55 (3-4 surfaces wiring, mid-band), risk 0.55 (new exported type to gepa-core = additive/MINOR, but cross-plugin contract pulls band edge), dependency_depth 0.75 (HARD chain dep on FEAT-184 AND FEAT-185 — longest blocker chain in the trio). autonomous_safe=false confirmed — adds new exported type to gepa-core (JudgeCost) = cross-plugin contract change; human-in-loop on review per CLAUDE.md autonomous-loop-hard-rules + cross-plugin contract policy. DEPENDENCY ORDERING SURFACE (raised inline per operator instruction 4): operator task tracker (#11/#12/#13) only schedules build phases for FEAT-184 + FEAT-185 — there is no Phase 7 for FEAT-186. If 186 is silently dropped, SLICE-98 ships against the dual cost-shape problem that 186 was specifically spun out of 185 to address. Recommend dispatcher add Phase 7 = build FEAT-186 task before SLICE-98 starts. Decomposition (proposed_slices block) DEFERRED per operator instruction (dispatcher will slice after triage lands). Pre-mortem (not strictly mandatory per rubric — risk 0.55 < 0.6 AND priority P2 — but key risk surfaced): dailyCapMeter integration scope is bigger than this FEAT can absorb (FEAT body itself acknowledges this); spec line 326-333 describes BudgetMeter with TTL + reserve/record/release; AC scope is cost-ingestion only, full meter integration deferred to sibling FEAT once gepa-core S5 (budget) lands."
---

# FEAT-186: Unified cost-aggregation contract across evals + gepa pipelines

## Description

After FEAT-184 (judge interface unification) and FEAT-185 (provider relocation), both pipelines emit cost data through the same `LLMJudge.evaluate()` result shape (`cost_usd`, `latency_ms`, `tokens?: { in, out }`). But the cost *aggregation* is still split:

- **evals pipeline** (`evals/cli.ts`): aggregates per-spec totals, emits to `.claude/artifacts/crew/evals/<spec>/<run-id>.json` + Langfuse traces (FEAT-169 SLICE-90).
- **gepa pipeline** (`@astragenie/gepa-core`): emits per-trial `score.cost_usd` into `.claude/artifacts/crew/gepa/trials/<agent>.jsonl` via FEAT-183 SLICE-97 capture tee. No aggregation layer.

When `/crew:gepa-eval` (SLICE-98) ships, both pipelines will pay for judge calls and both will need to surface cost back to:

1. Per-slice cost reports (`.claude/artifacts/crew/cost/<slice>.md`) — current location of cost telemetry per `CLAUDE.md` v0.2.0 baseline addendum.
2. `brief-me` cost tables — surfaced via cost reports.
3. Daily-cap budget enforcement (`dailyCapMeter` in gepa-core, design spec line 326-333).
4. Cross-pipeline cost-asymmetry detection (if eval-judge cost is 10× gepa-judge cost, that's a config bug worth surfacing).

FEAT-186 defines the cross-package cost shape, the aggregation contract, and the surfacing path so neither pipeline silently double-counts or drops cost data.

## Why split from FEAT-185

Per architect-reviewer FEAT-185 finding: cost-aggregation across pipelines is a **contract decision**, not a refactor side-task. Keeping it in FEAT-185 made the snapshot-diff gate (FEAT-185 AC-4) hard to interpret because two variables (provider location + cost shape) would change at once. Splitting isolates the variable.

## Options Considered

### Option 1 (chosen): Single cost shape in gepa-core, evals/ adopts via shim

Define `JudgeCost` in gepa-core with the canonical fields (`usd: number`, `latency_ms: number`, `tokens?: { in, out }`, `cache?: { hit: boolean; tokens_saved?: number }`). Both pipelines emit through this shape. dev-team `evals/cli.ts` aggregation reads from `LLMJudge.evaluate()` result directly; gepa pipeline reads from `Trial.score`.

**Why chosen:** single source of truth, no translation, both pipelines naturally converge as the unified `LLMJudge` adoption (FEAT-184) lands.

### Option 2 (rejected): Per-pipeline cost shape, aggregator translates

Keep two cost shapes (evals nested `providerCost`, gepa flat `cost_usd`); a third aggregation layer translates between them for cross-pipeline reports.

**Why rejected:** reinvents the dual-interface problem FEAT-184 is supposed to fix, but for cost shape. Adds a translation layer that becomes load-bearing for budget enforcement.

### Option 3 (rejected): Defer entirely until cross-pipeline cost-asymmetry actually surfaces as a bug

Wait for the first dropped/double-counted cost incident, then fix.

**Why rejected:** `dailyCapMeter` in gepa-core (design spec line 326-333) enforces budget caps. Without a unified shape, the meter sees one pipeline's costs but not the other — budget overruns become silent. Production-safety concern, not just hygiene.

## Acceptance criteria

- **AC-1 (canonical shape):** `@astragenie/gepa-core` exports `JudgeCost`:
  ```ts
  interface JudgeCost {
    usd: number;
    latency_ms: number;
    tokens?: { in: number; out: number };
    cache?: { hit: boolean; tokens_saved?: number };
  }
  ```
  Shape consumed by `LLMJudge.evaluate()` result, `Trial.score`, `dailyCapMeter.reserve()/record()`, and `evals/cli.ts` per-spec aggregation.
- **AC-2 (`dailyCapMeter` consumes both pipelines):** `dailyCapMeter.record()` accepts cost from either pipeline. Same daily cap applies. Budget overrun on one pipeline blocks the other for the rest of the day. Test: configure $1/day cap; spend $0.60 in evals + $0.50 in gepa = blocked on the next call.
- **AC-3 (per-slice cost report unification):** `.claude/artifacts/crew/cost/<slice>.md` renders a unified cost table with rows per pipeline (eval / gepa) and per provider, totals at the bottom. Existing eval-only and gepa-only reports continue working as degenerate cases.
- **AC-4 (`brief-me` integration):** `brief-me` cost table reads unified shape; no per-pipeline column doubling. Aggregation matches per-slice report totals to the cent.
- **AC-5 (cross-pipeline asymmetry detection):** If per-slice gepa-judge cost is >10× eval-judge cost (or vice versa), surface a warning in the slice cost report. Heuristic only — no auto-fail. Detects misconfiguration like accidentally pointing gepa at a paid judge when ollama was intended.
- **AC-6 (backward-compat for in-flight pre-FEAT-186 reports):** Reports written under the old shape continue to render in `brief-me` (no crash, no data loss). Migration script optional, not required.
- **AC-7 (Langfuse emission):** Both pipelines emit cost through the same Langfuse trace shape (extends FEAT-169 SLICE-90). One trace = one cost data point regardless of which pipeline triggered.

## Out of scope (deferred)

- Multi-tenant cost attribution (per-user / per-repo budget) — separate FEAT if needed.
- Cost prediction / pre-flight budget estimation — separate FEAT.
- Historical cost rollups (weekly / monthly aggregation) — `loop:retrospective` skill handles this layer; no work needed here.

## Dependencies

- **FEAT-184** must land — without unified `LLMJudge` result shape, the cost-shape unification has nowhere to live.
- **FEAT-185** must land — without providers in gepa-core, half the cost data still lives in dev-team's evals/providers/* and the aggregation has two roots.

## Risks

- **Risk: gepa-core `dailyCapMeter` integration is bigger than the FEAT scope.** Spec line 326-333 describes BudgetMeter with TTL + reserve/record/release. This FEAT only adds cost ingestion; full meter integration may need a sibling FEAT once gepa-core S5 (budget) lands.
- **Risk: backward compat for old cost reports.** Mitigation: AC-6 explicit no-crash guarantee; migration script kept optional.
- **Risk: cross-pipeline asymmetry heuristic (AC-5) noisy.** Mitigation: threshold is conservative (10×, not 2×); warning not auto-fail; tune after ≥5 weeks of real data.

## Origin

Spun out of FEAT-185 AC-7 per architect-reviewer feedback (2026-06-28). Original AC-7 wording: "Cost-aggregation works across both pipelines — a single `providerCost` shape feeds both `evals/cli.ts` output and gepa-core `Trial.score.cost_usd`." Promoted to standalone FEAT because (a) it's a contract decision not a refactor, (b) snapshot-diff gate in FEAT-185 needs to isolate one variable at a time, (c) `dailyCapMeter` interaction is production-safety not hygiene.

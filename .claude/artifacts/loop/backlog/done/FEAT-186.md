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
proposed_slices:
  - id: SLICE-NN
    title: "FEAT-186 S1 — gepa-core exports JudgeCost canonical shape (MINOR bump)"
    scope: "Define and export `JudgeCost` interface from @astragenie/gepa-core (usd, latency_ms, optional tokens, optional cache). Wire shape into LLMJudge.evaluate() return type and Trial.score typing (no behavior change — pure type widening over what FEAT-184 already returns). Cut gepa-core MINOR release (additive). Add contract test asserting JudgeCost is in the public export surface."
    acs_covered: [AC-1]
    touches: ["packages/gepa-core/src/judge.ts", "packages/gepa-core/src/types/cost.ts", "packages/gepa-core/src/index.ts", "packages/gepa-core/test/judge-cost-shape.test.ts", "packages/gepa-core/CHANGELOG.md", "packages/gepa-core/package.json"]
    est_days: 1
    depends_on: [FEAT-184, FEAT-185]
    autonomous_safe: false
    risk_notes: "Cross-plugin publish ceremony (gepa-core MINOR). Hard gate for every other 186 slice — must publish first. Tokens shape (in/out optional) MUST stay optional to avoid retroactive MAJOR on existing LLMJudge consumers. Verify cache?:{hit, tokens_saved} stays optional too — providers without prompt-cache reporting (groq, ollama) shouldn't be forced to fabricate the field."

  - id: SLICE-NN
    title: "FEAT-186 S2 — dailyCapMeter ingests JudgeCost from both pipelines"
    scope: "Update gepa-core `dailyCapMeter.record(cost: JudgeCost)` to accept the canonical shape from both evals-pipeline and gepa-pipeline emission points. Cost INGESTION only — TTL/reserve/release flow stays deferred to sibling FEAT (spec line 326-333, FEAT body §Risks). Test: configure $1/day cap; spend $0.60 via evals/cli.ts judge call + $0.50 via gepa Trial → third call blocked. No new exports beyond what S1 published."
    acs_covered: [AC-2]
    touches: ["packages/gepa-core/src/budget/daily-cap-meter.ts", "packages/gepa-core/test/daily-cap-cross-pipeline.test.ts", "evals/lib/judge.ts", "evals/cli.ts"]
    est_days: 2
    depends_on: ["FEAT-186 S1"]
    autonomous_safe: false
    risk_notes: "Touches both packages — dev-team evals/cli.ts must import dailyCapMeter from gepa-core and call .record() after each judge evaluation; gepa pipeline already has the hook from FEAT-183 SLICE-97 capture tee. Risk: double-counting if SLICE-97 capture tee ALSO records (it currently only logs cost into JSONL, not into the meter — verify before wiring). Risk: dailyCapMeter is currently in-memory; pipeline-crossing requires same process — out-of-process daily caps stay deferred."

  - id: SLICE-NN
    title: "FEAT-186 S3 — per-slice cost report renderer unified (with backward-compat)"
    scope: "Update `.claude/artifacts/crew/cost/<slice>.md` renderer to emit unified table: rows = (pipeline, provider) tuples, columns = usd / latency_ms / tokens / cache, totals row at bottom. Backward-compat: existing eval-only and gepa-only reports written under old shape continue to render in brief-me without crash (degenerate case = single-row table). No migration script. Add fixture-driven snapshot test covering: dual-pipeline slice, eval-only slice, gepa-only slice, pre-186 legacy shape."
    acs_covered: [AC-3, AC-6]
    touches: ["scripts/lib/cost/cost-report-renderer.ts", "scripts/lib/cost/cost-report-renderer.test.ts", "tests/fixtures/cost-reports/dual-pipeline.json", "tests/fixtures/cost-reports/legacy-eval-only.json", "tests/fixtures/cost-reports/legacy-gepa-only.json"]
    est_days: 2
    depends_on: ["FEAT-186 S1"]
    autonomous_safe: false
    risk_notes: "AC-6 backward-compat is the trap — fixture coverage MUST include real artifacts pulled from .claude/artifacts/crew/cost/ pre-186 era; synthetic shapes risk drifting from the actual on-disk schema. Pre-mortem: snapshot test could green on Linux while failing on Windows line-endings; lock to LF in fixtures."

  - id: SLICE-NN
    title: "FEAT-186 S4 — brief-me cost-table reader consumes unified shape"
    scope: "Update brief-me cost aggregator to read unified per-slice cost reports (S3 output). Drop any per-pipeline column doubling. Assertion test: brief-me aggregated total equals sum of per-slice report totals to the cent across a fixture set of 3+ slices spanning eval-only / gepa-only / dual-pipeline. No UI changes beyond removing duplicate columns."
    acs_covered: [AC-4]
    touches: ["scripts/lib/brief-me/cost-aggregator.ts", "scripts/lib/brief-me/cost-aggregator.test.ts", "tests/fixtures/brief-me/multi-slice-cost-corpus/"]
    est_days: 1
    depends_on: ["FEAT-186 S3"]
    autonomous_safe: false
    risk_notes: "Cent-precision assertion is non-trivial across floating-point USD totals — must round consistently (banker's rounding to 4 decimal places before sum, then 2 for display, per FEAT-159 SLICE-85 convention if applicable). Verify brief-me currently reads from cost report files (not from a stale cached aggregate) before assuming this is a pure swap."

  - id: SLICE-NN
    title: "FEAT-186 S5 — asymmetry heuristic + Langfuse single-trace emission"
    scope: "Add (a) cross-pipeline asymmetry warning surfaced in slice cost report when one pipeline's judge-cost is >10x the other's for the same slice — warning text only, no auto-fail, no exit-code change; (b) Langfuse trace emission extending FEAT-169 SLICE-90 shape so one judge evaluation = one trace regardless of pipeline. Both consume the unified JudgeCost shape from S1; both emit via existing transport (no new transport dependencies). Tests: asymmetry fixture (gepa=$0.50, eval=$0.04 → warning); symmetric fixture (gepa=$0.10, eval=$0.08 → no warning); Langfuse emission verifies single trace_id per evaluate() call across both pipelines."
    acs_covered: [AC-5, AC-7]
    touches: ["scripts/lib/cost/asymmetry-detector.ts", "scripts/lib/cost/asymmetry-detector.test.ts", "evals/lib/langfuse-emitter.ts", "packages/gepa-core/src/observability/langfuse-trace.ts", "tests/fixtures/cost-asymmetry/"]
    est_days: 2
    depends_on: ["FEAT-186 S3"]
    autonomous_safe: false
    risk_notes: "AC-5 heuristic noise risk acknowledged in FEAT §Risks — 10x threshold is conservative but unmeasured against real corpora; ship as warning-only (no exit-code), revisit after >=5 weeks of real data. AC-7 risk: Langfuse SDK version drift between evals (currently FEAT-169) and gepa-core (S5 emission) could cause divergent trace shapes — pin Langfuse SDK to same version in both packages or share through gepa-core peer dep."
triage_notes: "Triaged 2026-06-28 — spun out of FEAT-185 AC-7 per architect-reviewer (2026-06-28) because cost-aggregation is a CONTRACT DECISION not a refactor side-task. Keeping it in 185 made the snapshot-diff gate (185 AC-4) hard to interpret because two variables (provider location + cost shape) would change at once; splitting isolates the variable. Production-safety motivation (NOT hygiene): FEAT body Option 3 rejection quoted — dailyCapMeter in gepa-core (design spec line 326-333) enforces budget caps, but without a unified shape the meter sees one pipeline's costs but not the other → budget overruns become silent. Cost analog: FEAT-159 SLICE-85 ($51) for single observability append × 3-4 surfaces (dailyCapMeter, per-slice cost report renderer, brief-me, Langfuse) → effort 0.55 (pure contract definition + dual-pipeline wiring, no transport-layer changes). No grade weak dimensions (5-grade rolling avg: arch 0.86 / reliability 0.88 / observability 0.83 / prod-readiness 0.86 / security 0.86 / test-conf 0.92 / product-completeness 0.81; all >= 0.80). Composite 0.55 → P2: customer 0.70 (production-safety budget-overrun gap, stronger than typical cleanup FEAT), strategic 0.70 (cross-cuts evals + GEPA but resolves real production-safety gap), effort 0.55 (3-4 surfaces wiring, mid-band), risk 0.55 (new exported type to gepa-core = additive/MINOR, but cross-plugin contract pulls band edge), dependency_depth 0.75 (HARD chain dep on FEAT-184 AND FEAT-185 — longest blocker chain in the trio). autonomous_safe=false confirmed — adds new exported type to gepa-core (JudgeCost) = cross-plugin contract change; human-in-loop on review per CLAUDE.md autonomous-loop-hard-rules + cross-plugin contract policy. DEPENDENCY ORDERING SURFACE (raised inline per operator instruction 4): operator task tracker (#11/#12/#13) only schedules build phases for FEAT-184 + FEAT-185 — there is no Phase 7 for FEAT-186. If 186 is silently dropped, SLICE-98 ships against the dual cost-shape problem that 186 was specifically spun out of 185 to address. Recommend dispatcher add Phase 7 = build FEAT-186 task before SLICE-98 starts. Decomposition (proposed_slices block) DEFERRED per operator instruction (dispatcher will slice after triage lands). Pre-mortem (not strictly mandatory per rubric — risk 0.55 < 0.6 AND priority P2 — but key risk surfaced): dailyCapMeter integration scope is bigger than this FEAT can absorb (FEAT body itself acknowledges this); spec line 326-333 describes BudgetMeter with TTL + reserve/record/release; AC scope is cost-ingestion only, full meter integration deferred to sibling FEAT once gepa-core S5 (budget) lands.\n\n--- Decomposed 2026-06-29 (pm-decompose dispatch) ---\nSlicing rationale (one-variable-per-slice, recursive application of the FEAT-185→FEAT-186 split logic):\n- S1 isolates the variable that gates everything: the new `JudgeCost` export from gepa-core. Cross-plugin publish ceremony lives alone; the MINOR bump is reverse-incompatible to amend, so it ships clean before any consumer wires it.\n- S2 isolates cost INGESTION on dailyCapMeter (AC-2 only) — explicitly NOT the full TTL/reserve/release flow per FEAT body §Risks, which is deferred to a sibling FEAT once gepa-core S5 (budget) lands. Risk: SLICE-97 capture tee may already record cost into JSONL; verify it does NOT double-record into the meter (current evidence: it only writes JSONL, but a builder MUST re-verify before wiring).\n- S3 clusters AC-3 + AC-6 because the renderer change and the backward-compat degenerate-case live in the same code path; splitting would force a temporary broken intermediate state. Backward-compat fixtures pulled from real pre-186 on-disk artifacts (not synthetic).\n- S4 isolates the downstream consumer (brief-me reader) so the renderer change in S3 can be observed in isolation before brief-me adopts.\n- S5 clusters AC-5 + AC-7 as cross-cutting EMITTERS layered on the unified shape — they consume but do not define. Both depend on S3's renderer landing (asymmetry detector needs the unified totals; Langfuse emission needs the canonical shape established but not the brief-me change).\n\nSlice-level pre-mortem additions (extending the FEAT-level pre-mortem):\n- S1 likely failure: tokens?:{in,out} optionality slips on one provider's mock test, retroactively forcing MAJOR. Mitigation: contract test asserts `tokens` is `?` not required across all 7 adapter mocks; ship gepa-core S1 ONLY after FEAT-185 lands so all 6 cloud providers are in the same repo and can be tested together against the new shape.\n- S2 likely failure: double-count if SLICE-97 capture tee silently already records into meter. Mitigation: builder MUST grep `dailyCapMeter.record` in gepa-core before wiring; add idempotency assertion.\n- S3 likely failure: Windows CRLF vs LF in markdown snapshot fixtures. Mitigation: .gitattributes `* text=lf` for fixtures/ and explicit assertion in test.\n- S4 likely failure: brief-me reads from a cached aggregate, not from cost files directly. Mitigation: trace the read path before swapping.\n- S5 likely failure: 10x asymmetry threshold trips on fixtures with tiny denominators ($0.001 vs $0.012 = 12x but absolute delta is irrelevant). Mitigation: add absolute-floor of $0.10 to the heuristic — below that, suppress warning.\n\nFirst slice to open after FEAT-184 SLICE-107 + FEAT-185 ship: S1 (canonical JudgeCost export). S1 is the only slice that can run before FEAT-185 fully lands IF FEAT-185 is split into S-A (ollama+generic+groq+gemini) and S-B (azure+bedrock) and at least S-A is in. Safer waiting for full FEAT-185 close so all 6 provider mocks are testable against the new shape simultaneously."
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

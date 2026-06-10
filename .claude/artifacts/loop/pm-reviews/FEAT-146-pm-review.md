---
id: FEAT-146
reviewed_at: 2026-06-10
via: pm
priority: P2
autonomous_safe: true
composite_score: 0.675
scores:
  customer_impact: 0.8
  effort_estimate: 0.55
  strategic_alignment: 0.65
  technical_risk: 0.35
  dependency_depth: 0.1
---
# PM Review — FEAT-146: Hook-core extraction (in-process testable hooks)

## Verdict

**P2 / autonomous_safe: true** — composite 0.675

## Scoring rationale

| Dimension | Score | Evidence |
|---|---|---|
| customer_impact | 0.8 | Largest remaining suite wall-clock lever post-WS1: ~120 spawn tests @ 0.3–0.6s on Windows (plan Tasks 5–9). Also unlocks function-level hook tests as the default. |
| effort_estimate | 0.55 | 4 hooks × (extract core + convert spawn tests) + integration; ~2–3 sessions per plan granularity. |
| strategic_alignment | 0.65 | Test-suite speed + maintainability; durable win (new hook behavior gets unit tests). |
| technical_risk | 0.35 | Bounded to hooks subsystem; byte-identical stdout/exit contract; guarded by smoke + fully-spawn-based feature-gating suite. |
| dependency_depth | 0.1 | Independent; no `depends_on`. |

## Scope challenge

Each hook flow → `hooks/lib/<name>.ts` exporting `run<Name>Hook(raw, env) -> Promise<string|null>`; entry files become thin shims. Keep 1–2 spawn smokes per hook + the spawn-based gating suite as the runtime-contract proof. Bonus: removes a mid-flow `process.exit(0)` from record-read-content (repo rule 6).

## Risk radar

- Shim stdout/exit must stay byte-identical — keep smoke tests spawn-based.
- `process.exit(0)` must move to the shim, never the lib (rule 6); a lint check on `hooks/lib/` would enforce.
- In-process fs tests must isolate per-test cwd/temp (mkdtemp) or parallel runs collide.
- **autonomous_safe: true** — pure behavior-preserving source refactor, no agent/skill/command prompt edits.

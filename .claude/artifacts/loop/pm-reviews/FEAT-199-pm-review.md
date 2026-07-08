---
id: PM-REVIEW-FEAT-199
feature: FEAT-199
reviewed_at: 2026-07-08
pm_customer_impact: 0.75
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.75
pm_technical_risk: 0.65
pm_dependency_depth: 0.2
composite_priority: P1
autonomous_safe: false
---
# PM Review — FEAT-199

## Demand Assessment

- **Evidence:** FEAT body + loop-snapshot.md directly confirm: last-5-grade averages are ALL below 0.80 (architecture_quality 0.528, reliability 0.526, observability 0.496, production_readiness 0.516, security 0.516, test_confidence 0.548, product_completeness 0.48) -- the exact 'poisons every downstream loop decision' claim. Personally verified via `bun ../runner-plugin/src/scripts/loop.mts lessons recent 5`: SLICE-94 and SLICE-95 grades both show `avg_score: 0`, empty lessons arrays, and literal placeholder text `bullet` in surprises/followups -- direct, first-hand confirmation of the all-zero/placeholder pattern this FEAT targets.

## Scope Challenge

- **Scope notes:** Smallest deliverable: extend the existing scripts/validate-syntheses.ts (107 lines, read on disk) placeholder-detection pattern to grade files, wire as a HARD CI step, and do the one-time backfill sweep. Cut-to-half: ship the CI gate first (stops new rot) and defer the historical backfill to a follow-up slice if forced to halve -- the gate has the higher leverage (every future grade), while backfill is a one-time cleanup. No overlap: validate-syntheses.ts today only validates synthesis artifacts, not grades. Effort analog: 20260613T195716Z hash-drift CI-gate pilot slice ($76.18, 1 session, single-script-extension-plus-CI-gate shape) is the closest match for the gate half; the backfill half (rewriting ~20+ of the ~80 grade files on disk, confirmed via `find .claude/artifacts/loop/grades -name '*.md' | wc -l` = 80) adds work beyond that single analog, so overall effort is bumped to 0.35 rather than the pilot slice's ~0.20-0.25.

## Scores

- customer_impact: 0.75
- effort_estimate: 0.35
- strategic_alignment: 0.75
- technical_risk: 0.65
- dependency_depth: 0.20

## Priority Derivation

composite_priority: P1
autonomous_safe: false
reasoning: technical_risk 0.65, band 0.6-0.8 (data-shape correction across ~20+ already-committed grade artifacts, rollback needs a reconcile step not a blind revert, plus a new HARD CI gate wired into .github/workflows/test.yml). composite_score=0.6925 -> P1 via (impact>=0.7 AND alignment>=0.6); pre-mortem mandatory via both P1 and risk>=0.6. autonomous_safe=false: technical_risk (0.65) exceeds the 0.6 gate and this wires a new step into the HARD CI gate file -- human-in-loop required per repo convention.

## Risks

- Pre-mortem Q1 (failed review in 2 weeks): most likely cause is the backfill script 'fixing' all-zero files by inventing plausible-looking scores instead of honestly marking them `backfill_status: unrecoverable` -- fabricated grade data would be a worse outcome than the current known-missing placeholder, and a careful reviewer must reject any backfill entry that cannot cite the source session/artifact it regenerated from.
- Pre-mortem Q2 (rollback if merged and broke the loop): NOT revert-only for the backfill half -- it rewrites ~20+ already-committed grade files (`.claude/artifacts/` is durable committed history per CLAUDE.md); reverting requires confirming no downstream PM/effort-calibration decision was already made against the 'corrected' grades, echoing the dual-write drift-reconcile lesson (`dualwrite-drift-reconcile-pattern.md`) about corrections needing an explicit reconcile step, not a blind revert. The CI-gate half alone is a clean git revert.
- Pre-mortem Q3 (coverage gap): validate-syntheses.ts (107 lines, confirmed on disk) currently validates synthesis artifacts only -- nothing in CI today would catch a new placeholder or all-zero grade file landing; that is precisely the gap AC-1 and AC-4 close.

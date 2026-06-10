---
id: FEAT-145
reviewed_at: 2026-06-10
via: pm
priority: P2
autonomous_safe: true
composite_score: 0.755
scores:
  customer_impact: 0.7
  effort_estimate: 0.3
  strategic_alignment: 0.8
  technical_risk: 0.2
  dependency_depth: 0.0
---
# PM Review — FEAT-145: Grade hygiene linter (grade-write rejects placeholder bullets + zero-score dimensions)

## Verdict

**P2 / autonomous_safe: true** — composite 0.755

## Scoring rationale

| Dimension | Score | Evidence |
|---|---|---|
| customer_impact | 0.7 | Retro 2026-06-10: 18/53 grade files are unfilled templates corrupting retro scoreAverages (all 7 dims read ~0.5 vs real 0.77-0.83) and the brief-me grade trend. Internal-critical: the measurement signal itself is the defect. |
| effort_estimate | 0.3 | Single-module linter mirroring the existing slice-start AC linter; comparable to SLICE-65 ($3.22/15.4m) and SLICE-64 ($1.88/11.6m). No new deps, no contract change. |
| strategic_alignment | 0.8 | Core to loop observability + retrospective integrity (the learning feedback loop). |
| technical_risk | 0.2 | Known pattern, additive, clean `git revert`. Worst case: revert + re-run. |
| dependency_depth | 0.0 | No `depends_on`; independent. Grade-write lives in loop repo, hero-crew consumes via plugin install. |

## Scope challenge

Smallest deliverable: linter in `/loop:slice grade-write` that exits 1 on template placeholders
(`bullet 1`, `bullet 2`, `<fill title>`, `Short decision title`) or all-zero score blocks;
quarantine/mark the 18 legacy unfilled grades so aggregations skip them; recompute retro
scoreAverages over filled grades only. AC is concrete and testable.

## Risk radar

- Placeholder literals are hardcoded across multiple templates — document the canonical
  placeholder list in the linter AC so detection doesn't drift / miss variants.
- Aggregate recomputation needs unit tests over mixed filled/unfilled grade sets to avoid
  false negatives (still-low averages after filtering).
- **autonomous_safe: true** — AC names exact strings + exit criterion; safe for loop pickup
  without human-in-loop. (Contrast: skill/command-authorship FEATs are flagged false.)

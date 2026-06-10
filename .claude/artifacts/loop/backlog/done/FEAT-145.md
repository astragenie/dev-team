---
id: FEAT-145
status: done
priority: P2
category: quality
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.7
pm_effort_estimate: 0.3
pm_strategic_alignment: 0.8
pm_technical_risk: 0.2
pm_dependency_depth: 0
composite_score: 0.755
autonomous_safe: true
triage_notes: "Strong explicit demand (retro signal corruption) + high strategic alignment (loop observability) + low effort (single-module linter, known slice-start AC pattern) + low risk (clean revert). Concrete testable AC. P2: loop stays functional, fix is measurement hygiene not critical path."
---
# FEAT-145: Grade hygiene linter: grade-write rejects placeholder bullets and zero-score dimensions

Retro 2026-06-10 found 18/53 grade files are unfilled templates (scores 0, 'bullet 1', 'Short decision title') from bulk autonomous runs; they corrupt retrospective scoreAverages (all 7 dimensions read ~0.5 vs real 0.77-0.83) and the brief-me grade trend. Fix: /loop:slice grade-write validates like the slice-start AC linter — reject grades containing template placeholder strings or all-zero score blocks; optionally quarantine the 18 legacy files (move to grades/unfilled/ or backfill-mark frontmatter scores: null) so aggregations skip them. AC: grade-write exits 1 with named placeholders; retro scoreAverages computed only over filled grades; existing 18 files excluded from aggregates.

## Completion

Implemented in the **loop** repo (separate from hero-crew) — commit `c066b22 feat(grades): FEAT-145 grade-hygiene linter`. `writeGrade` rejects unfilled grades (`GRADE_TEMPLATE_UNFILLED`: all-zero score blocks or template placeholder strings); `buildRetrospective` computes `scoreAverages` over filled grades only. Full loop suite green (1128 pass / 49 skip / 0 fail). The ~18 legacy unfilled grade files need no quarantine — the retro filter now excludes them at runtime. Backlog reconciled triaged→done 2026-06-11.
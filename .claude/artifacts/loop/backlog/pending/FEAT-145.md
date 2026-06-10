---
id: FEAT-145
status: pending
priority: P2
category: quality
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
---
# FEAT-145: Grade hygiene linter: grade-write rejects placeholder bullets and zero-score dimensions

Retro 2026-06-10 found 18/53 grade files are unfilled templates (scores 0, 'bullet 1', 'Short decision title') from bulk autonomous runs; they corrupt retrospective scoreAverages (all 7 dimensions read ~0.5 vs real 0.77-0.83) and the brief-me grade trend. Fix: /loop:slice grade-write validates like the slice-start AC linter — reject grades containing template placeholder strings or all-zero score blocks; optionally quarantine the 18 legacy files (move to grades/unfilled/ or backfill-mark frontmatter scores: null) so aggregations skip them. AC: grade-write exits 1 with named placeholders; retro scoreAverages computed only over filled grades; existing 18 files excluded from aggregates.
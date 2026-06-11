---
id: FEAT-156
status: triaged
priority: P2
category: perf
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: [FEAT-151]
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: true
tags: [perf, observability]
pm_customer_impact: 0.85
pm_effort_estimate: 0.85
pm_strategic_alignment: 0.85
pm_technical_risk: 0.8
pm_dependency_depth: 0.4
composite_score: 0.775
triage_notes: "Extends existing check-redundant-read hook to block Edit verify-loop re-Reads: SLICE-67 measured 73 redundant Reads + 9.9% Edit failure rate; pure hook addition, autonomous_safe=true; mirrors documented user-feedback pattern."
---
# FEAT-156: Edit verify-loop dedup hook extension

## Description

Phase 2 of the 2-3x slice speedup spec — **blocked by Phase 1 baseline
gate**. Extends `hooks/lib/check-redundant-read.ts` to block Edit
verify-loop re-Reads.

SLICE-67 measured: 191 Edit calls + 19 failures (9.9% failure rate) +
73 redundant_read_count. Pattern: Edit fails → agent re-Reads to
"verify state" → retries Edit. The verify-Read doubles the already-
expensive Edit cache prime (46.06× per Edit call).

Fix: track recent successful Edit/Write per file path. On Read(file)
within N=5 tool calls of successful Edit/Write to same file, deny with
structured response: "file just Edit/Write'd successfully — harness
errors on failed Edit; success means file matches new_string. Re-Read
wasted. Override via force:true or wait 5 tool calls."

Escapes: `force: true` in Read args, OR mtime > Edit timestamp (file
modified by external process), OR ≥5 tool calls elapsed.

**autonomous_safe: true** — additive hook extension, no agent prompt
edits. Mirrors SLICE-67 hook-core extraction pattern.

## Acceptance hints

- Hook core in-process testable.
- Test 1: blocks re-Read within 5 tool calls of successful Edit (no
  mtime change).
- Test 2: allows re-Read when mtime > Edit timestamp.
- Test 3: allows re-Read when `force: true` in Read args.
- Test 4: allows re-Read after ≥5 tool calls elapsed.
- Post-rollout: `redundant_read_count` in cost report drops ≥30%.

## Notes

Mirrors memory file `feedback_stale_ide_diagnostic.md` user feedback
pattern. autonomous_safe=true: pure hook addition. Spec section 2e.
Plan Task 9.

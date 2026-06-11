---
id: FEAT-154
status: triaged
priority: P3
category: perf
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: [FEAT-151]
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: false
tags: [perf, quality]
pm_customer_impact: 0.45
pm_effort_estimate: 0.85
pm_strategic_alignment: 0.55
pm_technical_risk: 0.85
pm_dependency_depth: 0.4
triage_notes: "Mirrors shipped 60s timeout pattern (765c53c, cfe26e7) to reviewer + reviewer-validator only; tail-latency mitigation not median; 2 file edits, lowest-risk Phase 2 lever but smallest impact."
---
# FEAT-154: Bash hard caps everywhere

## Description

Phase 2 of the 2-3x slice speedup spec — **blocked by Phase 1 baseline
gate**. Smallest of the Phase 2 levers. Extends the existing 60s
typecheck cap pattern (commits 765c53c builder, cfe26e7 validator,
architect) to reviewer and reviewer-validator.

Pattern: `timeout ${CREW_BASH_GATE_TIMEOUT_S:-60} <cmd> || echo "TIMEOUT"`.

Kills silent-freeze tail latency without affecting median. Measurable
via FEAT-150 `bash-gates.jsonl` — count of `"TIMEOUT"` exit-codes
expected to drop ≥50% post-rollout.

Lowest-risk Phase 2 FEAT (mirrors existing pattern). P3 because tail
mitigation, not median.

## Acceptance hints

- `agents/reviewer.md` + `agents/reviewer-validator.md` wrap every
  lint/typecheck/test/audit bash invocation with the timeout pattern.
- env `CREW_BASH_GATE_TIMEOUT_S` override respected.
- `grep -c "timeout " agents/reviewer.md agents/reviewer-validator.md`
  shows ≥1 per file.
- Validate-agents green.

## Notes

autonomous_safe=false: agent prompt edits. Spec section 2c. Plan Task 7.

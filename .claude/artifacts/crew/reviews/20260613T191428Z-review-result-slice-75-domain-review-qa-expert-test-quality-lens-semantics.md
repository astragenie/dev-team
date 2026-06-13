# Review Result: SLICE-75 domain review — qa-expert test-quality lens semantics

- Created: 2026-06-13T19:14:28.535Z
- Reviewer: qa-expert
- Decision: rejected
- Summary: REJECTED (maps to needs_fix): 6 major gaps — default bulk-mode invocation will produce 75% FP HIGH noise; env-leak misclassified as HIGH; SHARED_STATE_RE detects declaration not mutation; AC-6 calibration cross-reference covers only 3/5 required slices; zero-finding PR-mode run does not demonstrate <20% FP rate; qa-expert.md prompt missing instruction to use --changed-only as PR-review default. Must-fix before merge: (1) flip default to --changed-only or add explicit prompt instruction, (2) demote env-leak from HIGH to MEDIUM, (3) complete 5-slice calibration cross-reference. Self-review disclosure applied with heightened scrutiny per spec-writer directive.
- Evidence Checked: -
- Files Reviewed: -
- Test Adequacy: -
- Risks: -
- Required Follow-up: -


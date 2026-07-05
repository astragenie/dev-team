---
id: SLICE-193
parent: FEAT-189
status: done
priority: P1
created: 2026-07-04
title: "FEAT-189 S4 — release-engineer eval spec + fixtures + coverage closure (0 planned warnings)"
stack: yaml + markdown
autonomous_safe: true
est_days: 0.5
depends_on: []
touches_files:
  - evals/agents/crew-release-engineer.yaml
  - evals/fixtures/release-engineer-skip-ci-gate.txt
  - evals/fixtures/release-engineer-manifest-mismatch.txt
  - evals/fixtures/release-engineer-force-push-risk.txt
  - evals/fixtures/release-engineer-held-out.txt
  - evals/fixtures/release-engineer-extra.txt
  - agents/release-engineer.md
---

# SLICE-193: release-engineer eval spec + coverage closure (FEAT-189 S4)

## Scope
Final spec. After this, all 8 GEPA v1 target agents carry real specs → 0 planned-eval warnings.

## Acceptance criteria
- AC-1: `crew-release-engineer.yaml` exists with candidate + judge(+gemini fallback) + validate_with + budget.
- AC-2: ≥5 fixtures covering skipping a CI gate before release, marketplace-manifest version mismatch, force-push/tag-delete risk miss (+held_out). Each `llm-rubric`.
- AC-3: `node ./scripts/validate-agents.ts` emits ZERO planned-eval warnings across the whole repo (down from 6).
- AC-4: `bun run evals --dry-run --prompt release-engineer` runs clean.

## Notes
This slice owns the "0 warnings" closure assertion — run validate-agents.ts full after the other FEAT-189 slices merge; if any sibling planned warning remains, flag it (do not silently pass).
Live judge run deferred (operator keys). Dry-run only.

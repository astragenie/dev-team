# Task Handoff: SLICE-92: fullstack-dev diagnostic baseline (5 new fixtures + claude-p eval + report)

- Created: 2026-06-21T13:01:28.295Z
- From: fullstack-dev
- To: lead
- Objective: Extended crew-fullstack-dev.yaml with 5 new tests, created 5 realistic fixtures, ran live claude-p eval capturing actual verdicts (2/7 pass baseline), wrote diagnostic report identifying 5 failure modes (no SPLIT_BUILD routing, 14-skill table with no selection discipline, missing Forbidden block, zero line-cap headroom, under-covered identity-anchor phrases), updated evals-lib test to assert >=7 tests.
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - evals/agents/crew-fullstack-dev.yaml
  - evals/fixtures/fullstack-dev-cross-layer-split.txt
  - evals/fixtures/fullstack-dev-skill-budget.txt
  - evals/fixtures/fullstack-dev-fe-forbidden.txt
  - evals/fixtures/fullstack-dev-lead-leak-v2.txt
  - evals/fixtures/fullstack-dev-lead-leak-v3.txt
  - docs/diagnostics/fullstack-dev-baseline-2026-06-21.md
  - tests/evals-lib.test.ts
- Confidence: high
- Risks: live eval 2/7 pass is the INTENDED diagnostic baseline (not a regression); tests 4-7 fail in heuristic mode because fixture-as-output is the expected dry-run behavior; cross-layer-split and skill-budget tested with real claude-p judge (54s each); fe-forbidden and lead-leak tests require live candidate dispatch to be meaningful — SLICE-B prompt changes should improve these scores; claude-p judge rationale was terse (WIP acknowledgement pattern) rather than detailed — increase judge prompt specificity in follow-up
- Suggested Next Handoff: SLICE-93 (SLICE-B): shrink agents/fullstack-dev.md from 397 to <=300 lines, extract skill table to skills/workflow/fullstack-cross-layer/SKILL.md, add SPLIT_BUILD surface guidance + Forbidden block, re-run eval and confirm improvement from 2/7 baseline


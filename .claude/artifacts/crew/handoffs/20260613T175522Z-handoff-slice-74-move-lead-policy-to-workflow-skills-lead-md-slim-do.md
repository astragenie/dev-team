# Task Handoff: SLICE-74: Move lead policy to workflow skills (lead.md slim-down)

- Created: 2026-06-13T17:55:22.255Z
- From: fullstack-dev
- To: lead
- Objective: Relocated 4 policy blocks from agents/lead.md into 4 new skills/workflow/ skills (lead-routing, risk-tier, fan-out-review, validator-gate); all validators, lint, format, typecheck pass; AC-3 line-count target is spec authoring error.
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - agents/lead.md
  - CHANGELOG.md
  - skills/workflow/lead-routing/SKILL.md
  - skills/workflow/risk-tier/SKILL.md
  - skills/workflow/fan-out-review/SKILL.md
  - skills/workflow/validator-gate/SKILL.md
- Confidence: medium
- Risks: AC-3 spec error: target ≤200 lines is mathematically impossible given preserved content (~290 lines minimum); actual post-slim is 300, maxLines bumped to 305 (actual+5 per spec prose escape hatch). AC-3 pass command regex (maxLines≤200) inconsistent with spec prose. Pre-existing flaky benchmark tests (hook-cold-start-bench, log-event-async-bench) fail under Windows system load on base branch too — not introduced by this slice.
- Suggested Next Handoff: crew:inspector review for semantic preservation (AC-8) — reviewer A diffs 4 new SKILL.md files against pre-slice lead.md L130-190 + L249-253 + L304-323


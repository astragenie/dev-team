---
id: FEAT-046
title: "Builder dispatch reliability — scope-estimate CLI + context ceiling protocol + model compliance signal"
priority: P2
status: pending
category: workflow
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md
related: [FEAT-043, FEAT-044, FEAT-045]
phase: null
tags: [concern:reliability, surface:cli, stack:llm]
pm_customer_impact: 0.75
pm_demand_signal: 0.70
pm_technical_feasibility: 0.85
pm_scope_risk: 0.70
pm_strategic_alignment: 0.80
pm_composite: 0.76
---
# FEAT-046 — Builder dispatch reliability

## Why

SLICE-13: builder hit context ceiling at 50 tool uses / 91k tokens with no recovery
protocol — lead recovered 30% inline. No pre-dispatch estimate predicted this. Sonnet-
default guidance in `agents/lead.md` is a soft recommendation with no measurable
enforcement; `modelMix` in cost reports is the intended signal but nothing surfaces
a warning.

`autonomous_safe: false` — agent prompt edits require human review.

## Spec

`docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md` → FEAT-D

## Acceptance criteria

- [ ] AC-1: `node scripts/crew.mjs scope-estimate --files <list>` returns `{ tier: "light"|"standard"|"heavy", reason: string }`
- [ ] AC-2: `agents/builder.md` contains `context_ceiling_reached` and `DONE_WITH_CONCERNS` in a `## Context ceiling` section; file stays ≤300 lines
- [ ] AC-3: `agents/lead.md` contains ceiling recovery rule referencing `scope-estimate`; file stays ≤300 lines
- [ ] AC-4: `brief-me` output includes `modelCompliance` field in the cost section
- [ ] AC-5: `scope-estimate` has ≥6 unit tests covering light/standard/heavy tier boundaries and eslint-disable escalation
- [ ] AC-6: `validate-agents.mjs` still passes (all agents ≤300 lines)

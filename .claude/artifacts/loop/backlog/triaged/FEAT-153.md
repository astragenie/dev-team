---
id: FEAT-153
status: triaged
priority: P2
category: perf
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: [FEAT-151]
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: false
tags: [perf, quality]
pm_customer_impact: 0.7
pm_effort_estimate: 0.45
pm_strategic_alignment: 0.75
pm_technical_risk: 0.45
pm_dependency_depth: 0.4
composite_score: 0.578
triage_notes: "Skill cap=3 + pre-rendered universals saves ~600ms/skill load but renders content into every agent prompt with hash-drift CI gate; semantic-preservation risk on compression; touches all 17 agents."
---
# FEAT-153: Skill cap=3 + pre-rendered universals

> **Status (2026-06-11): Part 1 shipped, Part 2 deferred.** Only architect, reviewer, and validator carry a skill-consultation cap row today; all three were updated to `max 3 per <phase>` with FEAT-153 attribution. Part 2 (pre-rendered universals + hash-drift CI gate) is a substantial build — new render script + 17 agent prompt injections + hash gate. Carry forward as a separate FEAT or scope into its own slice.

## Description

Phase 2 of the 2-3x slice speedup spec — **blocked by Phase 1 baseline
gate**. Two-part fix targeting context bloat + Skill round-trip cost
(measured: ~600ms per Skill load × multiple skills per dispatch =
silent-freeze pressure on Opus, slow on Sonnet).

Part 1 (SHIPPED): drop skill auto-load cap from 4 → 3 per agent dispatch in all
agent prompts with skill tables. Always-on skill counts as 1.
4th-skill = slice too wide → escalate.

Part 2: `scripts/render-universal-skills.ts` reads three universal
skills (`superpowers:using-superpowers`,
`superpowers:verification-before-completion`, `loop:loop-discipline`)
and inlines a compressed essentials block (~30 lines total) into each
agent prompt under `## Pre-loaded universals` with a SHA-256 hash
marker. CI gate via `scripts/validate-agents.ts` fails if rendered
hash != source hash.

## Acceptance hints

- `renderUniversals()` returns `{body, hash}` with body ≤35 lines.
- `checkUniversalsHash(agentPath)` returns `{drift, expected, found}`.
- `--inject agents/` flag idempotently injects rendered block under
  marker comment in each agent.
- `validate-agents.ts` errors on hash drift with command to re-render.
- Skill cap=3 reflected in all agent prompts (search: "max 3 per slice"
  or "3-skill cap").
- Validator + full suite green.

## Notes

autonomous_safe=false: touches every agent prompt. Spec section 2b.
Plan Task 6.

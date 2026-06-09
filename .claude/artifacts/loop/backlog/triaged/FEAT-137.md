---
id: FEAT-137
title: "Design: decide whether crew:parallel-runner belongs in the guard-feat-dispatch allowlist"
priority: P3
status: triaged
category: design
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: null
plan: null
related: [FEAT-136]
phase: null
tags: ["concern:governance", "surface:hooks"]
pm_customer_impact: 0.4
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
updated: 2026-06-09
created: 2026-06-09
triaged_at: 2026-06-09
triage_notes: "autonomous_safe: true — AC fully specified (ADR + decision criteria + implementation), loop can write the ADR and implement the chosen path without human governance input; the trust model question is answerable from code evidence alone"
slices: []
depends_on: []
github_issue: null
github_milestone: null
github_url: null
pm_legacy_demand_signal: null
---

# FEAT-137: Should crew:parallel-runner be a FEAT-ceremony specialist?

## Problem

`guard-feat-dispatch.mjs` (PreToolUse hook) blocks Agent dispatch on FEAT work unless `subagent_type` is in an allowlist of ceremony specialists. The current allowlist:

```
crew:builder, crew:lead, crew:reviewer, crew:validator, crew:deployer,
crew:researcher, crew:architect, crew:uxdesigner, crew:copywriter,
crew:document-writer, loop:architect, loop:document-writer, loop:pm,
loop:researcher, Explore
```

`crew:parallel-runner` is NOT in this list. The hook treats it as a general-purpose dispatch and refuses on FEAT-tagged work.

This is intentional (per memory `feedback_loop-ceremony` in loopobserver: "Never bypass /crew:build with general-purpose subagent on FEAT-NNN; PreToolUse hook enforces it"). But `crew:parallel-runner` isn't general-purpose — it's a ceremony orchestrator that fans out to ceremony specialists. The current categorization may be wrong.

## Acceptance

- AC-1: ADR drafted at `docs/architecture/decisions/ADR-NNN-parallel-runner-allowlist.md` recording the decision (allowlist vs not) and rationale.
- AC-2: Decision criteria explicit. Consider:
  - Does `crew:parallel-runner` itself dispatch only ceremony specialists? (Currently: yes — it dispatches one Agent per worktree, each running the standard slice ceremony.)
  - Does it produce its own artifact trail? (Currently: yes — writes `runs/<ts>-parallel.md` summary + handoff.)
  - Can it bypass review/validation gates? (Currently: no — each worktree's sub-agent runs the full ceremony.)
- AC-3: If decision = allowlist: hook updated, smoke-test passes, FEAT-136 Path B unblocks.
- AC-4: If decision = NOT allowlist: hook unchanged, FEAT-136 must take Path A (rewrite skill to use `crew:lead` per worktree, retire parallel-runner agent or repurpose it for non-FEAT batch work).

## Notes

- Related: FEAT-136 (the user-facing pain point that surfaces this design question).
- Cheaper short-term: ship FEAT-136 Path A first (rewrite skill). Decide FEAT-137 later when there's appetite for a hook overhaul.

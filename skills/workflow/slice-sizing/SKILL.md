---
name: slice-sizing
prompt_id: slice-sizing
version: 1.0.0
tier: workflow
description: Size slices so each dispatch lands under turn caps and atomic actions fit 8/80-hour bounds
source: derived from spec-decomposition methodology + observed builder cap-hit patterns in v0.8.0 session
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: [/loop:spec-decompose, slice start, builder dispatch estimate, work-breakdown-structure sizing, multi-file slice planning, cap-hit risk]
---

# Slice Sizing

## When to use

Load this skill:
- At SPEC decomposition time (`/loop:spec-decompose`) — size atomic actions before writing slice specs.
- At slice-start — verify the slice fits before dispatching a builder.
- Before any builder dispatch where the scope estimate exceeds ~30 turns.
- When the pre-dispatch decomposition rule (see `agents/lead.md`) flags ≥2 role concerns.

Skip for single-file trivial changes or lead inline-handled edits.

## Atomic action sizing

Sourced from and consistent with `skills/workflow/spec-decomposition/` (8/80-hour rule section).

| Condition | Action |
|---|---|
| Atomic action < 8 hours | Aggregate with a sibling action — too granular to dispatch independently. |
| Atomic action > 80 hours | Decompose further — contains hidden complexity or multiple concerns. |
| Estimate uncertain | Bias toward the upper bound; flag assumption explicitly. |

Each slice should contain 1–3 atomic actions, each in the 8–80 hour range.

## Builder turn budget

Empirical evidence from v0.8.0 session (builder cap-hit patterns):

- `maxTurns: 40` is the soft cap in builder frontmatter.
- Real ceiling observed: ~48–55 tool uses before the agent pauses.
- 5 of 14 dispatches in the v0.8.0 session hit the cap and required resume-from-handoff, roughly doubling overhead for those slices.

**Practical budget:** treat 40 tool uses as the planning ceiling. A slice estimated at >40 tool uses MUST split before dispatch.

## Decomposition triggers

Apply at least one of these split conditions before dispatching:

| Condition | Required action |
|---|---|
| Estimated > 40 turns | Split required — never dispatch a builder into a known cap-hit. |
| ≥ 2 distinct role concerns | Parallel split: architect, copywriter, builder as separate dispatches per pre-dispatch decomposition rule. |
| > 5 files in scope | Consider splitting — file count correlates with turn count; audit per role before dispatching. |
| Multi-stack work (backend + frontend + infra) | Multi-agent parallel dispatch — assign one agent per concern. |
| Single atomic action > 80 hours | Decompose into smaller atomic actions first. |

## Splitting strategies

**Role-bundle split:** group files by role concern (see pre-dispatch decomposition rule in `agents/lead.md`). Dispatch in parallel via a single message with multiple Agent tool calls.

**Sequential split:** when dependency forces ordering (e.g., schema before API before UI), split into chained slices. Each slice passes an artifact handoff to the next.

**Parallel split within a role:** when two independent features in the same stack can land independently, split into two builder slices assigned to separate worktrees.

## Done / Acceptance

A slice is correctly sized when:
- It contains 1–3 atomic actions, each 8–80 hours.
- Each atomic action has a ≤ 40-turn dispatch estimate.
- A single role concern owns the slice, OR an explicit parallel decomposition plan names one agent per concern.
- Files in scope are listed and grouped by role before dispatch.

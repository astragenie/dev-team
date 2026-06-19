---
name: spec-decomposition
prompt_id: spec-decomposition
version: 1.0.0
tier: workflow
description: Break complex multi-step goals into structured WBS with dependencies, parallelism map, effort estimates, and risk register
source: aitmpl/ai-specialists/task-decomposition-expert
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: [SPEC authoring, FEAT decomposition, multi-FEAT planning, large-scope feature, work-breakdown-structure, dependency mapping, parallelism planning]
---

# Spec Decomposition

## When to use

Load this skill when:
- Authoring a new SPEC or decomposing a large FEAT into child FEATs
- A project spans multiple capabilities, stacks, or team roles
- The scope feels ambiguous or overwhelming and needs a structured plan before execution
- Designing a multi-agent or multi-step pipeline where orchestration is the primary deliverable
- A feature has real time or resource constraints requiring parallel track identification

Skip for single-slice, well-bounded tasks where the scope is already fully specified.

## Required initial inputs

Before producing any decomposition, gather these six inputs. Do not skip — missing answers produce mismatched plans.

1. **Goal statement** — What does success look like in one sentence?
2. **Constraints** — Time budget, team size, technology stack, hard dependencies.
3. **Non-negotiables** — What cannot change or be cut?
4. **Existing assets** — What work, code, data, or infrastructure already exists?
5. **Risk tolerance** — Greenfield experiment or production system with uptime requirements?
6. **Acceptance criteria** — How will each major milestone be declared done?

If these are already present in the SPEC or context, proceed directly to decomposition.

## Decomposition framework

Execute the following six steps in order:

### 1. Goal analysis

Restate the objective as a single measurable outcome. Identify:
- **Explicit requirements** — stated in the brief
- **Implicit requirements** — constraints that follow logically (e.g., auth needed if there are users)
- **Out of scope** — what this decomposition explicitly excludes
- **Success metrics** — quantitative criteria for each major milestone

### 2. Work breakdown structure (WBS)

Decompose into a three-level hierarchy:

```
Level 1: Primary Objectives  (high-level outcomes, 3–7 total)
  Level 2: Tasks             (supporting activities per objective)
    Level 3: Atomic Actions  (specific executable steps, 8–80 hours each)
```

Apply the **8/80 rule** (see below) to size atomic actions.

### 3. Dependency mapping

Produce a dependency graph for all Level 2 tasks:

```
[TASK-A] → [TASK-B]     # B requires A to be complete
[TASK-A] ⟷ [TASK-B]    # A and B can run in parallel
[TASK-A] ⟹ [TASK-B]    # B is blocked until A delivers a specific artifact
```

Identify the **critical path**: the longest chain of sequential dependencies that determines minimum project duration.

### 4. Parallelism map

Group tasks into simultaneous execution tracks:

| Track | Tasks | Owner Role | Duration Estimate | Depends On |
|---|---|---|---|---|
| Track A | … | builder | X days | none |
| Track B | … | reviewer | Y days | Track A milestone 1 |

### 5. Effort and complexity heuristics

For each Level 2 task, assign:
- **Effort** (person-days): sum of atomic action estimates
- **Complexity** (Low / Medium / High / Very High): based on unknowns, integration surface, reversibility
- **Risk rating** (1–5): likelihood × impact of this task failing

### 6. Risk register

List the top 5 risks:

| Risk | Likelihood | Impact | Mitigation Task | Owner |
|---|---|---|---|---|
| Example: schema migration corrupts records | Low | Critical | Add rollback script + staging dry-run | builder |

## 8/80 rule

Atomic actions must fall within the 8–80 hour range:
- **Under 8 hours** — aggregate with a sibling action; it is too granular to track independently.
- **Over 80 hours** — decompose further; it contains hidden complexity or multiple concerns.

When estimates feel uncertain, bias toward the upper end and flag the assumption explicitly.

## Output format

Deliver the decomposition as a structured document with sections in this order:
1. **Executive summary** (3–5 sentences): goal, approach, critical path duration, top risk
2. **Work breakdown structure**: full three-level hierarchy with effort estimates
3. **Dependency graph**: text notation per Step 3
4. **Parallelism map**: table of parallel tracks per Step 4
5. **Risk register**: top 5 risks per Step 6
6. **Validation checkpoints**: one gate per major milestone (artifact required + metric + approver)
7. **Handoff plan**: which crew role handles each track

## Done / Acceptance

Decomposition is complete when:
- All six initial inputs are accounted for (or explicitly noted as assumed)
- WBS has three levels with effort estimates on every atomic action
- Dependency graph identifies the critical path
- Parallelism map shows which tracks can proceed simultaneously
- Risk register lists top 5 risks with mitigations
- Each major milestone has a defined validation checkpoint
- Handoff plan names a specific crew role for each execution track

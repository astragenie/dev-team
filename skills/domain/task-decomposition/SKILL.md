---
name: task-decomposition
tier: domain
description: Work breakdown methodology — decompose complex goals into WBS with dependency graphs, parallelism maps, effort estimates, and agent handoff plans.
owner: hero-crew
last_reviewed: 2026-06-09
triggers: ["decompose", "work breakdown", "WBS", "task breakdown", "parallel tracks", "critical path", "project decomposition"]
---

## When to use

Before substantial multi-track implementation: greenfield projects, monolith migrations, multi-agent pipeline design, or any scope that needs parallel execution clarity before coding begins.

## Requirements Gathering (do first)

Collect before decomposing — missing answers produce mismatched plans:

1. **Goal**: Success in one sentence
2. **Constraints**: Time budget, team size, tech stack, hard dependencies
3. **Non-negotiables**: What cannot change or be cut
4. **Existing assets**: Code, data, infrastructure already in place
5. **Risk tolerance**: Greenfield experiment vs production uptime requirement
6. **Acceptance criteria**: How each major milestone is verified

## Core Framework

### 1. Goal Analysis

Restate objective as a single measurable outcome. Identify:
- Explicit requirements (stated)
- Implicit requirements (logically required — e.g. auth if there are users)
- Out of scope (explicit exclusions)
- Success metrics (quantitative per milestone)

### 2. Work Breakdown Structure

Three-level hierarchy:

```
Level 1: Primary Objectives (3–7 total)
  Level 2: Tasks (supporting activities per objective)
    Level 3: Atomic Actions (1–8 hours each)
```

**8/80 rule**: no action < 8h (aggregate with sibling) or > 80h (decompose further).

### 3. Dependency Mapping

```
[TASK-A] → [TASK-B]      # B requires A complete
[TASK-A] ⟷ [TASK-B]     # parallel
[TASK-A] ⟹ [TASK-B]     # B blocked until A delivers specific artifact
```

Identify the **critical path**: longest sequential chain = minimum project duration.

### 4. Parallelism Map

| Track | Tasks | Owner Role | Duration Est. | Depends On |
|---|---|---|---|---|
| Track A | ... | backend-developer | X days | none |
| Track B | ... | frontend-developer | Y days | Track A milestone 1 |

### 5. Effort and Complexity

Per Level 2 task:
- **Effort** (person-days)
- **Complexity**: Low / Medium / High / Very High
- **Risk rating** (1–5): likelihood × impact

### 6. Risk Register

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| DB migration corrupts records | Low | Critical | Rollback script + staging dry-run | database-architect |

Top 5 risks minimum.

### 7. Validation Checkpoints

Per major milestone:
- Artifact required (passing test suite, deployed staging endpoint)
- Metric required (P95 latency < 200ms)
- Who approves before next phase

## Output Structure

1. **Executive Summary** — goal, approach, critical path duration, top risk (3–5 sentences)
2. **Work Breakdown Structure** — full three-level hierarchy with effort
3. **Dependency Graph** — text notation
4. **Parallelism Map** — parallel tracks table
5. **Risk Register** — top 5
6. **Validation Checkpoints** — one gate per milestone
7. **Agent Handoff Plan** — specialist per track

## Agent Handoff Reference

| Workstream | Agent | Handoff Artifact |
|---|---|---|
| Frontend | builder-fe | WBS Level 3 + acceptance criteria |
| Backend API | builder-be | Dependency graph + data contracts |
| Database | database-architect | Entity list + migration sequence |
| Infrastructure | deployment-engineer | Service topology + SLO targets |
| AI/LLM components | ai-engineer | Model requirements + latency targets |
| DevOps/CI | devops-troubleshooter | Pipeline spec + environment matrix |

## Key Rules

- Always gather requirements before decomposing
- Prefer measurable estimates over vague ranges
- Flag every assumption explicitly so it can be corrected before work begins
- Parallelism map is the primary artifact the lead uses to dispatch subagents

## Done / Acceptance

Decomposition is complete when:
- All Level 2 tasks have effort estimates and complexity ratings
- Critical path is identified
- Parallelism map has at least one parallel track where applicable
- Every major milestone has a validation checkpoint
- Agent handoff plan maps each track to a specific agent

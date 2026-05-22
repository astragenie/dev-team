# Crew Engineering OS — Product Backlog

Source: `docs/architecture/architecture.md`.

Items live in `docs/backlog/{pending,triaged,in-progress,done}/` and are
managed by the `autonomous-loop` plugin's backlog CLI.

## Phase 1 — Minimal Viable

| ID       | Title                                              | Autonomous-safe |
|----------|----------------------------------------------------|-----------------|
| FEAT-001 | Skills directory reorganization                    | yes             |
| FEAT-002 | Authoritative routing table                        | yes             |
| FEAT-003 | Lead agent prompt update                           | **no** — review |
| FEAT-004 | Architecture document polish                       | yes             |
| FEAT-007 | Skill quality bar + frontmatter convention         | yes             |

## Phase 2 — Domain build-out (on-demand, one at a time)

| ID       | Title                                              | Autonomous-safe |
|----------|----------------------------------------------------|-----------------|
| FEAT-005 | First domain skill — dotnet/csharp-conventions     | **no** — review |
| (more)   | Add one per real friction point — do NOT pre-author| **no**          |

## Phase 2 — TDD + standards

| ID       | Title                                              | Autonomous-safe |
|----------|----------------------------------------------------|-----------------|
| FEAT-011 | TDD discipline (scoped, not universal)             | **no** — review |

## Phase 3 — Workflow state polish

| ID       | Title                                              | Autonomous-safe |
|----------|----------------------------------------------------|-----------------|
| FEAT-006 | workflow-state — blocked + escalated_to_human     | yes             |
| FEAT-008 | Routing-table review cadence                       | yes             |
| FEAT-010 | Governance doc                                     | yes             |

## Phase 4+ — Defer

| ID       | Title                                              | Trigger                                |
|----------|----------------------------------------------------|----------------------------------------|
| FEAT-009 | Artifact index file                                | Only when grep latency > 2s            |
| (MCP)    | MCP memory integration                             | When external system has central data  |
| (TS)     | TS migration                                       | If JSDoc + tsc no longer enough        |

## Companion items in autonomous-loop

See `hero-crew-autonomous-loop/docs/backlog/`:

- FEAT-001 (loop): Iteration cap + runaway halt
- FEAT-002 (loop): Mirror `blocked` + `escalated_to_human` badges
- FEAT-003 (loop): Cost-advisor signal in stop-conditions
- FEAT-004 (loop): Optional cross-repo `parentRunId`
- FEAT-005 (loop): snapshot-memory enrichment with iteration count

## Autonomous-safety guidance

Items marked **autonomous_safe: false** require human review of the
slice handoff before merge. Items marked **true** can be picked by the
autonomous-loop without per-slice approval, but each slice still passes
through the standard crew gates (review, validation, deployment).

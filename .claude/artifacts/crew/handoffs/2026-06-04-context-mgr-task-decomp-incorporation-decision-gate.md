---
kind: handoff
created_at: 2026-06-04
scope: incorporate-context-manager-and-task-decomposition-expert
status: awaiting-user-decision
gate: path-selection
related_commits:
  - fea5e8b (lead pre-dispatch decomposition rule)
  - 361284f (FEAT tag-schema)
---
# Handoff — context-manager + task-decomposition-expert incorporation (decision gate)

## Objective

User asked which crew agents could use the 2 still-untouched orchestrator-flavor 3rdparty agents and whether any gain materialises.

## Audit findings (chat turn)

| Source | Lines | Best crew consumer | Gain estimate | Overlap with existing |
|---|---|---|---|---|
| `agents/3rdparty/context-manager.md` | 64 | lead (handoff prep / pre-compaction) | ~10% | High — `write-handoff` CLI + crew artifacts + `/loop:snapshot-memory` already do this |
| `agents/3rdparty/task-decomposition-expert.md` | 148 | lead at `/loop:spec-decompose` time; architect at large-design time | ~15–25% on large multi-FEAT specs; negligible on single slices | Low — adds structured WBS + dep graph + parallelism map + risk register where today there is heuristic decomposition only |

## Three paths

| Path | Scope | Effort | When right |
|---|---|---|---|
| **A. Extract both as skills** | `skills/workflow/context-curation/` + `skills/workflow/spec-decomposition/`, plus routing-table rows + lead.md "Skills you consult" updates | 4–6h, single slice | Want both capabilities; willing to pay extraction cost upfront |
| **B. Extract only task-decomposition-expert** (recommended) | `skills/workflow/spec-decomposition/` only; defer context-curation | 2–3h | Focus on the higher-gain candidate; revisit context-manager if pre-compaction pain emerges |
| **C. Neither** | Both stay vendored in `agents/3rdparty/` | 0 | Status-quo; lead does decomposition manually per pre-dispatch rule |

## Lead recommendation

**Path B.** task-decomposition-expert has clear value at SPEC + FEAT decomposition gates; context-manager overlaps too heavily with existing crew/loop infrastructure to justify the extraction now.

## What's next

1. User picks A / B / C.
2. If A or B: dispatch architect (decomposition methodology = interface-contract authoring) for the skill extraction. Mirrors the prior agent-skill-extraction pattern (Slices 1–5).
3. Per session pattern: implement → commit → push.

## Current uncommitted state

- Working tree clean at `361284f`.
- v0.8.0 tag live on origin.
- No active workflow gates.

## References

- 3rdparty audit (this turn): 12 extracted to skills + 2 folded + 3 stub-delegated + 4 truly untouched. context-manager and task-decomposition-expert are 2 of the 4 truly untouched.
- Prior decision gate (rejected promotion of these 2 as utility agents in Option 2): `.claude/artifacts/crew/handoffs/2026-06-04-3rdparty-agent-skill-extraction-decision-gate.md`.
- Pre-dispatch decomposition rule: `agents/lead.md` lines ~71–94.
- Tag-to-agent mapping: `agents/lead.md` lines ~96–115 (`docs/standards/feat-tag-schema.md`).

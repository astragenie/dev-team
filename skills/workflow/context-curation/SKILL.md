---
name: context-curation
prompt_id: context-curation
version: 1.0.0
tier: workflow
description: Curate per-agent context briefings and pre-compaction checkpoints during multi-agent workflows
source: aitmpl/development-tools/context-manager
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: [pre-compaction, multi-agent handoff, context overflow, session checkpoint, long-running session]
---

# Context Curation

## When to use

Load this skill when:
- A multi-agent session is approaching compaction (≥3 compactions observed, or token budget visibly shrinking)
- Handing off between agents with significantly different context needs
- A long-running session reaches a major milestone and needs a checkpoint
- Context overflow risk is high (many files touched, many decisions made)
- Starting a new session after a pause and clean handoff is needed

Do NOT invoke for trivial single-agent tasks where the context is self-contained and fits in one session.

## Context formats

Choose the format that fits the receiving agent's context budget:

### Quick context (< 500 tokens)

Use for: intra-session handoffs, short-lived sub-agent dispatches, "current state" updates.

Include:
- Current task and immediate goals
- Recent decisions affecting current work
- Active blockers or dependencies

### Full context (< 2000 tokens)

Use for: cross-session handoffs, new agent onboarding to an in-flight project.

Include:
- Project architecture overview
- Key design decisions
- Integration points and APIs
- Active work streams

### Archived context (stored in memory / artifact)

Use for: persistent cross-session memory. Write to `.claude/artifacts/crew/` or invoke `/loop:snapshot-memory`.

Include:
- Historical decisions with rationale
- Resolved issues and their solutions
- Reusable pattern library
- Performance baselines

**Guiding principle:** Optimize for relevance over completeness. Good context accelerates work; bad context creates confusion.

## Workflow integration

Execute this loop at each context-prep trigger:

1. **Capture** — Review the current conversation and agent outputs. Extract key decisions, rationale, integration points, unresolved issues, and TODOs.

2. **Prune** — Remove outdated or irrelevant information. Index commonly accessed information. A stale context is worse than a sparse one.

3. **Package** — Select the appropriate format (Quick / Full / Archived) based on the receiving agent's role and session length. Prepare an agent-specific briefing.

4. **Distribute** — Pass the packaged context to the next agent via `write-handoff --repo-context` or inline in the dispatch instruction. The `--repo-context` flag saves 3–5 tool turns per subagent.

5. **Checkpoint** — At major milestones, write a durable artifact under `.claude/artifacts/crew/handoffs/`. Pair with `/loop:snapshot-memory` for cross-session repo memory.

## Integration with crew infrastructure

- **Pre-compaction:** If ≥3 compactions observed, write a checkpoint handoff and reduce scope before dispatching another subagent.
- **Snapshot-memory pairing:** Durable project state (decisions, grades, backlog) belongs in `/loop:snapshot-memory` output, not in per-agent briefings.
- **Handoff CLI:** Use `node ... crew.mjs write-handoff` for structured handoffs. Inline context returns inflate lead context unnecessarily.

## Done / Acceptance

Context curation is complete when:
- A briefing exists in the appropriate format (Quick / Full / Archived) for the receiving agent
- The briefing contains only relevant, current information — no stale decisions or resolved blockers
- Durable checkpoints are written to `.claude/artifacts/crew/handoffs/` at major milestones
- The next agent can orient within 1–2 tool turns without redundant file reads

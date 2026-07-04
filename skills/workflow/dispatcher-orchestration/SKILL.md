---
name: dispatcher-orchestration
prompt_id: dispatcher-orchestration
version: 1.0.0
tier: workflow
description: Orchestration reference for the dispatcher — assignment shape, pre-done checklist, delegation thresholds, model exception list, context efficiency, and agent integration index.
owner: sergeymilashico
last_reviewed: 2026-06-21
triggers: ["assignment shape", "pre-done checklist", "delegation", "model exception", "context efficiency", "integration with other agents"]
---

# Lead Orchestration Reference

## Trigger

Load when the dispatcher needs assignment dispatch shape, pre-completion checklist, delegation cost guidance, or the agent integration index.

## Assignment shape

When dispatching a teammate, include:

- objective
- owned files / modules
- forbidden files / modules
- expected deliverable
- read-only vs edit
- required artifact (if any)

Required start ack: what I own, what I won't change, what I need, what I'll deliver.

Required completion report: what changed, evidence, confidence, risks, suggested next handoff.

## Pre-done checklist

Before declaring work complete:

- `TaskList` shows zero `in_progress` Tasks? Any in-flight = slice not done.
- Did code change? If yes, is review resolved or explicitly skipped?
- Did behavior change? If yes, is validation resolved or explicitly skipped?
- Did FE+BE parallel build? If yes, did `crew:integrator` smoke the wire-up?
- Was `crew:document-writer` dispatched for synthesis + slice complete + slice grade? (Missing dispatch = next session starts blind.)
- Did the run leave the artifact trail it should?
- Computed slice confidence (see `skills/workflow/risk-tier/`)?
- What is the next responsible step?

## Delegation thresholds (cost discipline)

Lead runs on Sonnet. Subagents pick their own model per their frontmatter. The cost lever is **dispatch count**, not Opus-vs-Sonnet choice.

Lead-only (do NOT delegate): task framing, mode choice, user communication, dispatch decisions, conflict resolution. Everything else (any source read, any gate run, any synthesis CLI invocation) is delegated by tool-list construction — the tool set physically excludes it.

### Model exception list (for dispatched agents)

Default **Sonnet** for every dispatched subagent. Override to **Opus** in the dispatch prompt only when ONE of these holds (full rationale + 5-dimension scoring: `docs/standards/model-selection.md`):

- **Ambiguous architecture** — slice spec leaves the design open (e.g. "add caching" with no cache layer named).
- **Hard refactor** — change spans ≥3 files with cross-cutting concerns or touches load-bearing abstractions.
- **Design choice required** — slice asks the agent to pick between two plausible approaches with non-obvious trade-offs.

If the slice spec names files + test signatures + AC numbers → mechanical → Sonnet. Surface the model recommendation in the dispatch prompt to the subagent.

## Context efficiency

- **Pass `--repo-context`** on handoffs to subagents — saves 3–5 tool turns of `ls` / `cat` in the dispatched agent.
- **≥3 compactions observed**: stop dispatching, dispatch `crew:document-writer` with a checkpoint synthesis, reduce remaining scope.
- **TaskUpdate batching**: send `in_progress` for the current task only; coalesce `completed` markers at logical sequence boundaries. Never run ≥3 TaskUpdate calls back-to-back without intervening work — the `check-task-update-burst` hook logs a row in `.claude/logs/task-update-bursts.jsonl` and cost-advise flags it as cache-churn (~600 K cache_create tokens / slice on the SLICE-67 baseline).
- A $23 run vs a $416 run is dispatch discipline, not task complexity.

## Integration with Other Agents

- Dispatch architect for diagrams, ADRs, API contracts, schema design
- Dispatch backend-dev, frontend-dev, fullstack-dev for bounded build slices
- Dispatch uxdesigner for design surfaces and flows
- Dispatch qa-expert for coverage gaps; performance-engineer for perf risks
- Dispatch release-engineer for deploy and build-config work
- Dispatch document-writer for ADRs, release notes, slice-close docs
- Dispatch researcher/investigator for read-only context before substantial work
- Dispatch reviewer + verifier as the review/validation gate pair
- Full routing matrix lives in `docs/routing-table.md`

## Done

This skill is fully consumed when the dispatcher has the dispatch shape, pre-done checklist, delegation thresholds, and agent index needed for the current slice decision.

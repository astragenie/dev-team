---
id: FEAT-032
title: Artifact-path-only subagent returns
priority: P1
status: done
category: performance
target_release: v0.5.0
created: 2026-06-01
updated: 2026-06-02
depends_on: []
slices: [SLICE-12]
derived_from: null
autonomous_safe: true
---

## Description

Recent slices recorded 34 compactions per slice (SLICE-08), driven in
part by subagents inlining multi-KB reports into the lead's context.
Each compaction triggers a full context re-derive and cache miss.
Cost-discipline rule #2 from `feedback_cost_discipline.md` already
states: subagents must write reports to
`.claude/artifacts/crew/handoffs/` and return only the absolute path.
Add a PostToolUse hook that warns when a subagent return body exceeds
a configurable byte threshold without an artifact path, plus update
agent prompts to mandate write-then-return-path.

## Acceptance hints

- PostToolUse hook on the `Agent` tool that inspects the subagent
  return body. If body exceeds threshold (default ~512 bytes) AND
  contains no `.claude/artifacts/crew/handoffs/*.md` path, emit a
  soft-warn (never block).
- Threshold configurable via env var (e.g.,
  `CREW_SUBAGENT_INLINE_THRESHOLD`).
- Agent prompts for `crew:builder`, `crew:reviewer`,
  `crew:validator`, `crew:deployer`, `crew:researcher` mandate
  writing the completion report to a handoff path and returning only
  the path.
- Tests: hook fires on synthetic oversized inline return, stays silent
  on path-only return, stays silent on small return.
- Compaction count in subsequent cost reports drops vs SLICE-08
  baseline.

## Notes

- Pairs with FEAT-030 (bundled subagent passes). Together they target
  the compaction + subagent-creep cost drivers.
- Source analysis: handoff `20260601T115349Z-...-awaiting-user-choice.md`.

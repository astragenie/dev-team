---
kind: handoff
created_at: 2026-06-04
scope: builder-turn-reduction-plus-loop-empty-agent-report-bug
status: awaiting-user-decision
gate: option-selection-A-B-C-plus-loop-bug-disposition
related_commits:
  - fea5e8b (pre-dispatch decomposition rule)
  - 361284f (FEAT tag-schema)
  - c516630 (context-curation + spec-decomposition skills)
---
# Handoff — turn-reduction brainstorm + loop empty-agent-report bug (decision gate)

## Two concerns

### A) Loop empty-agent-report bug (diagnosed, not actionable from here)

`C:\work\mega\loop\.claude\artifacts\crew\agents\*` contains 24 agent-report files, several with `agent_count: 0, total_turns: 0`. Slices DID dispatch agents (per loop history), so reports are wrong.

**Writer location:** `loop/scripts/lib/slice-linker/agent-report-writer.mjs` (in `sergeymilashico/loop`, separate repo).

**Hypothesis:** report filters `.claude/logs/events.jsonl` to `subagent_start` / `subagent_stop` events at-or-after `currentRun.startedAt`. If startedAt rotates later than actual dispatches, OR events.jsonl missing the events (older pre-instrumentation sessions), report is empty.

**Cannot fix from hero-crew.** Options:
- Add FEAT to loop repo backlog
- Switch session to loop and `/crew:fix` properly there
- Defer

### B) Builder turn-reduction brainstorm

User asked how to decrease builder turn count and offload to lead + architect; floated direct dispatch to language-pro 3rdparty agents and overriding the "no specialist builders" architecture rule.

**Eight options ranked.** Lead recommendation: implement 1 + 2 + 4 (lead inline policy work + architect owns .md/spec/policy + slice-sizing skill). Skip 6 + 7 (direct language-pro dispatch + architecture override) until 1/2/4 proves insufficient.

**Three implementation paths presented in chat:**

| Path | What | Effort | Risk |
|---|---|---|---|
| **A. Minimal** | Items 1 + 2 (lead.md inline policy rule + strengthen tag-mapping for architect-routing) | 25 min | none |
| **B. Plus skill** (recommended) | Items 1 + 2 + 4 (add `skills/workflow/slice-sizing/` for 8/80-hour atomic action rule + lead.md skills-you-consult bullet) | 1 h | none |
| **C. Architecture revisit** | Items 6 + 7 (direct 3rdparty language-pro dispatch + revise "no specialist builders" rule via SPEC + ADR) | 1–2 days | high — reverses deliberate design |

## Open Qs

1. **Turn-reduction path:** A / B / C / different? Lead leans B.
2. **Loop bug:** log as FEAT in loop repo (preferred) / switch session to loop and fix / defer?

If B: dispatch architect for slice-sizing skill extraction + lead.md edits. Mirrors prior pattern (context-curation + spec-decomposition extraction in `c516630`).

If A: lead does inline (no subagent dispatch).

If C: requires brainstorm round 2 → SPEC authoring → user approval — not a single-session task.

## Current uncommitted state

- Working tree clean at `c516630`.
- v0.8.0 tag live on origin.
- No active workflow gates.

## References

- Pre-dispatch decomposition rule: `agents/lead.md` lines 73–96.
- Tag-to-agent mapping: `agents/lead.md` lines 98–116.
- Spec-decomposition skill (relevant to Option 4): `skills/workflow/spec-decomposition/SKILL.md`.
- Builder cap evidence (session): 5 of 14 dispatches paused near 48–55 tool uses; `maxTurns: 40` soft cap.

---
kind: handoff
title: "dev-team#174 — builder pre-death checkpoint: design (human review required)"
date: 2026-07-07
owner: researcher (crew:researcher, resumed after mid-write death — ironic repro of #174)
confidence: 0.8
autonomous_safe: false
---

# dev-team#174 — pre-death checkpoint design

**Status:** DESIGN ONLY. Touches agent prompts (autonomous_safe=false per backlog
discipline), hooks.json, a workflow skill, and a new crew.json feature flag — needs
human review before build.

## Problem
Crew builder subagents die mid-job at ~65–85 tool calls / ~18–22 min, truncating
mid-thought with NO handoff and uncommitted (sometimes broken) WIP. Recovery that
works today is manual (auto-resume same agent via SendMessage + git snapshot). Want
an automatic pre-death checkpoint so a resume loses no WIP/context.

## 1. Dispatch / lifecycle sites
- **Autonomous path:** `scripts/lib/slice-linker/dispatch.mts:1-12,243-295` — `planDispatch()`
  is a PURE PLAN GENERATOR (no side effects, no Agent calls). The actual spawn+await lives
  in the companion **runner-plugin** orchestrator — NOT editable from this repo.
- **Interactive path:** `commands/build.md:44-137` (~line 118) — the dispatcher LLM issues
  the `Agent` tool call itself; prompt-driven, no programmatic await. Harness owns spawn/await.
  Confirmed unenforceable from this repo per `docs/research/2026-07-06-agent-mid-job-death-analysis.md`
  (zero maxTurns/maxMinutes enforcement outside `agents/*.md` + docs).
- **Builder caps (advisory, unenforced):** `agents/fullstack-dev.md:15-22` — `maxTurns:80`,
  `maxMinutes:20`, `warnAtTurns:50`, `warnAtMinutes:9`. Death window sits right at these.
- **Death detection today (post-mortem only):** `hooks/hooks.json:137-145` →
  `hooks/lib/check-subagent-return.ts:157-218` `detectSubagentIncomplete` — fires in the
  PARENT session after the subagent already died; always `decision:"approve"` (warn-only,
  never resumes).

## 2. Recommended mechanism — PostToolUse hook counter (child-side)
NOT a prompt cadence line (warn-only = the exact failure mode we're closing), NOT a
wall-clock guard (harness cutoff is opaque; tool-count is the evidenced correlate —
SLICE-107 died at tool 82).

- **Trigger:** new `PostToolUse` hook, no matcher (same stage as `otel-post-tool-use.ts`
  at `hooks/hooks.json:164-171`) → fires on every tool call INSIDE the builder's own
  session. Mirror the proven per-`session_id` counter pattern in
  `hooks/lib/check-task-update-burst.ts:12-120`. Every N calls (default 20) emit
  `{decision:"approve", systemMessage:"..."}` — an ENFORCED context injection, not a
  hope-they-comply prompt.
- **Captures:** on the nudge the builder runs `git status --short && git diff --stat`
  + one line current subtask + one line next intended step.
- **Writes:** new state file `.claude/state/crew/checkpoint-<slice-id>.md` (gitignored,
  machine-local — does NOT pollute committed handoffs tree). Deliberately NOT `write-handoff`
  (forbidden by `skills/workflow/builder-ceremony/SKILL.md:8` + `agents/fullstack-dev.md:189-191`);
  needs an explicit carve-out for this new artifact KIND, not a bypass.

## 3. Edit sites + diff sketch
- **New:** `hooks/checkpoint-cadence.ts` (shim, mirrors `hooks/check-task-update-burst.ts:1-24`)
  + `hooks/lib/checkpoint-cadence.ts` (logic, mirrors `:12-120`; state at
  `.claude/state/checkpoint-cadence/<session_id>.json`).
- **Edit `hooks/hooks.json:164-171`** — add third entry to the no-matcher PostToolUse array:
```diff
       {
         "hooks": [
           { "type": "command", "command": "bun \"${CLAUDE_PLUGIN_ROOT}/hooks/otel-post-tool-use.ts\"" }
+          ,{ "type": "command", "command": "bun \"${CLAUDE_PLUGIN_ROOT}/hooks/checkpoint-cadence.ts\"" }
         ]
       }
```
- **Edit `agents/fullstack-dev.md:131-137`** (+ same-shape `agents/backend-dev.md:172`,
  `agents/frontend-dev.md:90`) — extend "Checkpoint-commit discipline" to write the state
  file on the hook nudge (resume scaffold, not a handoff).
- **Edit `skills/workflow/builder-ceremony/SKILL.md:8`** — carve the "no handoff artifacts"
  line so it doesn't contradict the new instruction.
- **New flag** `.claude/crew.json` `features["checkpoint-cadence"]` (default on + threshold),
  read via `scripts/lib/features-service.ts:149,176` (same idiom as `subagent-inline-warn`).

## 4. Top risks
1. **False triggers on read-heavy phases** — counter fires on Read/Grep/Bash too, can nudge
   mid-investigation before any edit → empty checkpoint. Mitigate: only count after first
   `Edit`/`Write`, or make the systemMessage conditional on uncommitted changes.
2. **Collision with #360 capture-guard** — `check-subagent-return.ts` does a guarded gepa-core
   dynamic import (~1.5s timeout). New hook is child-side and MUST stay pure state-file
   read/write with ZERO gepa-core imports — keeps per-call cost near-zero (fires every tool
   call) and avoids double-counting the death signal #360 already captures parent-side.

## Suggested next
Human approves → author as a slice (autonomous_safe=false; prompt edits need human-in-loop
on review). Build order: new hook + logic + flag (testable in isolation) → wire hooks.json →
prompt/skill edits last. Add a unit test on the counter + a test that the systemMessage only
fires past threshold.

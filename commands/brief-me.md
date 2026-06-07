---
description: Preferred first command for a fixed-structure situational report on the current repo.
---

# Brief Me

This is the preferred user-facing "where are we?" command.

Use it when the user wants a fast, structured briefing before continuing work.

Workflow:

1. verify the current workspace path with `pwd`
2. sync remote state so the briefing reflects reality, not stale local refs:
   - `git fetch --prune`
3. run:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" brief-me --repo "$PWD"`
3. explicitly compare the returned `repoPath` with the current working directory
4. if they do not match, stop and treat the brief as invalid for this run
5. if they match, present the briefing in this fixed order:
   - `Current Objective`
   - `Recent Activity`
   - `In Progress`
   - `Blocked / Missing`
   - `Important Reminders`
   - `Recommended Next Step`
   - `Secondary Options`
   - `Run Health` — only if the report's `runHealth` field is non-null. Render as a one-line summary: `Run health: <runHealth value>`. Place this after `In Progress` and before `Blocked / Missing` so it surfaces immediately after the active workflow state.
   - `Autonomous Loop` — only if the report's `autonomousLoop` field is non-null. Render: backlog counts by state, top-priority triaged features (next to slice), in-flight features with linked slices, specs awaiting decomposition, last 5 grade averages + per-dimension snapshot if any are below 0.80, decision tallies, pattern alerts. If `autonomousLoop.costs.recent` is non-empty, also render `Recent Costs (last 5)` as a Markdown table with columns `Slice | Duration | Msgs | Total (M) | I/O (M) | Cache R/W (M) | Cache hit | Dominant model`, sourced from each entry's `runTitle`, `durationMin`+"m", `messages`, `totalMillions`, `ioMillionsStr`, `cacheRWMillionsStr`, `cacheHitPct`+"%", `dominantModelStr`. Do not surface USD in the row. If `autonomousLoop.costs.diagnostics` is non-empty, render a `Cost Diagnostics` table immediately after with columns `Slice | Calls | Fails | %Fail | Compact | Subag | Reread | p90 (b) | Preamble | Skills | Sessions | Flags`, sourced from each entry's `toolCalls`, `toolFailures`, `toolFailureRate`+"%", `compactionCount`, `subagentDispatches`, `fileReReadCount`, `toolResultP90`, `turnsBeforeFirstTool`, `skillInvocations`, `sessionsScanned`, `flagsStr`. Skip the diagnostics table when `diagnostics` is empty. When a cost entry's `modelMix` array has more than one entry, render the `Dominant model` cell as a compact multi-model list (`model: msgPct% / $usd`, separated by ` · `) instead of the single `dominantModelStr`. If `autonomousLoop.costs.modelBurn` has more than one entry, render a `Model Burn (last N)` Markdown table after the diagnostics block with columns `Model | Slices | Messages | USD`, sourced from each entry's `model`, `slices`, `messages`, `usd`. Use it to surface "where the money went" across recent slices.
   - `Recent Costs` — render when `autonomousLoop` is null but `costs.recent` is non-empty (cost reporting works without the loop plugin). Same Markdown tables as the autonomousLoop costs blocks (headline + diagnostics).
6. keep the report concise, concrete, and evidence-backed
7. use the git activity, artifact trail, workflow state, and repo memory to produce one clear next-step recommendation
8. in `Recent Activity`, include the most relevant repo-memory starting points or retrieval hints, not just git or artifact counts

The point is not to dump raw JSON. The point is to give the user a calm, situational briefing with the most relevant status and one concrete recommendation.

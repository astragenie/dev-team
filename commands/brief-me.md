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
   - `Autonomous Loop` — only if the report's `autonomousLoop` field is non-null. Render: backlog counts by state, top-priority triaged features (next to slice), in-flight features with linked slices, specs awaiting decomposition, last 5 grade averages + per-dimension snapshot if any are below 0.80, decision tallies, pattern alerts. If `autonomousLoop.costs.recent` is non-empty, also render `Recent Costs (last 5)`: per-entry slice/run title, USD, assistant-message count; followed by `Total $`, `Avg $` from `autonomousLoop.costs.sumUsdRecent` / `avgUsdRecent`.
   - `Recent Costs` — render when `autonomousLoop` is null but `costs.recent` is non-empty (cost reporting works without the autonomous-loop plugin). Same fields as the autonomousLoop costs block.
6. keep the report concise, concrete, and evidence-backed
7. use the git activity, artifact trail, workflow state, and repo memory to produce one clear next-step recommendation
8. in `Recent Activity`, include the most relevant repo-memory starting points or retrieval hints, not just git or artifact counts

The point is not to dump raw JSON. The point is to give the user a calm, situational briefing with the most relevant status and one concrete recommendation.

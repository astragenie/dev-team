# Task Handoff: performance improvement spec — 3-phase design complete, awaiting user direction

- Created: 2026-05-27T04:20:12.182Z
- From: lead
- To: lead
- Objective: Brainstormed plugin performance improvements as senior AI architect. Plan agent produced 3-phase spec: Phase 1 (hours) CLI lazy loading in crew.mjs; Phase 2 (days) context efficiency — lead prompt compaction-awareness, subagent budget, re-read prohibition, default repo-context handoffs, reviewer scoped-reads, cost-advisor cascade rule; Phase 3 (days) observability — performance letter grades, regression trend detectors, brief-me cost health. Key finding: check_git_gate.sh hook is consumer-repo only, not in plugin itself.
- Allowed Scope:
  - hero-crew plugin performance — CLI speed
  - context efficiency
  - observability
- Forbidden Scope: -
- Deliverable: Exploration data + 3-phase design from Plan agent. No code changes. Plan file at cryptic-tumbling-sundae.md needs updating with final spec before implementation.
- Changed Files:
  - none
- Confidence: medium
- Risks: User asked about plugin-dev usage mid-brainstorm — may be pivoting direction. Plan file still has old FEAT-002/003 content, needs overwrite with performance spec.
- Suggested Next Handoff: Resume: update plan file with performance spec, get user approval via ExitPlanMode, then implement phase by phase


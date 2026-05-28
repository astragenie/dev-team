# Task Handoff: Brainstorming paused — lead agent involvement design

- Created: 2026-05-28T16:40:50.895Z
- From: lead
- To: lead
- Objective: Design + spec how the lead agent can be more involved in build/fix commands — brainstorming skill in progress, no code yet
- Allowed Scope: agents/lead.md, commands/build.md, commands/fix.md, skills/workflow/, docs/superpowers/specs/
- Forbidden Scope: no code changes until design is approved by user
- Deliverable: Written spec at docs/superpowers/specs/YYYY-MM-DD-lead-involvement-design.md, committed, user-approved
- Changed Files:
  - agents/lead.md (read-only)
  - commands/build.md (read-only)
  - commands/fix.md (read-only)
  - skills/workflow/using-crew/SKILL.md (read-only)
- Confidence: high
- Risks: none — brainstorming only, no code changed this session
- Suggested Next Handoff: after spec written + user approved, invoke writing-plans skill for implementation plan

## Brainstorming State (paused mid-session)

**Trigger:** User ran `/superpowers:brainstorming` — "what is the role of lead agent in build or fix commands and overall. thinking how it can get more involved if needed"

**Task tracker:**
- Task 1 Explore project context — COMPLETED
- Task 2 Ask clarifying questions — IN PROGRESS (first question asked, awaiting answer)
- Task 3 Propose 2-3 approaches — pending
- Task 4 Present design + write spec — pending

**What was found (Task 1):**

Current lead in build/fix is coordinator + gate-keeper only — frames task, dispatches specialists, enforces gates, writes artifacts. Does not read files or implement directly in team-run mode. In single-session it does everything itself.

Key files read: `agents/lead.md` (215 lines), `commands/build.md` (84 lines), `commands/fix.md` (83 lines), `skills/workflow/using-crew/SKILL.md`.

**First clarifying question (Task 2, awaiting answer):**

> When you say "more involved" — which direction?
> 1. Tighter oversight — monitors builder mid-task, can interrupt/redirect
> 2. Scope judgment — challenges scope before dispatching, splits proactively
> 3. Quality enforcement — runs pre-flight checks (reads diff) before deciding to dispatch reviewer

## Resume Instructions

Re-ask the clarifying question if the user's answer is not in context. Continue Task 2 → 3 → 4. Write spec to `docs/superpowers/specs/`. After user approves, invoke writing-plans skill.


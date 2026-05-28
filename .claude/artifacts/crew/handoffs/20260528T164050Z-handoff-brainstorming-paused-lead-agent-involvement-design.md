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

## Brainstorming State (updated 2026-05-28, paused at decision point)

**Trigger:** User ran `/superpowers:brainstorming` — "what is the role of lead agent in build or fix commands and overall. thinking how it can get more involved if needed"

**Task tracker:**
- Task 1 Explore project context — COMPLETED
- Task 2 Ask clarifying questions — COMPLETED
- Task 3 Propose 2-3 approaches — COMPLETED (Approach B chosen: commands + lead.md)
- Task 4 Present design + write spec — IN PROGRESS (architecture ✓, components+data flow presented, awaiting approval)

**What was found (Task 1):**

Current lead in build/fix is coordinator + gate-keeper only — frames task, dispatches specialists, enforces gates, writes artifacts. Does not read files or implement directly in team-run mode. In single-session it does everything itself.

Key files read: `agents/lead.md` (215 lines), `commands/build.md` (84 lines), `commands/fix.md` (83 lines), `skills/workflow/using-crew/SKILL.md`.

**Q1 answered — directions chosen:**
User selected: **2 (scope judgment)** + **3 (quality enforcement)**. Not tighter mid-task oversight.

**Q2 answered — where to put it:**
User asked about option 3 (command steps + agent guidelines together). Lead gave risk analysis:
- Option 3 contradiction: skip logic in `lead.md` ends up doing all real work, making command steps decorative
- Fragility: inconsistent behavior depending on whether agent applies the skip correctly
- Better hybrid: scope-challenge as command step (cheap, just framing restatement), diff-check as guideline (expensive, judgment call on token cost)

**All clarifying questions resolved:**
- Q1: directions — **scope judgment (2) + quality enforcement (3)**
- Q2: where — **hard command steps** (both in `build.md`/`fix.md` procedure)
- Q3: option 3 risk — user heard the analysis and confirmed **hard command steps** regardless

**Design decisions locked:**
- Scope judgment (2) + quality enforcement (3) — confirmed
- Hard command steps — confirmed
- Approach B: commands + `lead.md` — confirmed

**Design sections status (Task 4):**
- Architecture — **APPROVED**: scope gate after framing, diff gate after builder handoff, skip via mark-badge
- Components + Data Flow — **PRESENTED, awaiting approval**: `build.md` + `fix.md` get 2 steps each; `lead.md` gets "Quality gates" section; data flow diagram shown
- Error handling — pending
- Testing — pending
- Spec write → self-review → user review → writing-plans — pending

**Current decision point:** user has NOT yet approved Components + Data Flow section. Session paused here.

## Resume Instructions

1. Re-ask: "Components + Data Flow look right, or adjust before error handling + testing?"
2. Once approved: present error handling section (what happens when diff gate routes back to builder — loop limit, escalation path).
3. Present testing section (how to verify gates work — integration test or manual smoke).
4. Write spec to `docs/superpowers/specs/YYYY-MM-DD-lead-involvement-design.md`.
5. Self-review (placeholders, contradictions, ambiguity, scope check).
6. Ask user to review the written spec file.
7. After user approval, invoke `writing-plans` skill.


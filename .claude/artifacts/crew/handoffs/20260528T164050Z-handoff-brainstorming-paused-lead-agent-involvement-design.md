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
- Task 2 Ask clarifying questions — IN PROGRESS (Q1 + Q2 answered, Q3 asked, awaiting final answer)
- Task 3 Propose 2-3 approaches — pending
- Task 4 Present design + write spec — pending

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

**Q3 (current, awaiting answer):**
> Does the risk analysis change your thinking — or do you want all three as hard command steps regardless?

User has NOT answered Q3 yet. Session paused here.

**Decision space entering Task 3:**
- If user accepts the hybrid: scope-challenge → command step in `build.md`/`fix.md`; diff-check → guideline in `lead.md`
- If user wants hard steps: both added to command procedures with explicit skip conditions
- If user wants guidelines only: both go into `lead.md` judgment rules, no command changes

## Resume Instructions

1. Re-read this handoff + check conversation for user's Q3 answer.
2. If Q3 still unanswered, re-ask: "Hard command steps for both, or hybrid (scope-challenge in command, diff-check in guideline)?"
3. Once Q3 answered, Task 2 is complete — move to Task 3 (propose 2-3 approaches with trade-offs).
4. Task 4: present design sections, get approval, write spec to `docs/superpowers/specs/YYYY-MM-DD-lead-involvement-design.md`, commit, self-review, get user sign-off.
5. After user approves spec, invoke `writing-plans` skill.


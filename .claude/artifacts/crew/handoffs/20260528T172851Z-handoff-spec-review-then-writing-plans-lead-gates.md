# Task Handoff: Spec review → writing-plans for lead scope+diff gates

- Created: 2026-05-28T17:28:51Z
- From: lead
- To: lead
- Objective: User reviews committed spec, then invoke writing-plans skill to produce implementation plan for scope gate + diff gate in build/fix commands
- Allowed Scope: commands/build.md, commands/fix.md, agents/lead.md (implementation phase only — after plan approved)
- Forbidden Scope: No code changes until writing-plans plan is approved; no changes outside the 3 allowed files
- Deliverable: Implementation plan from writing-plans skill, approved by user
- Changed Files:
  - docs/superpowers/specs/2026-05-28-lead-involvement-design.md (committed 569cfac)
- Confidence: high
- Risks: None — spec approved, no code changes yet
- Suggested Next Handoff: After implementation complete, invoke crew:review

## Spec State

Spec committed at `docs/superpowers/specs/2026-05-28-lead-involvement-design.md` (569cfac).

All 4 design sections were approved by user during brainstorming session:
- Architecture: scope gate at step 5, diff gate at step 14, skip badges
- Components + Data Flow: build.md + fix.md get 2 steps each; agents/lead.md gets "Quality gates" section
- Error handling: route-back with 1 retry then escalate; escalated_to_human badge; skip abuse caught by reviewer
- Testing: manual smoke for 4 scenarios; e2e:smoke + npm test as regression check

## Resume Instructions

1. Ask user: "Spec written and committed to `docs/superpowers/specs/2026-05-28-lead-involvement-design.md`. Please review it and let me know if you want changes before we start writing the implementation plan."
2. Wait for user approval.
3. On approval: invoke `writing-plans` skill (NOT any other skill — brainstorming terminal state is writing-plans only).
4. On change request: update spec, re-run self-review, re-commit, re-ask.

## Also Pending (separate from spec flow)

1. **Close FEAT-025**: stale duplicate of FEAT-004/SLICE-08 (shipped v0.3.10).
   - Move `docs/backlog/pending/FEAT-025.md` to `docs/backlog/done/FEAT-025.md`, update status → done.
   - Commit: `chore(backlog): close FEAT-025 — shipped as FEAT-004/SLICE-08 v0.3.10`.

2. **FEAT-024**: AC linter + slice template test gates. Lives in `hero-crew-autonomous-loop` repo.
   - `autonomous_safe: false` — requires human-in-loop on review.
   - Switch to `C:/work/mega/hero-crew-autonomous-loop` and run `/loop:start`.

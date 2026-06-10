# Task Handoff: Task 10: builder prompts — build bundle subsection

- Created: 2026-06-08T23:28:35.478Z
- From: builder
- To: lead
- Objective: Added ### Build bundle (post-handoff) subsection to all three builder agent prompts (builder, builder-be, builder-fe) with correct per-builder name in the example command.
- Allowed Scope:
  - agents/builder.md
  - agents/builder-be.md
  - agents/builder-fe.md — prompt-only edits inserting the build bundle instruction block after write-handoff
  - before the next ##-level section
- Forbidden Scope: -
- Deliverable: Three builder prompts updated; each contains the new subsection with the correct --builder flag value; all files remain under 300 lines; 522 tests pass; validate-agents PASS; validate-manifests PASS; commit ce6e3e0 on main
- Changed Files:
  - agents/builder.md
  - agents/builder-be.md
  - agents/builder-fe.md
- Confidence: high
- Risks: none
- Suggested Next Handoff: Task 11 — update commands/review.md and commands/validate.md to consume build bundles


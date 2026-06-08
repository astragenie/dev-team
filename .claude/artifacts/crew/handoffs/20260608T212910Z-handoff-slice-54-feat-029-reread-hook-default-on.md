# Task Handoff: SLICE-54 FEAT-029: reread hook default-on

- Created: 2026-06-08T21:29:10.823Z
- From: builder
- To: lead
- Objective: Flipped CREW_COST_HYGIENE check from opt-in (=1) to opt-out (=0) in both hook files
- Allowed Scope:
  - hooks/check-redundant-read.ts
  - hooks/record-read-content.ts
  - tests/cost-hygiene-hook.test.ts
  - CHANGELOG.md
- Forbidden Scope: -
- Deliverable: Both reread hooks fire by default; CREW_COST_HYGIENE=0 disables them; 5 new tests cover default-on and opt-out for both pre- and post-hooks
- Changed Files:
  - hooks/check-redundant-read.ts
  - hooks/record-read-content.ts
  - tests/cost-hygiene-hook.test.ts
  - CHANGELOG.md
- Confidence: high
- Risks: none
- Suggested Next Handoff: crew:reviewer


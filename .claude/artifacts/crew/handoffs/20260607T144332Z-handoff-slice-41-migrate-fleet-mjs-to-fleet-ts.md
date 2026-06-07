# Task Handoff: SLICE-41: Migrate fleet.mjs to fleet.ts

- Created: 2026-06-07T14:43:32.379Z
- From: builder
- To: lead
- Objective: Migrated scripts/lib/fleet.mjs to fleet.ts with full TypeScript types, no any, SRP splits on 3 oversized functions, all CI gates green (437 tests, typecheck clean, lint clean).
- Allowed Scope:
  - scripts/lib/fleet.mjs (delete)
  - scripts/lib/fleet.ts (create)
  - tests/fleet.test.mjs and scripts/crew.mjs (import path updates only)
- Forbidden Scope: -
- Deliverable: scripts/lib/fleet.ts with FleetItem interface, SliceProgressResult interface, FoundEntry interface; extractProgressFields and renderErrorRow/renderItemRow and deduplicateAndLoad helpers split out for SRP; fleet.mjs deleted; callers updated
- Changed Files:
  - scripts/lib/fleet.ts
  - scripts/lib/fleet.mjs (deleted)
  - tests/fleet.test.mjs
  - scripts/crew.mjs
- Confidence: high
- Risks: none
- Suggested Next Handoff: none — SLICE-41 closes Phase 2 of TS migration (FEAT-117). Lead may trigger Phase 3 or release.


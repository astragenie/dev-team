# Task Handoff: commands/ audit — idle-inducers, CLI drift, dead refs, ambiguity, overengineering

- Created: 2026-07-10T00:26:00.238Z
- From: researcher
- To: dispatcher
- Objective: Read all 29 authored command docs; found no direct interactive-skill dispatch instructions (idle category clean at the command-doc layer), but found real CLI-flag drift across write-review-result/write-final-synthesis, three incompatible reviewer decision vocabularies (approved/rejected vs PASS/FAIL vs passed/failed), badge names (fix_complete, fix_blocked, build_complete) that per prior investigation (#153/#186) the CLI rejects, and a stale direct-script invocation in architect-feature.md that bypasses the canonical /loop:slice start command.
- Allowed Scope:
  - commands/*.md (29 files)
  - excluding commands/3rdparty/* (skimmed only)
- Forbidden Scope: -
- Deliverable: Findings table (idle|drift|dead-ref|ambiguity|overengineering) with file:line citations, returned inline to caller
- Changed Files:
  - commands/build.md
  - commands/fix.md
  - commands/ship.md
  - commands/review.md
  - commands/validate.md
  - commands/architect-feature.md
  - commands/orchestrate-slice.md
  - commands/incident.md
  - commands/brief-me.md
- Confidence: medium
- Risks: CLI-flag drift claims are doc-vs-doc consistency findings only (not verified against actual crew.ts source in this pass, per task instructions saying a separate ground-truth extraction is in progress); badge-rejection claims for fix_complete/fix_blocked/build_complete are inferred from the user-supplied ground truth on #153/#186 (issue text says 'build_complete' badge etc. are referenced but CLI-unsupported), not independently re-verified against scripts/crew.ts in this pass
- Suggested Next Handoff: Cross-check the flag/badge drift table against a direct crew.ts source-of-truth extraction (dispatcher's parallel ground-truth track); patch write-final-synthesis flag set to be identical between build.md/fix.md and orchestrate-slice.md; unify reviewer decision vocabulary across build/fix/ship/incident/review docs


# Task Handoff: crew.ts CLI vocab ground truth (badges, decisions, flags)

- Created: 2026-07-10T00:26:35.188Z
- From: researcher
- To: dispatcher
- Objective: Extracted real crew.ts subcommand/flag/badge/decision vocab with file:line citations; confirms dev-team#153 and #186, plus finds help_request badge is a scaffold-template-only phrase not a real badge.
- Allowed Scope:
  - scripts/crew.ts (1610 lines) + scripts/lib/schemas.ts + scripts/lib/workflow-state.ts — top-level subcommands
  - review/validation decision flags
  - badge enum
  - review-metadata flags (FEAT-180)
  - and free-text arg handling. No edits made.
- Forbidden Scope: -
- Deliverable: Reference table (delivered inline in chat response) of vocab-item | real-value | file:line for CLI subcommands, --decision/--verdict enums, BADGE_TABLE (18 real badges), FEAT-180 not_checked/author_id/judge_id, and argv parsing behavior for --summary.
- Changed Files:
  - scripts/crew.ts
  - scripts/lib/schemas.ts
  - scripts/lib/workflow-state.ts
  - scripts/lib/installer/templates.ts
- Confidence: high
- Risks: Did not exhaustively read every ARTIFACT_HANDLERS branch in workflow-state.ts (e.g. write-deployment-check decision vocab) or full write-final-synthesis body — usage strings at crew.ts:371-372 give the flag surface but the internal decision enum for deployment-check was not independently verified beyond the usage string. installer/templates.ts help_request/build_complete/fix_complete/ship_blocked strings are scaffold text shipped into new consumer repos' constitution.md, not validated against BADGE_TABLE — worth a follow-up drift check since that template is itself a drift source.
- Suggested Next Handoff: Diff agents/*.md against this table (dispatcher owns FEAT-186/#153 fix); also flag scripts/lib/installer/templates.ts:98-101 (help_request scaffold text) as a second drift source distinct from agent prompts.


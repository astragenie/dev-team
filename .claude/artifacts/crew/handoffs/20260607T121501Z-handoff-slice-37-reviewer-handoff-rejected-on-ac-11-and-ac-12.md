# Task Handoff: SLICE-37 reviewer handoff: rejected on AC-11 and AC-12

- Created: 2026-06-07T12:15:01.869Z
- From: reviewer
- To: lead
- Objective: Rejected SLICE-37 installer .ts migration: two explicit ACs (AC-11 Result<T,E>, AC-12 function length) not met despite clean CI.
- Allowed Scope:
  - Independent review of 8 installer .ts files plus caller updates in crew.mjs and tests/installer.test.mjs
- Forbidden Scope: -
- Deliverable: Review-result artifact at .claude/artifacts/crew/reviews/20260607T121452Z-review-result-slice-37-review-installer-core-modules-ts-migration.md. Decision: rejected.
- Changed Files:
  - scripts/lib/installer/audit.ts
  - scripts/lib/installer/claude-md.ts
  - scripts/lib/installer/harness-files.ts
  - scripts/lib/installer/legacy-migration.ts
  - scripts/lib/installer/repo-guides.ts
  - scripts/lib/installer/settings.ts
  - scripts/lib/installer/global.ts
  - scripts/lib/installer.ts
  - scripts/crew.mjs
  - tests/installer.test.mjs
- Confidence: high
- Risks: AC-11 and AC-12 are backlog-level acceptance criteria, not style preferences. Accepting without them would close the slice with two unmet gates and no remediation plan.
- Suggested Next Handoff: crew:fix — implement ensureGlobalImports helper to split installGlobal, apply Result<T,E> to resolveHomeDir and bootstrapRepo, then re-submit for review.


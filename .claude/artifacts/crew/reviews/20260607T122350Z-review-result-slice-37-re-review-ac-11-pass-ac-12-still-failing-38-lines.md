# Review Result: SLICE-37 re-review: AC-11 PASS, AC-12 still failing (38 lines)

- Created: 2026-06-07T12:23:50.053Z
- Reviewer: reviewer
- Decision: rejected
- Summary: AC-11 is fully resolved; AC-12 is not — installGlobal() body is 38 lines, exceeding the <=30 line SRP threshold in the spec.
- Evidence Checked:
  - global.ts:resolveHomeDir() returns Result<string
  - 'no-home-dir'> (lines 46-50); both callers unwrap with if(!homeResult.ok)throw (lines 63
  - 98); bootstrapRepo() in installer.ts returns Promise<Result<...
  - 'repo-not-found'>> (lines 22-35); crew.mjs caller unwraps with if(!result.ok){console.error+process.exit(1)} (lines 446-450); ensureGlobalImports() extracted as private async helper (lines 136-160); installGlobal() body is lines 97-134 = 38 lines
  - AC-12 spec requires functions <=30 lines; builder self-reported ~31 lines which is inaccurate; global.ts file is 186 lines (under 300 limit); installer.ts is 99 lines (under 300 limit); tsc/lint/tests stated green by builder
- Files Reviewed:
  - scripts/lib/installer/global.ts
  - scripts/lib/installer.ts
  - scripts/crew.mjs
- Test Adequacy: 433/433 passing per builder CI report; tsc --noEmit exit 0; lint 0 warnings; existing suite covers refactored paths — no net-new public surface, TDD gate not triggered
- Risks: installGlobal() is still 8 lines over the SRP threshold; builder mis-stated count as ~31 in handoff
- Required Follow-up: Split installGlobal() body further — e.g. extract the three writeFileIfChanged blocks into a private writeGlobalFiles(paths, writes) helper to bring installGlobal() under 30 lines; then resubmit


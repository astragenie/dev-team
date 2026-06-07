# Review Result: SLICE-37 review: installer core modules .ts migration

- Created: 2026-06-07T12:14:52.878Z
- Reviewer: reviewer
- Decision: rejected
- Summary: Two ACs unmet: AC-11 (Result<T,E> not applied to meaningful domain errors) and AC-12 (installGlobal at 64 lines violates the >30-line split rule)
- Evidence Checked:
  - Checked all 8 .ts files for any/implicit-any (clean)
  - Result usage (none found)
  - function lengths (installGlobal=64 lines
  - initRepo=37 lines)
  - caller updates in crew.mjs and tests (correct). Re-ran tsc
  - npm run lint
  - node --test: all exit 0
  - 433/433 passing. Health dashboard: 10/10 composite.
- Files Reviewed:
  - scripts/lib/installer/audit.ts
  - scripts/lib/installer/claude-md.ts
  - scripts/lib/installer/harness-files.ts
  - scripts/lib/installer/legacy-migration.ts
  - scripts/lib/installer/repo-guides.ts
  - scripts/lib/installer/settings.ts
  - scripts/lib/installer/global.ts
  - scripts/lib/installer.ts
- Test Adequacy: 433/433 passing, tsc clean, lint clean — existing test suite covers all migrated functions; no net-new behavior so no new tests required
- Risks: AC-11 and AC-12 are explicit acceptance criteria on the FEAT-113 backlog item, not advisory suggestions. Shipping without them misrepresents the slice as complete and leaves Result<T,E> adoption deferred with no clear trigger.
- Required Follow-up: Fix 1: Extract the CLAUDE.md mutation block from installGlobal (lines 123-145) into a named helper (e.g. ensureGlobalImports). Fix 2: Apply Result<T,E> to resolveHomeDir (missing env var) and bootstrapRepo (missing path) — the two clearest recoverable domain errors. Then re-submit for review.


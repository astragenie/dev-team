---
id: PM-REVIEW-FEAT-198
feature: FEAT-198
reviewed_at: 2026-07-08
pm_customer_impact: 0.7
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.7
pm_technical_risk: 0.65
pm_dependency_depth: 0.45
composite_priority: P1
autonomous_safe: false
---
# PM Review — FEAT-198

## Demand Assessment

- **Evidence:** Task context + own memory: 'capture-parity Windows byte-filter, bun-homedir-ignores-home-on-linux (canonical locally-green-not-equal-CI-green trap), benchmark p95 skipped Windows+CI.' MEMORY.md entry bun-homedir-ignores-home-on-linux.md confirms this is a real, previously-hit bug: 'Bun-on-Linux os.homedir() ignores reassigned HOME (passwd/uid); honors USERPROFILE on Windows -- the canonical locally-green != CI-green trap.' Verified directly: grepped .github/workflows/test.yml for jobs:|runs-on:|matrix: and found only a single `jobs:` line with no runs-on/matrix entries, confirming the FEAT's claim of one self-hosted OS.

## Scope Challenge

- **Scope notes:** Overlap check (important): FEAT-190 (pending, P2, read on disk) SLICE-C already scopes 'keep/enable a Windows job' in .github/workflows/test.yml and its cross-repo reusable-plugin-ci.yml@main, and SLICE-E scopes 'Windows smoke as blocking gate.' FEAT-198's incremental value over FEAT-190 is the NEW Linux job plus the golden byte-parity/homedir assertions -- scope this FEAT to explicitly depend on or coordinate with FEAT-190 SLICE-C/E rather than re-adding a duplicate Windows job. Smallest deliverable: one additional Linux CI job (or dedicated golden test) asserting resolveHomeDir() env-first behavior + capture byte-parity; cut benchmark-p95 enablement if forced to halve (log a skip-reason instead, see AC-3). Effort analog: FEAT-190's own triage notes size its Windows-CI-plus-cross-repo-coordination sub-scope (SLICE-C) at 1.0 dev-day + coordination as one slice inside a 0.45 overall effort FEAT -- FEAT-198 is narrower (adds Linux, reuses/coordinates on the Windows piece) but still carries the same cross-repo astragenie/common coordination risk, so effort 0.55 is set slightly below FEAT-190's whole-migration 0.45-weighted mechanical bulk but above a single-repo-only CI edit.

## Scores

- customer_impact: 0.70
- effort_estimate: 0.55
- strategic_alignment: 0.70
- technical_risk: 0.65
- dependency_depth: 0.45

## Priority Derivation

composite_priority: P1
autonomous_safe: false
reasoning: technical_risk 0.65, band 0.6-0.8 (cross-module reach: touches .github/workflows/test.yml AND likely the cross-repo astragenie/common reusable workflow, matching FEAT-190's own risk table entry 'Cross-repo astragenie/common reusable CI doesn't accept Bun -- Med'). composite_score=0.6075 -> P1 via (impact>=0.7 AND alignment>=0.6); pre-mortem mandatory both via P1 and via risk>=0.6. autonomous_safe=false: technical_risk (0.65) exceeds the 0.6 numeric gate, and this touches the CI workflow definition itself (not just a script CI invokes), matching the repo's own precedent on FEAT-190 (CI-touching work marked autonomous_safe:false).

## Risks

- Pre-mortem Q1 (failed review in 2 weeks): most likely cause is the new Linux job passing only because CI hard-codes HOME before Bun starts (masking the bug) rather than fixing resolveHomeDir() to be env-first as the existing memory note prescribes -- that would be a CI-only workaround leaving the real library bug live for consumers.
- Pre-mortem Q2 (rollback if merged and broke the loop): NOT revert-only -- if astragenie/common's reusable-plugin-ci.yml needs updating too (same cross-repo dependency FEAT-190 SLICE-C already names), rollback requires a coordinated revert in both dev-team and astragenie/common per the astra-marketplace HARD RULE cross-repo constraint.
- Pre-mortem Q3 (coverage gap): confirmed via direct grep that .github/workflows/test.yml has zero runs-on/matrix entries today -- no existing test exercises Linux or a second OS, so any platform-specific regression is currently invisible; AC-4 below is written specifically to prove the new matrix actually discriminates platform-specific breakage rather than just re-running the same assertions twice.

---
findings: "🔴:0,🟡:2,❓:0"
status: completed
decision: rejected
---
# Review Result: Review Result

- Created: 2026-07-08T08:59:35.799Z
- Reviewer: reviewer
- Decision: rejected
- Status: completed
- Summary: Slice-ceremony e2e is well-built where it runs, but the two coverage-integrity risks flagged for review both confirmed real: the scenario is fully inert in CI (no ../runner-plugin sibling checkout anywhere in .github/workflows or the astragenie/common reusable workflow), and AC-3's cost-report check never verifies attribution scoping to the slice — both need a fix before this can be trusted as a regression gate.
- Evidence Checked:
  - Confirmed via 'grep -rn runner-plugin .github/' (0 hits) and fetched astragenie/common/reusable-plugin-ci.yml (single actions/checkout@v5
  - no sibling checkout step) that CI has no ../runner-plugin on disk
  - so scenarioSliceCeremony() SKIPS every CI run (e2e-smoke.ts:582-587) while staying green. AC-1's run-brief check (line 627-636) and AC-3's cost-report check (line 673-682) are both soft — log-only on absence
  - no assert — and AC-3 never checks the report is scoped to sliceId/currentRun even when present
  - despite the AC text explicitly requiring 'attribution attaches to SLICE-X
  - not a stale window'. AC-2/AC-4 (gate satisfaction
  - slice/feature moves
  - grade frontmatter) are real state-transition asserts
  - not vacuous existence checks. Confirmed locally: bun run typecheck exit 0; node ./scripts/e2e-smoke.ts prints AC-1..4 PASS on this machine (sibling checkout present here).
- Files Reviewed:
  - scripts/e2e-smoke.ts
- Test Adequacy: New scenarioSliceCeremony() adds real state-transition assertions for AC-2/AC-4 but the entire scenario never executes in CI (silent skip) and AC-3's cost-report check omits the scoping assertion the AC requires; net effect is the slice's stated purpose (catch ceremony regressions in CI) is not delivered as shipped.
- Risks: Ceremony regressions (broken slice start/complete/grade, wrong cost attribution) can land on main with this scenario green in CI, because it never runs there — false sense of coverage is exactly the failure mode this review was dispatched to catch. Secondary risk: even on a dev machine with the sibling present, a cost-report misattributed to a stale run/wrong slice would not be caught (AC-3 only checks directory non-empty).
- Required Follow-up: 1) Make the CI-topology gap fail loud instead of silently skip: gate the skip on an explicit opt-out (e.g. only allow the SKIP path when a documented local-dev flag/absence is expected, and hard-fail under CI=true/GITHUB_ACTIONS=true), or wire an actual ../runner-plugin checkout step into the CI job so the scenario has something to exercise. 2) Tighten AC-3 to assert the cost-report file's content references the rotated sliceId/currentRun (not just directory non-empty), and stop treating AC-1's run-brief and AC-3's cost-report presence as soft-log-only — at minimum assert in environments where findHeroCrewCli is known to resolve (e.g. this CI image), rather than universally softening. Re-request review after these two fixes.


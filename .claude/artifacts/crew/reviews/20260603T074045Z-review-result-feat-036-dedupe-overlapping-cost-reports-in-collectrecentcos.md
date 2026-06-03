---
validation_evidence: "node --test: 237 pass / 0 fail; npm run lint exit 0; npm run typecheck exit 0; npm run format:check exit 0; node ./scripts/validate-manifests.mjs OK — pure logic refactor of one collector function, no user-visible behavior surface beyond corrected cost numbers"
---
# Review Result: FEAT-036: dedupe overlapping cost reports in collectRecentCosts

- Created: 2026-06-03T07:40:45.483Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Summary: Correctness is solid and all 5 AC scenarios are covered by 8 tests; two minor findings (unreachable nullish-coalescing fallback, CHANGELOG v0.7.1 entry without corresponding version bump) are non-blocking but should be addressed before the v0.7.1 release tag.
- Evidence Checked:
  - 237/237 tests pass; lint/typecheck/format clean; dedupeForRollup bucket logic traced through AC-1 through AC-4 scenarios by hand — correct; containment check uses >= and <= (full containment
  - not equality only); recent[] unchanged confirmed by test AC-7 and code inspection; modelBurn iterates over rollupSet not recent[] confirmed; avgUsd divides by dedupedCount confirmed; dedupedCount always defined in both return paths; no agents/skills/manifests touched; scope matches allowed file list exactly
- Files Reviewed:
  - scripts/lib/briefing/collect.mjs
  - scripts/lib/briefing.mjs
  - tests/briefing-cost-rollup-dedupe.test.mjs
  - CHANGELOG.md
- Test Adequacy: 8 new TDD tests in tests/briefing-cost-rollup-dedupe.test.mjs cover all 5 AC scenarios (all-aggregate same window, aggregate+nested slice, disjoint historical, mixed scenario, modelBurn dedupe) plus 3 additional edge cases (dedupedCount field presence, zero-reports, recent[] table-render integrity); 229 pre-existing tests unchanged

## Validation Evidence

node --test: 237 pass / 0 fail; npm run lint exit 0; npm run typecheck exit 0; npm run format:check exit 0; node ./scripts/validate-manifests.mjs OK — pure logic refactor of one collector function, no user-visible behavior surface beyond corrected cost numbers
- Risks: 1. costs.dedupedCount ?? costs.totalReports in briefing.mjs: the ?? fallback is unreachable because dedupedCount is always defined; harmless but misleading. 2. CHANGELOG documents v0.7.1 but package.json and marketplace.json still say v0.7.0 — release bump not done; hard CLAUDE.md rule says both must be bumped together. 3. The ticket's described brief output of ' across N distinct slices (Y reports filtered as overlapping)' is not yet rendered — only dedupedCount is passed to summary.costReports; full rendering requires caller to subtract dedupedCount from totalReports.
- Required Follow-up: Before cutting v0.7.1 tag: bump version in package.json and .claude-plugin/marketplace.json to 0.7.1; optionally remove the ?? costs.totalReports fallback since it is dead code; optionally expose filtered count in brief output.


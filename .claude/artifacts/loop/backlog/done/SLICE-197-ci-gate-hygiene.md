---
id: SLICE-197
parent: ARCH-REVIEW-2026-07-04
status: done
priority: P2
created: 2026-07-04
title: "CI-gate hygiene — routing-table blocking check (§2.7) + delete validate-typegraph (§2.8) + wire validate-adr-template (§2.9) + backlog-drift check (§2.10)"
stack: typescript + yaml + markdown
autonomous_safe: true
est_days: 1
depends_on: []
touches_files:
  - .github/workflows/test.yml
  - scripts/validate-routing-table.ts
  - scripts/validate-typegraph.ts
  - scripts/validate-adr-template.ts
  - scripts/validate-backlog-drift.ts
  - docs/routing-table.md
  - docs/architecture/decisions/ADR-001-parallel-runner-allowlist.md
  - docs/architecture/decisions/ADR-002-bun-runtime-no-go.md
  - tests/validate-routing-table.test.ts
  - tests/validate-backlog-drift.test.ts
---

# SLICE-197: CI-gate hygiene (arch §2.7–2.10)

Single owner of `.github/workflows/test.yml` (bundles all CI-workflow edits so the
parallel wave has no test.yml conflict).

## Acceptance criteria
- AC-1 (§2.7): `validate-routing-table.ts` gains a check that every `agents/*.md` basename appears in ≥1 `docs/routing-table.md` row; its CI step is BLOCKING (moved out of `advisory-validators`); the 7 missing agents (aiplugin-dev, architect-reviewer, c-sharp-reviewer, dev-lite, inspector-lite, performance-engineer, typescript-reviewer) are backfilled into the table so the gate is green.
- AC-2 (§2.8): `scripts/validate-typegraph.ts` deleted; its `advisory-bun-commands` CI entry removed; `bun run typecheck` still blocks (unchanged).
- AC-3 (§2.9): `validate-adr-template.ts` expected heading renamed to `## Alternatives considered` (matches ADR-001/002); validator wired into `advisory-validators`; runs green against both existing ADRs.
- AC-4 (§2.10): new `scripts/validate-backlog-drift.ts` diffs `triaged/` slice IDs vs `git log --grep "close SLICE"` hits and flags mismatches; wired advisory; test covers a synthetic drift.
- AC-5: `bun run lint` + `bun run typecheck` clean; new validators exit 0 on current repo; new tests pass.

## Notes
Retroactive `triaged/`→`done/` file moves are done in the plan's pre-flight, NOT here. This slice only adds the DRIFT-DETECTION so it can't recur.

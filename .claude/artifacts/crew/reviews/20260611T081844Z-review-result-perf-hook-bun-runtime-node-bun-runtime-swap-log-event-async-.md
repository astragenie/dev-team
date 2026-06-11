---
findings: "🔴:0,🟡:0,❓:1"
---
# Review Result: perf/hook-bun-runtime: node->bun runtime swap + log_event async-fire

- Created: 2026-06-11T08:18:44.870Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Summary: All 7 ACs verified; 9 commits are structurally correct, regression-safe, and spec-compliant. One LOW finding: CHANGELOG claims Windows p50 threshold <=100ms but the bench test asserts <=120ms.
- Evidence Checked:
  - git diff main..HEAD all 10 changed files; programmatic hooks.json AC-1 check (0 node entries
  - 5 bun entries); lifecycle entries unchanged on bash; hook entry shims byte-identical to main; assertBunPresent version logic verified 6 edge cases; disown-under-set-euo confirmed safe; bun-preflight PATH-strip test present; node:test convention matched; CI matrix shell placement verified
- Files Reviewed:
  - hooks/hooks.json
  - scripts/log_event.sh
  - scripts/lib/installer/bun-preflight.ts
  - scripts/crew.ts
  - .github/workflows/test.yml
  - tests/bun-preflight.test.ts
  - tests/hook-cold-start-bench.test.ts
  - tests/log-event-async-bench.test.ts
  - README.md
  - CHANGELOG.md
- Test Adequacy: 3 new tests: bun-preflight.test.ts (happy-path + PATH-strip), hook-cold-start-bench.test.ts (100-spawn p50/p95 OS-aware), log-event-async-bench.test.ts (100-run p95 OS-aware). All node:test consistent with repo. hook-feature-gating.test.ts byte-identical to main (AC-2). TDD gate satisfied per plan tasks 1+2.
- Risks: CHANGELOG Windows p50 mismatch (doc-only). Bare node/bun run steps on Windows runner omit shell: bash but are pre-existing Node/Bun CLI invocations — not introduced by this branch.
- Required Follow-up: Fix CHANGELOG.md line: change p50 <=100ms (Windows) to <=120ms to match test assertion. No blocking items.


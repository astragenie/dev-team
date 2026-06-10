---
id: FEAT-148
status: pending
priority: P1
category: workflow
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
---
# FEAT-148: Builder self-verify scoped to touched files via bun (not whole suite)

Problem: when spec-writer hands a build job to crew:builder, the builder runs build + tests + lint broadly (whole suite / whole tree) on every turn — slow and redundant.

Goal: the builder should build/test/lint only the files it touched or added in the slice, using bun. Full verification stays at the reviewer/validator gate.

Scope:
- Builder self-verify scoped to changed/added paths only:
  - tests -> `bun test <touched test files>` (or the tests covering touched src)
  - lint -> eslint / bun lint on changed paths only
  - typecheck/build -> scoped to touched files where feasible
- Full-suite + full-lint remain the parent loop's reviewer/validator gate (UNCHANGED) — this only narrows the builder's inline self-check.
- 'Touched/added' derived from the slice's git diff (staged + unstaged vs base).
- Bun-first: assume `bun test --timeout 60000` + bun lint; honor the project preset.
- Primary lever: agents/builder.md self-verify-gate section (+ builder-fe/builder-be); the loop slice-start dispatchInstruction should state verify-only-touched-files-via-bun.

Acceptance:
- The dispatch instruction to crew:builder explicitly states verify-only-touched-files-via-bun.
- Builder does not run the whole suite / whole-tree lint on its turn.
- Reviewer/validator still run full verification (safety net intact).
- Works on the bun preset.

Caveat (by design): scoping the builder's own tests to touched files trades safety for speed — a change can break a test in an untouched file. Mitigated by keeping the full reviewer/validator gate intact before merge.
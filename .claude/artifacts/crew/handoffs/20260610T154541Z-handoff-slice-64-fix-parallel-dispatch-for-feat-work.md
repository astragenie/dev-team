# Task Handoff: SLICE-64: Fix parallel dispatch for FEAT work

- Created: 2026-06-10T15:45:41.801Z
- From: builder
- To: lead
- Objective: Implemented Path A: rewrite commands/parallel.md step 7 to dispatch crew:lead per worktree directly in one parallel Agent block (no parallel-runner), scope parallel-runner to non-FEAT work
- Status: completed
- Allowed Scope:
  - commands/parallel.md step 7 rewrite; agents/parallel-runner.md scope note; README/skill description/routing-table updates; test verification
- Forbidden Scope: -
- Deliverable: Path A implementation complete: crew:lead per-worktree dispatch, no guard-feat-dispatch hook conflicts, parallel-runner preserved for non-FEAT use
- Changed Files:
  - agents/parallel-runner.md
  - commands/parallel.md
  - docs/routing-table.md
- Confidence: high
- Risks: none — Path A proven in loopobserver; all tests pass; no spec changes needed
- Suggested Next Handoff: FEAT-136 now ready for SLICE-64 reviewer/validator gates; FEAT-137 (principled allowlist) remains separate


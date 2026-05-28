# Review Result: Task 3 spec compliance review — check-redundant-read.mjs

- Created: 2026-05-28T20:26:59.142Z
- Reviewer: reviewer
- Decision: rejected
- Summary: Hook violates spec on recordRead arity and exposes an internal state.mjs function as a direct call; 9 of 11 checks pass.
- Evidence Checked:
  - Check 7: hook calls recordRead with 5 args (spec: 4-arg signature
  - no 'now' param); hook also calls evictLRU directly which spec marks as internal (state.mjs line 193). Check 10: reread test fabricates state manually rather than routing through PostToolUse — content-quote integration path not exercised. Checks 1-6 and 8-9 and 11 all pass: env-var gate at line 74
  - input shape validated
  - path.resolve cwd+file_path
  - stat catch exits 0
  - storedEntry via state.entries[absPath]??null
  - JSON output on warn
  - empty stdout on pass
  - main().catch exits 0
  - three log event codes present
  - scope confined to .claude/state/cost-hygiene/.
- Files Reviewed:
  - hooks/check-redundant-read.mjs
  - tests/cost-hygiene-hook.test.mjs
- Test Adequacy: 4 required scenarios present (no-env-var, first-read, reread-warns, malformed-stdin); reread scenario fabricates state rather than routing through PostToolUse, leaving content-quoting integration untested end-to-end.
- Risks: recordRead 5-arg call may silently pass if state.mjs ignores the extra arg, masking the contract mismatch until state.mjs enforces arity; evictLRU coupling to internal API breaks encapsulation.
- Required Follow-up: Fix recordRead call to 4 args (drop nowIso); remove direct evictLRU call if it is not in the public surface — check state.mjs public API and adjust hook accordingly; then re-review.


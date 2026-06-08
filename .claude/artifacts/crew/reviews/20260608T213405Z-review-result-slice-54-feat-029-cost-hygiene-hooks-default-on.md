---
findings: "🔴:0,🟡:2,❓:0"
---
# Review Result: SLICE-54 FEAT-029: cost-hygiene hooks default-on

- Created: 2026-06-08T21:34:05.199Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Summary: Guard flip from !== '1' to === '0' is correct in both hooks, default-on behavior verified, 5 new tests cover both ACs; two historical docs and two pre-existing tests use old opt-in language but are not regressions.
- Evidence Checked:
  - Diff verified: hooks/check-redundant-read.ts and record-read-content.ts both changed from !== '1' to === '0' guard; CHANGELOG updated in top section and historical v0.3.11 entry; tests/cost-hygiene-hook.test.ts adds 5 tests (lines 42-58
  - 61-84
  - 86-109
  - 232-263
  - 265-285) covering default-on and CREW_COST_HYGIENE=0 opt-out for both hooks; git diff --stat shows 5 files
  - all within declared scope; no remaining !== '1' guard in source files; historical design spec and investigation doc retain opt-in language but were not in scope and are accurate history
- Files Reviewed:
  - hooks/check-redundant-read.ts
  - hooks/record-read-content.ts
  - tests/cost-hygiene-hook.test.ts
  - CHANGELOG.md
- Test Adequacy: 5 new tests added: 2 covering pre-hook default-on (no env var) and opt-out (CREW_COST_HYGIENE=0), 2 covering post-hook default-on and opt-out, plus 1 covering missing-file silent no-op; pre-existing tests at lines 111-167 pass CREW_COST_HYGIENE=1 (now a no-op value) and remain functionally correct but semantically stale
- Risks: Two historical docs (design spec + investigation) still describe opt-in behavior — not regressions but may mislead future readers; stale test comment on line 1 of test file (.mjs) and two pre-existing tests describe CREW_COST_HYGIENE=1 as 'env-var on' which is now a no-op label
- Required Follow-up: Optional follow-up: update historical design spec and investigation doc to note the default-on promotion; relabel pre-existing tests from 'env-var on' to 'hook active (CREW_COST_HYGIENE not 0)'


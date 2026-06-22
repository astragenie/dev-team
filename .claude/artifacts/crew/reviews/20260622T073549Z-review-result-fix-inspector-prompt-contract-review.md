---
findings: "🔴:0,🟡:3,❓:1"
status: completed
---
# Review Result: Review Result

- Created: 2026-06-22T07:43:11.554Z
- Reviewer: inspector
- Decision: approved_with_notes
- Status: completed
- Summary: Build/fix/ship overhaul, inspector prompt hardening, and lead hard-cut are structurally sound; two medium findings block CI: a missed test update causes a 1-test failure, and the ship.md auto-fix FAIL path routes to c-sharp-reviewer (a reviewer role) instead of the backend-dev builder.
- Evidence Checked:
  - Gates run: bun test (83 pass on targeted files; 1 fail in dispatch-timing-pre-tap.test.ts:82 — lookupAgentModel crew:lead → sonnet fails because lead.md deleted but test not updated); validate-agents OK (19 agents); validate-manifests OK; typecheck clean. Core findings: (1) tests/dispatch-timing-pre-tap.test.ts line 82 — crew:lead lookup test not removed when lead.md was deleted in d5889d4; confirmed regression by verifying the commit touched neither the test file nor the lookup function. (2) commands/ship.md line 94 — Either FAIL path maps '.cs diff → crew:c-sharp-reviewer (then builder = crew:backend-dev)'; c-sharp-reviewer is a reviewer not a builder; the parenthetical correction is ambiguous and contradicts the build.md/fix.md routing tables which correctly say .cs → crew:backend-dev directly. (3) hooks/pre-push-verifier.ts line 106 — comment says 'Keep scanning — there may be an older PASS behind a recent non-pass' but the code immediately returns on the first non-pass; scanning stops at the newest file
  - so a recent FAIL masks any older PASS within the 1h window; labeled MEDIUM (reliability) because the bypass env var CREW_PUSH_VERIFY=0 exists and the window is only 1h. (4) agents/inspector.md Report contract (line 174) mandates confidence + confidence_reason in the LAST write-review-result call but the LAST call template at lines 55-64 does not include --confidence flag; the CLI supports --confidence but not --confidence-reason (no flag in crew.ts); gap between prose requirement and template could cause inspectors to omit confidence. Positive: lead hard-cut is clean — 0 residual 'the lead'/'crew:lead' refs in all 19 active agents (validate-agents CI gate + parametrized test both confirm); NO_LEAD_REF_REQUIRED sets match exactly between validator and test file; inspector FIRST+LAST contract preserved; c-sharp-reviewer FIRST+LAST contract internally consistent with correct --reviewer flag; ship.fix_retry_limit documented in deployment.md with hard cap 5; pre-push verifier hook correctly placed under PreToolUse Bash matcher and has CREW_PUSH_VERIFY=0 bypass.
- Files Reviewed:
  - commands/build.md
  - commands/fix.md
  - commands/ship.md
  - agents/inspector.md
  - agents/c-sharp-reviewer.md
  - agents/inspector-verifier.md
  - agents/lead.md (deleted)
  - hooks/pre-push-verifier.ts
  - hooks/hooks.json
  - scripts/validate-agents.ts
  - tests/agent-prompt-content.test.ts
  - tests/agent-topology.test.ts
  - tests/validate-agents.test.ts
  - tests/dispatch-timing-pre-tap.test.ts (NOT updated — regression)
- Test Adequacy: Targeted tests (agent-prompt-content, agent-topology, validate-agents) all pass 83/83. Full suite reveals 1 regression: dispatch-timing-pre-tap.test.ts:82 lookupAgentModel crew:lead→sonnet fails because lead.md deleted but the test was not removed in the hard-cut commit d5889d4. No test exists for pre-push-verifier.ts hook (new file, behavioral test warranted but not present).
- Risks: Test failure will block CI on this branch if full suite runs. Ship.md routing ambiguity could cause dispatcher to invoke c-sharp-reviewer in the auto-fix build slot, which would return a review artifact instead of a code fix, breaking the retry loop.
- Required Follow-up: Required before merge: (1) Remove or update test at tests/dispatch-timing-pre-tap.test.ts:82 — change to expect undefined/null or delete the test alongside the agent. (2) Fix commands/ship.md line 94 — change to '.cs diff → crew:backend-dev' to match build.md/fix.md routing tables. Recommended: (3) Fix pre-push-verifier.ts line 106 — continue loop instead of returning, or correct the comment to match actual first-hit behavior. (4) Add --confidence to LAST call template in inspector.md lines 55-64, and clarify whether confidence_reason is a CLI flag or artifact prose.


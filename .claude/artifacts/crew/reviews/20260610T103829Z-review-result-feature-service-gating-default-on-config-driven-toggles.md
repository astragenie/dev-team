---
findings: "🔴:0,🟡:0,❓:0"
---
# Review Result: Feature-service gating — DEFAULT-ON config-driven toggles

- Created: 2026-06-10T10:38:29.051Z
- Reviewer: reviewer
- Decision: approved
- Summary: isEnabled/readCrewConfig design and hook integration conform to design contract. All 573 tests pass; lint and typecheck clean. Stdout hygiene verified; env-var override precedence preserved. Default-ON policy with backward-compat confirmed.
- Evidence Checked:
  - ✓ isEnabled: DEFAULT-ON correctness (null/undefined/missing/malformed → true; explicit false → false); stderr diagnostics only; behavior parity with loop/features-service.mjs verified. ✓ readCrewConfig: never throws (catch returns {}); malformed JSON + missing file handled. ✓ check-redundant-read gate: reads config
  - feature gate after cwd known
  - env-var CREW_COST_HYGIENE checks BEFORE feature gate (precedence preserved)
  - no stdout on disabled path. ✓ check-subagent-return gate: env-var CREW_SUBAGENT_INLINE_THRESHOLD=0 checks BEFORE feature gate
  - feature gate suppresses warning emission when disabled. ✓ preflight-shell gate: env-var CREW_TOOL_PREFLIGHT=0 checks BEFORE feature gate
  - feature gate suppresses check emission when disabled. ✓ crew.json defaults: redundant-read-stop=false (no-op by default)
  - subagent-inline-warn=true (fires)
  - shell-preflight=true (fires). ✓ Backward-compat: missing crew.json → empty config → all features default-ON → original behavior. ✓ Tests: 573/573 pass. ✓ Lint: clean. ✓ Typecheck: clean.
- Files Reviewed:
  - scripts/lib/features-service.ts
  - .claude/crew.json
  - hooks/check-redundant-read.ts
  - hooks/check-subagent-return.ts
  - hooks/preflight-shell.ts
  - tests/features-service.test.ts
  - tests/hook-feature-gating.test.ts
- Test Adequacy: 573 tests pass (15 isEnabled edge cases, 6 readCrewConfig robustness, 9 hook integration + env-var precedence tests covering disabled→no-output and enabled/absent→fires for all 3 hooks)
- Risks: none
- Required Follow-up: none


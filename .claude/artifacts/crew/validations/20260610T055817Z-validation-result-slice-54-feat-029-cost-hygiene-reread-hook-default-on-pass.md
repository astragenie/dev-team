# Validation Result: SLICE-54 FEAT-029 cost-hygiene reread hook default-on — PASS

- Created: 2026-06-10T05:58:17.376Z
- Validator: validator
- Environment: local (Windows 11, Node strip-types runtime)
- Decision: PASS
- Scenario: Retroactive validation — implementation landed 2026-06-08, slice never closed. Re-validated against acceptance criteria.
- Evidence Collected:
  - Default-on: `hooks/check-redundant-read.ts` header declares "Default-on; opt out with CREW_COST_HYGIENE=0". No positive env gate — hook runs unless explicitly disabled.
  - Opt-out preserved: line 97 `if (process.env.CREW_COST_HYGIENE === "0") return;`.
  - Docs: no live doc/README describes the hook as opt-in (only historical completed-slice records mention the prior opt-in state).
  - e2e-smoke: `npm run e2e:smoke` PASS — fresh sample repo wires PreToolUse hook events with no env var set.
  - `npm test`: 530 pass / 0 fail (includes `cost-hygiene-hook.test.ts`, `cost-hygiene-decide.test.ts`).
- Files / Surfaces Checked: `hooks/check-redundant-read.ts`, `hooks/record-read-content.ts`, `hooks/hooks.json`.
- Risks: low. Behavior change is default-on telemetry; opt-out path retained.
- Required Follow-up: none.


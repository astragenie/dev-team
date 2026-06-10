# Validation Result: SLICE-63 FEAT-138 negative-fixture drift conflation fix — PASS

- Created: 2026-06-10T06:38:21.048Z
- Validator: validator
- Environment: local (Windows 11, Node strip-types runtime)
- Decision: PASS
- Scenario: Reproduce the FEAT-138 CI failure mode, apply the fix test-first, verify CI contract loop green.
- Evidence Collected:
  - **Pre-state:** AC#1 real drift on `valid-feat-contracts.ts` already resolved by prior commit `2f8fbb6`; committed TS in sync (`--write` dry-run = no change). AC#2/AC#4 still open.
  - **Bug reproduced:** negative fixture `broken-missing-examples.openapi.yaml` run with `checkDrift:true` (the CI path, `checkDrift: !writeTs`) emitted a spurious `drift: committed TS missing` alongside the intended redocly lint failure.
  - **TDD:** new lock test "skips the drift check when redocly lint fails" failed RED (drift error present), passed GREEN after the `errors.length === 0` guard.
  - **Fix:** `scripts/validate-contracts.ts` — drift block now gated on `errors.length === 0` (skip drift when lint/3.1/gen already errored).
  - **Post-state:** negative fixture fails for lint reasons only (no drift line); valid fixture passes. Exact CI contract loop rc=0.
  - **Gates:** full suite 531/531 pass (was 530 + new lock test), lint 0 warnings, `tsc --noEmit` clean, prettier clean.
  - **Review:** crew:reviewer APPROVED — verified gate preserves real drift detection for valid specs (existing drift test uses runLint:false → errors empty at gate → drift still runs).
- Files / Surfaces Checked: `scripts/validate-contracts.ts`, `tests/validate-contracts.test.ts`, `.github/workflows/test.yml` (contract loop).
- Risks: none. Additive guard; valid-spec drift detection intact.
- Required Follow-up: confirm green on GitHub Actions after push (cannot verify locally — `gh` not on PATH; 5 commits will be ahead of origin).



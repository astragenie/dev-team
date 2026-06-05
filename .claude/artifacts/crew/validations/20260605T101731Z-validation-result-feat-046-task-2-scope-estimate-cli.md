# Validation Result: FEAT-046 Task 2 scope-estimate CLI

- Created: 2026-06-05T10:17:31.678Z
- Validator: lead
- Environment: local-worktree (C:\work\mega\hero-crew\.claude\worktrees\feat-046-task-2-scope-estimate-cli)
- Decision: PASS
- Scenario: Exercise `node scripts/crew.mjs scope-estimate` across all four classifier branches per FEAT-046 AC-1 (returns `{ tier, reason }`) and the plan's Task 2 Step 2 smoke expectations.

## Evidence Collected

| # | Invocation | Expected | Actual | Match |
|---|---|---|---|---|
| 1 | `--files "scripts/crew.mjs:894,scripts/lib/briefing/collect.mjs:955"` | `{tier:"heavy", reason:"1849 total lines exceeds heavy threshold (800)"}` | identical | ✓ |
| 2 | `--files "agents/builder.md:190"` | `{tier:"light", reason:"190 total lines across 1 file(s) — well within light threshold"}` | identical | ✓ |
| 3 | `--files "a.mjs:100:true,b.mjs:80"` (eslintDisable) | `{tier:"heavy", reason:"eslint-disable present in scope — complexity acknowledged"}` | identical | ✓ |
| 4 | no args (empty input) | `{tier, reason}` shape with `tier ∈ {light, standard, heavy}` | `{tier:"light", reason:"0 total lines across 0 file(s) — well within light threshold"}` | ✓ |

Smoke tests 1 and 2 are plan-prescribed (Task 2 Step 2); they returned the exact reason strings verbatim. Tests 3 and 4 exercise eslint escalation and empty-input defaults.

## Files / Surfaces Checked

- `scripts/crew.mjs` (commands map + help map entries for `"scope-estimate"`)
- `scripts/lib/scope-estimate.mjs` (consumer — pure function landed in Task 1, commit `f142ace`)

## Regression Gates

- `node --test`: **357/357 pass** (no regression; unit test count unchanged because no new tests were added for the CLI wrapper — see review note)
- `npm run lint`: zero warnings

## Risks

None blocking. The CLI wrapper has no dedicated integration test — coverage relies on the 8 unit tests for `estimateScope` (shipped in Task 1) plus the smoke tests recorded above. Plan does not require CLI-level tests for Task 2; reviewer accepted this.

## Required Follow-up

- Tasks 3–4 (agent prompt edits) remain pending and are `autonomous_safe: false`.
- Task 5 (modelCompliance in brief-me) and Task 6 (final verification) remain pending.

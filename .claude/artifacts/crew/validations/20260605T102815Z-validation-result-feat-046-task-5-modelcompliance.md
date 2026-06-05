# Validation Result: FEAT-046 Task 5 modelCompliance

- Created: 2026-06-05T10:28:15.590Z
- Validator: lead
- Environment: local-worktree (C:\work\mega\hero-crew\.claude\worktrees\feat-046-task-5-model-compliance)
- Decision: PASS

## Scenario

Exercise `node scripts/crew.mjs brief-me` against the worktree and confirm the JSON output includes a `modelCompliance` field at the top level with `{ sonnetPct, compliant, sliceCount }` populated from real cost telemetry (FEAT-046 AC-4).

## Evidence Collected

| # | Check | Expected | Actual | Match |
|---|---|---|---|---|
| 1 | `brief-me` JSON contains top-level `modelCompliance` key | present | present | ✓ |
| 2 | `sonnetPct` numeric, 0-100 range | 0-100 | `54.4` | ✓ |
| 3 | `compliant` boolean, `false` when sonnetPct < 60 | `false` | `false` | ✓ |
| 4 | `sliceCount` matches deduped recent cost reports | 4 (from collectRecentCosts) | `4` | ✓ |

Live smoke output:

```json
{
  "sonnetPct": 54.4,
  "compliant": false,
  "sliceCount": 4
}
```

The `false` flag accurately reflects the recent cost telemetry — FEAT-040 burned ~70% on opus, dragging the 5-slice average below the 60% sonnet floor.

## Files / Surfaces Checked

- `scripts/lib/briefing/collect.mjs` (`computeModelCompliance` + `collectModelCompliance` exports)
- `scripts/lib/briefing.mjs` (`buildBriefingReport` Promise.all + return object)
- `tests/collect-model-compliance.test.mjs` (6 unit tests)

## Unit Test Coverage

`tests/collect-model-compliance.test.mjs`: 6/6 pass
- empty reports → null
- 2 reports averaging → sonnetPct ~70 + sliceCount=2
- all sub-60 → compliant=false
- single ≥60 → compliant=true
- mixed null/valid → skips null, sliceCount=1
- no sonnet entry → sonnetPct=0, compliant=false

## Regression Gates

- `node --test`: **363/363 pass** (357 baseline + 6 new, no regressions)
- `npm run lint`: zero warnings
- `npm run typecheck`: clean

## Plan Divergence (intentional, reviewer-approved)

Plan's test data uses `usdPct` as 0-1 decimal fractions; real `parseModelMix` (collect.mjs:325-344) emits 0-100 percentages. Implementation aligned to real shape (removed `* 100`); tests rewritten with 0-100 values. Reviewer confirmed plan-divergence is the correct call.

## Risks

None blocking. Render-layer change (showing modelCompliance in the markdown brief-me output) is not in plan; field is exposed via JSON only — consistent with plan's "brief-me output includes modelCompliance field" scope.

## Required Follow-up

- Task 6 (final verification across all of FEAT-046) remains pending.
- Tasks 3, 4 (agent prompt edits, autonomous_safe:false) remain pending.

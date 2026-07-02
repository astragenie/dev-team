# GEPA Inspector Bug-Corpus Mining Notes — SLICE-103

_Design notes for FEAT-183 S6 (inspector eval pipeline)._

## What "bug" means for the inspector

The inspector evaluates code-bearing diffs for correctness, regressions, and
configurable review gates. A "bug" in the eval corpus is any change that the
inspector should flag as requiring changes (`request_changes`) due to a
demonstrable correctness defect.

Bug classes (from the FEAT-183 design spec line 80):

| Class | Description | Example |
|---|---|---|
| `logic-error` | Incorrect condition, missing guard, off-by-one | Null guard removal (bug-001, bug-002) |
| `integration-failure` | Module-level side effects, test harness contamination | `isMainEntry()` removal (bug-003) |
| `data-corruption` | Non-atomic writes, unsafe casts, partial-write exposure | JSON.parse cast without Zod (bug-004), atomic rename removal (bug-006) |
| `timeout` | Subprocess/async operation with no timeout | bun preflight timeout removal (bug-007) |
| `permission` | Privilege escalation, unauthorized access path | (future corpus) |
| `resource-exhaustion` | Error-handling regression causing crash on missing resource | Promise.all→sequential without try/catch (bug-009) |
| `external-dep` | Unchecked external dependency call with no circuit-breaker | (future corpus) |
| `security` | Scope expansion of secret-scanning, credential leakage | scanSecrets full-repo scope (bug-008) |
| `perf` | N+1 query, O(n²) loop, blocking main thread | (future corpus) |
| `race` | Concurrent write without lock, shared mutable state | (future corpus) |

`clean-rename` is a negative class — used for cases where the inspector
should NOT raise a blocking finding (bug-010).

## Corpus provenance (SLICE-103)

10 cases delivered. Breakdown:

| Case | Bug class | Provenance |
|---|---|---|
| bug-001 | logic-error | Hand-seed from `evals/fixtures/inspector-null-deref.diff` pattern |
| bug-002 | logic-error | Mined from SLICE-10 review (PS auto-var false positive finding) |
| bug-003 | integration-failure | Mined from SLICE-76 review (isMainEntry guard removal) |
| bug-004 | data-corruption | Mined from gepa-core S1 TS review (unsafe JSON.parse cast) |
| bug-005 | logic-error | Mined from SLICE-12 review (negative threshold clamping) |
| bug-006 | data-corruption | Hand-seed (atomic write removal pattern) — held_out |
| bug-007 | timeout | Hand-seed (subprocess timeout removal pattern) |
| bug-008 | security | Mined from SLICE-69 review (scanSecrets full-repo scope) |
| bug-009 | resource-exhaustion | Hand-seed (Promise.all error-isolation regression) — held_out |
| bug-010 | clean-rename (negative) | Hand-seed from `evals/fixtures/inspector-clean-rename.diff` |

Held-out cases: bug-006 and bug-009 (`held_out: true`).

Mining script can extract more seeds from future review artifacts via
`node scripts/crew.ts gepa-mine-inspector --weeks N --out agents/inspector/.gepa/eval/`.

## Mining heuristics

The `mine-inspector-bug-corpus.ts` script uses the following heuristics:

1. **Decision filter**: Only process review artifacts where `Decision: rejected`.
   `approved_with_notes` findings may surface valid bugs but they were not
   blocking — not appropriate for training cases where `request_changes` is
   the expected verdict.
2. **Severity filter**: Only emit seeds with `CRITICAL` or `HIGH` in the
   `Risks:` section. Lower-severity findings generate too much noise for
   training purposes.
3. **Bug class inference**: Keyword-based heuristic over the Risks + Required
   Follow-up text. Classification is imprecise — operator review required.
4. **Redaction**: All extracted strings pass through `redactRationale()` from
   gepa-core before write to prevent secret leakage from review content.
5. **Week window**: Artifacts are filtered by `mtime >= now - weeks*7days`.
   This requires the repo to have been recently cloned or the mtime to be
   preserved; CI artifact trees may use clone-time mtimes.

## Rubric structure

The rubric at `agents/inspector/.gepa/rubric.md` defines 6 criteria,
each with 0–3 scoring anchors observable by any LLM judge:

1. **verdict-accuracy** — Does the verdict match expected?
2. **evidence-citation-correctness** — Are file/line citations accurate?
3. **risk-class-named** — Is the correct risk class identified?
4. **rationale-actionability** — Does the rationale tell the author what to fix?
5. **escalation-appropriateness** — Does the severity tag match the risk?
6. **false-positive-rate** — Does the inspector avoid blocking clean changes?

`false-positive-rate` is only included in the rubric for negative cases
(bug-010 and similar). It is omitted from bug-finding cases to avoid
confusing the judge.

## Baseline run ID

The baseline eval aggregate artifact should be committed at:

`.claude/artifacts/crew/gepa/eval/<inspector-baseline-run-id>.json`

Run `/crew:gepa-eval inspector --live` after this slice merges to produce
the baseline. Record the resulting run-id here so S8a/S8b have a
fixed reference:

```
baseline_run_id: TBD — set after first live eval run post-merge
```

The aggregate produced by the baseline run should report:
- `total_cases: 10`
- `held_out_cases: 2`
- `pass_rate_all`, `pass_rate_train`, `pass_rate_held_out` all present

## Scorer circularity note

The inspector is scored using `rubricScorer(ollamaJudge)` or equivalent
non-Claude judge, NOT by calling `crew:inspector` on its own output. This
eliminates the C1 circularity risk identified in the FEAT-183 design spec:
a judge that is the same model as the candidate cannot catch the candidate's
systematic blind spots.

The AC-4 test (`eval-inspector-no-circularity.test.ts`) asserts that:
- No `scorer_circular` warning appears in output
- The `judge:` provenance field in the aggregate is NOT `crew:inspector`

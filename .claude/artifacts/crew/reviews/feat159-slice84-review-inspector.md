---
kind: review-result
slice: SLICE-84
reviewer: crew:inspector
verdict: PASS
---

# SLICE-84 Inspector Review — correctness/regression lens

## Opening statement

Reviewing SLICE-84 (FEAT-159 SLICE-A: per-agent rolling stats aggregator + CLI) against the correctness/regression lens specified in the reviewer ladder. This is a read-only review; no code was edited. Gates run: `bun run typecheck`, `bun run lint` (new-warning-only), `bun test tests/agent-stats-aggregator.test.ts`. Standards checked: aggregator math edge cases, regex correctness, scope discipline (AC-5), LOC budgets (AC-4), process.exit discipline. No security-sweep triggered (no auth/crypto/secrets in diff). No dependency CVE audit (no lockfile changes).

---

## Gate results

| Gate | Result |
|---|---|
| `bun run typecheck` | CLEAN — zero errors |
| `bun run lint` (new warnings in touched files) | CLEAN — 0 new warnings; all 68 existing repo-wide complexity warnings are pre-existing |
| `bun test tests/agent-stats-aggregator.test.ts` | 7/7 PASS (56ms) |
| `git diff --stat HEAD` | Only `scripts/crew.ts` changed (+72/-4). All other deliverables are new files. AC-5 confirmed. |

---

## Aggregator math — verified

### `computeRow` pass_rate denominator when `sn === 0`

`agent-stats-aggregator.ts:176` — `pass_rate: round3(sn > 0 ? passCount / sn : 0)`. Zero guard present and correct. No NaN possible.

### Median with even-count arrays

`agent-stats-aggregator.ts:155-159` — `median([1,3])` computes `(s[m-1] + s[m]) / 2 = (1+3)/2 = 2`. Verified: correct. Empty array returns 0 via guard on line 156. Odd-count arrays return the middle element correctly.

### Rate fields when `sample_count === 0`

All three rate computations (`pass_rate`, `review_rework_rate`, `validation_fail_rate`) gate on `sn > 0` (unique slice count). When dispatches exist but all have `sliceId = null` — filtered out before `computeRow` is called — `sn = 0` produces all-zero rates rather than NaN. Correct.

### AC-T1 math independently verified

builder `mean_wall_ms`: (40000+55000+35000+60000+48000)/5 = 47600. Matches test assertion.
builder `mean_tokens`: (38000+50000+32000+57000+44000)/5 = 44200. Matches.
builder `pass_rate`: SLICE-S04 avg=0.671 < 0.7, others ≥ 0.7 → 4/5 = 0.8. Matches.

---

## `selectWindow` — duplicate slice IDs

`agent-stats-aggregator.ts:148-152` — When grades directory contains two files for the same `slice` id (e.g., two grade rewrites), `selectWindow` sorts all records by `graded_at` desc, slices the top N, then collapses to a `Set`. If both copies land in the top N, the effective window shrinks below N unique slices silently. This is not a correctness bug (grade-dir duplicates are an upstream data issue outside this slice's scope), but the behavior is undocumented. No AC requires handling this. Advisory note only — no fix needed here.

---

## `parseAD` dual-path decision extraction

Verified against real artifacts in `.claude/artifacts/crew/{reviews,validations}/`:

- Frontmatter `verdict: NEEDS_FIX` → extracted correctly via `/^verdict:\s*(.+)$/i`.
- Frontmatter `decision: approved` → extracted correctly via `/^decision:\s*(.+)$/i`.
- Body `- Decision: failed` → extracted correctly via `/^-\s*Decision:\s*(.+)$/im`.
- Uppercase `NEEDS_FIX` in frontmatter → matches `/needs.?fix/i`. Correct.

### `decisionSet` regex matching

`/needs.?fix/i` correctly matches `NEEDS_FIX`, `needs_fix`, `needs fix`. No false positives on `approved`, `approved_with_notes`, `pass`, `failed`.

`/fail/i` correctly matches `failed`, `FAIL`. No false positives on `passed`, `passed_with_notes`, `PASS`.

---

## `loadGrades` error handling

`agent-stats-aggregator.ts:88-101` — `readdir` failure returns `[]`. Per-file `readFile` failure uses `continue` (line 96). One bad grade file does not abort the run. Intentional and correct per AC-6 + spec intent.

---

## Regression risk — `scripts/crew.ts`

`--agent` and `--window` added to `FLAG_SPEC` (lines 28, 101) and initialized to `null` in `parseArgs` result (lines 196-197). No existing subcommand uses these key names; no naming collision. The `agent-stats` dispatch arm (lines 922-986) is an additive `else` branch in the `COMMANDS` map — no existing command path is touched. Confirmed by reading the full diff: only the flag map, the usage map, and the COMMANDS trailing entry were modified.

`process.exit(2)` in the CLI handler is acceptable — `scripts/crew.ts` is the entry-point script, not a library function. `agent-stats-aggregator.ts` contains no `process.exit` calls.

---

## LOC budgets (AC-4)

| File | Lines (wc -l) | Budget | Status |
|---|---|---|---|
| `scripts/lib/agent-stats-aggregator.ts` | 230 | 250 | PASS |
| `tests/agent-stats-aggregator.test.ts` | 300 | 300 | PASS (exact) |
| `scripts/crew.ts` net add | +68 | 80 | PASS |

---

## Scope discipline (AC-5)

`git diff --stat HEAD`: only `scripts/crew.ts` shows edits. All deliverables (`agent-stats-aggregator.ts`, test file, fixture, docs) are new files not in HEAD. `agents/lead.md` untouched. `scripts/lib/cost-report-*.ts` untouched. PASS.

---

## Advisory note (LOW — not blocking)

`[LOW]` `scripts/lib/agent-stats-aggregator.ts:211` — The `decisionSet` rework regex `/needs.?fix/i` does not match `rejected`. Real review artifacts in `.claude/artifacts/crew/reviews/` use both `needs_fix` and `rejected` as decision values. A `rejected` review represents a full rework requirement — stronger than `needs_fix` — but is not counted toward `review_rework_rate`. The spec says "fraction with >= 1 review_needs_fix artifact" so this literally matches the spec. The practical effect is that `review_rework_rate` will undercount rework when a reviewer used `rejected` rather than `needs_fix`. No AC is violated; this is advisory context for the follow-up slice that wires agent stats into lead consumption.

Risk: underreported rework metric in slices where reviewer chose `rejected` over `needs_fix`.
Fix (in a follow-up slice): change regex to `/(needs.?fix|rejected)/i`.

---

## Decision

**PASS.** All correctness gates pass. No regressions. Math verified independently. Scope clean. LOC budgets met. Dual-path artifact parsing confirmed against real artifact corpus. The `rejected`-not-counted note is advisory and does not block the verifier phase or the follow-up wiring slice.

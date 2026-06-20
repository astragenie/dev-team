---
kind: review-result
slice: SLICE-85
reviewer: crew:inspector
verdict: APPROVED_WITH_NOTES
---

# SLICE-85 Inspector Review — FEAT-159 SLICE-B

**Lens:** correctness / regression / backwards-compat
**Gates run:** typecheck, bun test (new + regression), lint pre-existing check, frontmatter scan, try/catch pattern audit, env gate audit, spread audit, section ordering, regex coverage
**Standards checked:** Engineering OS constitution, CLAUDE.md commit discipline, TDD policy (FEAT-011)
**Skills consulted:** docs/workflow/reviewing-code/ (procedure of record)
**Decision:** APPROVED_WITH_NOTES — one LOW advisory, no blockers.

---

## Gate results

| Gate | Result |
|---|---|
| `bun run typecheck` | CLEAN |
| `bun test tests/cost-report-agent-stats-section.test.ts` | 4/4 PASS |
| `bun test tests/agent-stats-aggregator.test.ts` | 7/7 PASS (no regression) |
| Lint (changed files only) | Pre-existing warnings only — not introduced by this diff |

---

## Findings

### [LOW] `scripts/lib/agent-stats-aggregator.ts:222` — regex can match substrings containing "rejected"

**Risk:** `/(needs.?fix|rejected)/i` matches `not-rejected`, `unrejected`, or any verdict string that contains "rejected" as a substring. In practice, observed review verdicts are short atomic tokens (`REJECTED`, `NEEDS_FIX`, `approved`, `approved_with_notes`) so the false-positive probability is near zero in production. The advisory is forward-looking: if any reviewer or tool ever emits a verdict like `"not-rejected"` or free-text `"The review was rejected as invalid"`, those slices would be incorrectly counted toward `review_rework_rate`.

**Fix (non-blocking):** Tighten to `/\b(needs.?fix|rejected)\b/i`. Word-boundary anchors eliminate substring matches at zero logic cost.

---

## Correctness gate — all items PASS

**1. Backwards-compat (cost reports)**
- `agentStats?` added as optional field to `ArtifactFields` — existing cost reports without the field are unaffected.
- `renderCostReportAgentStats` is appended LAST in the `renderCostReportBody` array spread; no existing renderer removed or reordered.
- `render-frontmatter.ts` contains zero references to `agentStats` — the field is body-only, not frontmatter. Retrospective aggregators reading frontmatter are unaffected.

**2. try/catch pattern**
- `collectAgentStatsForRun` wraps the entire aggregator call in try/catch, returns `undefined` on any error — identical pattern to `collectDispatchBreakdownForRun` (line 34/52). Non-fatal telemetry errors cannot break cost-report emission.
- The bare `catch {}` (no error binding) is intentional and matches the existing pattern; it swallows all errors including programming mistakes in `aggregateAgentStats`. This is an accepted trade-off documented in the function comment.

**3. Env gate**
- `CREW_COST_REPORT_AGENT_STATS=0` → immediate `return undefined` before any I/O.
- Spread at emit-cost-report.ts:161 is conditional: `...(agentStats != null ? { agentStats } : {})` — `undefined` never enters the object literal.

**4. Section ordering**
- `renderCostReportAgentStats` is the last spread in the `renderCostReportBody` array (write.ts:657-658). AC-T3 verifies this with an index comparison against `## Per-dispatch breakdown`.

**5. Regex extension**
- `/(needs.?fix|rejected)/i` correctly matches all required forms: `NEEDS_FIX`, `needs_fix`, `needs-fix`, `Needs Fix`, `REJECTED`, `rejected`, `Rejected` (verified via node -e). Existing 7 aggregator tests remain green — no regression.

**6. Empty-source omission (live smoke)**
- The live SLICE-85 cost report (`20260620T091201Z-cost-report-slice-feat159-slice85.md`) does NOT contain `## Agent stats (rolling)`. This is the correct behavior: no `dispatch-timing.jsonl` in the repo → `aggregateAgentStats` returns `[]` → `collectAgentStatsForRun` returns `undefined` → spread omits field → `renderCostReportAgentStats([])` emits `[]` → section absent. This is the documented fail-safe, not a bug.

---

## TDD gate (FEAT-011)

4 net-new tests written covering all 4 ACs. Tests assert behavior (section presence/absence, ordering, row inclusion/exclusion, rework rate value) not implementation. AC-T4 includes a regression test for the regex extension. TDD gate PASS.

---

## Required follow-up

- **Non-blocking (LOW):** In a follow-on micro-fix, tighten `/(needs.?fix|rejected)/i` → `/\b(needs.?fix|rejected)\b/i` in `agent-stats-aggregator.ts:222`.
- **Scope note:** SLICE-C (lead consumption, `agents/lead.md` edit, `autonomous_safe: false`) remains open per commit message and FEAT-159 tracking — not in scope for this review.

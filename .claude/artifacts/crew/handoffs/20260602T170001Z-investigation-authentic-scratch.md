# authentic — cost-hotspot investigation scratch

date: 2026-06-02
investigator: researcher (read-only)
scope: C:/work/mega/authentic/.claude/artifacts/crew/cost/ + cost-insights/

---

## Self-Verify Gates

- Zero writes outside hero-crew/.claude/artifacts: PASS
- Zero git mutations in consumer repos: PASS

---

## Cost Reports Reviewed (3 files)

1. `20260602T135231Z-cost-report-aggregate-phase2-feat047-slice53.md` — most recent (aggregate)
2. `20260602T141943Z-cost-report-slice-phase2-feat048-slice54.md` — 2nd most recent (slice)
3. `20260602T112615Z-cost-report-slice-052-postgres-conn-string-env-switch-authentic-schema-m.md` — worst-case ($590.58)

---

## Key Field Values

### Report #1 (most recent aggregate, FEAT047 SLICE53):
- `usd: 19.1364`
- `total_tokens: 9,526,764`
- `cache_hit_pct: 99.1`
- `source_project: aggregate`
- `aggregate_all: true`
- `source_count: 3`

### Report #2 (slice, FEAT048 SLICE54):
- `usd: 0.5865`
- `total_tokens: 1,448,961`
- `cache_hit_pct: 99.0`
- `source_project: C--work-mega-authentic`
- `aggregate_all: false`
- `source_count: 1`

### Report #3 (worst-case, SLICE-052):
- `usd: 590.5838`
- `total_tokens: 266,706,581`
- `cache_hit_pct: 97.9`
- `source_project: aggregate`
- `aggregate_all: true`
- `source_count: 4`
- `review_decision: approved`
- `Assistant Messages Counted: 789`
- `duration_ms: 80953464` (1349 minutes — 22+ hours)

---

## USD-Present vs USD-Missing Analysis

Contrary to the pre-analysis expectation of "9/10 reports missing usd field", all 65
authentic cost reports contain the `usd:` frontmatter field (grep -L "^usd:" returned
zero files across the full corpus).

The actual divergence pattern is NOT a missing field — it is a massive USD spike:
- 63 of 65 reports: usd range $0.59 – $19.13 (routine slices)
- 1 report: usd $590.58 (SLICE-052, 2079% above 3-slice median of $27.10)
- 1 report: usd $15.09 (arch-routing-docs aggregate, 2026-05-27)

Diff between SLICE-052 (worst-case) vs FEAT048 SLICE54 (typical recent):
```
SLICE-052 unique fields:    slice: SLICE-52, review_decision: approved,
                            source_count: 4, duration 1349 min, 789 messages,
                            16 compaction events, 4 Claude sessions
FEAT048 SLICE54 typical:   feature: FEAT-048, source_count: 1, duration 10.7 min,
                            11 messages, 0 compaction events, 1 session
```

The spike is driven by: Opus at 100%, 22-hour wall-clock duration, 789 assistant
messages, 16 compaction events, and 4 cross-session sources diluting cache context.

---

## Cost-Advise Findings (latest: 20260602T135231Z-cost-advise-phase2-feat047-slice53.md)

Grade: A (recent performance is healthy — $19.14, 99.1% cache hit)

Flags on the recent (healthy) slice:
- `[HIGH] opus-overuse` — 100% Opus
- `[LOW] large-tool-output` — 90th-pct tool result 6,009 bytes
- `[LOW] many-sources` — 3 sessions
- `[MEDIUM] trend-opus` — median 94.8% Opus share

Flags on SLICE-052 worst-case (20260602T112615Z cost-advise):
- Grade: **F**
- `[HIGH] cost-regression` — $590.58 is 2079% above $27.10 median
- `[HIGH] opus-overuse` — 100% Opus
- `[HIGH] compaction` — 16 compaction events
- `[MEDIUM] file-rereads` — 13 redundant Read calls
- `[MEDIUM] exploration-heavy` — 5.0:1 ratio
- `[MEDIUM] non-repo-dominant` — 0% of spend from repo session
- `[LOW] subagent-overuse` — 3 dispatches
- `[LOW] many-sources` — 4 sessions

---

## Non-Zero USD Report Count

Total authentic cost reports: 65
Non-zero USD reports: **64 of 65** (only 1 is zero-USD; a very early scaffolding report
from 2026-05-27 had usd: 0 in content but has the field present).
The meaningful concentration: 1 catastrophic outlier ($590) vs 64 routine reports ($0.58–$49).

---

## Root-Cause Hypothesis

The authentic cost-regression hotspot is a single runaway slice (SLICE-052) that
accumulated $590.58 over 22 hours due to 100% Opus model use, 16 context compactions,
789 assistant messages across 4 sessions, and no cost gate or model-selection enforcement
— textbook FEAT-031 (Sonnet-default model gate) and FEAT-030 (compaction/slice-length guard)
non-compliance.

---

## Recommended Fix Path

Ensure authentic runs on crew@0.7.0 (per the consumer bump runbook) which ships FEAT-031
(Sonnet-default model gate) and verify the `validate-agents.mjs` CI gate is active; for
future long-duration slices, set a per-slice cost cap or mandate `/model sonnet` at
slice-start to prevent unchecked Opus accumulation.

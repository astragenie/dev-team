# Cross-Repo Cost-Efficiency Analysis — 2026-06-02

Companion to `2026-06-02-cross-repo.md`. Focuses on operating cost,
context-budget hygiene, and stabilization opportunities derived from
the last 10 cost reports in each consumer repo.

## Per-repo cost shape

| Repo | $/run avg (max) | Min/run | Msgs avg | Compact avg (max) | Subagent avg (max) | Reread avg (max) | Notes |
|---|---|---|---|---|---|---|---|
| **cortex** | $64 ($255) | 37 | 101 | 4.1 (19) | 2.6 (13) | 3.5 (27) | Healthiest shape |
| **authentic** | $591 (n=1) | 135 | 789 (n=1) | 16 | 3 | 13 | **Cost reporter dropping USD on 9/10 reports** |
| **loopobserver** | $42 ($204) | 14 | 108 | 2.4 (9) | 2.8 (12) | 2.3 (14) | Cost-efficient but grade emergency (see cross-repo retro) |
| **citylive** | $0 | 14 | n/a | 0 | 0 | 0 | **Cost reporter not emitting metrics** (all zeros / nulls) |
| **hcal** (loop plugin) | $150 ($1,352) | 1,021 | 54 | 11.3 (104) | 9.3 (80) | **32.7 (315)** | Reread count outlier — direct FEAT-029 target |
| **hero-crew** (this) | $1,319 ($2,815) | 5,701 | 1,720 | 76 (121) | 58 (102) | 154 (287) | Aggregate-variant rollups across sessions; not per-slice |

`n=1` and `n/a` cells reveal reporter gaps — see Gap 1 + 2 below.

## Cost-discipline targets and adherence

Per `feedback_cost_discipline.md` + the just-shipped FEAT-030..034:

| Rule | Target | Best | Worst |
|---|---|---|---|
| Sonnet by default | — (qualitative) | cortex (low USD/run) | hero-crew (Opus-heavy aggregate) |
| Subagents return artifact path only (FEAT-032) | low compaction | loopobserver (2.4) | hero-crew (76 avg, 121 max) |
| Bundle subagent passes (FEAT-030) | ≤ 4-5 dispatches/run | loopobserver (2.8 avg) | hcal (9.3 avg, 80 max) |
| No redundant Reads (FEAT-029) | < 10 rereads/run | loopobserver (2.3) | **hcal (32.7 avg, 315 max)** |
| Pre-check chained ops (FEAT-033) | low tool_failure_rate | not measurable — field null in all repos | |

## Identified gaps (concrete stabilization opportunities)

### Gap 1 — `authentic` cost reporter dropping USD

9 of 10 recent cost reports in `authentic` have `duration_ms` but no
`usd` field. Single report with USD shows $591 — cost activity is
real. Root cause likely a session-cost.mjs failure mode that emits
duration without invoking the USD calculation. Investigate:
`scripts/lib/session-cost.mjs` USD-compute path; check if
`authentic` is pinned to a pre-FEAT-005 crew version.

**Fix candidate:** FEAT-036 cost-report schema validator. Reject /
warn-on emit when expected fields are null.

### Gap 2 — `citylive` cost reporter emits zeros / nulls

All 10 recent reports have `usd=0`, no `messages`, no `compaction`,
no `subagent`, no `reread`. Either a different cost-advisor variant
running there, or the cost data source isn't being read (no Claude
Code session logs in the expected location). Investigate the
`sourceProject` field — citylive might be pointing at an empty
session directory.

**Fix candidate:** Same as Gap 1 — emit-side validation + a brief-me
warning when costHealth field comes from a zero-data report.

### Gap 3 — `hcal` (loop plugin repo) reread emergency

hcal averages 32.7 file rereads per run, max 315. This is the textbook
case FEAT-029 (cost-hygiene reread hook default-on) was designed
for. Currently the hook is env-var-gated default-off; hcal isn't
opting in. Two paths:

- **Promote FEAT-029** from deferred to active. Run the dogfood A/B
  in `hcal` (the worst case) and `cortex` (the healthy case) to get
  before/after evidence.
- **Or**: ship the hook with default-on now (skip dogfood), trusting
  that opt-out via `CREW_COST_HYGIENE=0` is enough safety. Risky
  per FEAT-029 spec.

### Gap 4 — tool-failure metrics are universally null

`tool_failures`, `tool_calls`, `tool_result_p90` return n/a in 6/6
repos surveyed. Either:

- These fields aren't emitted in cost reports yet (FEAT-005
  successor not done)
- Field names drifted between writer + reader

Investigate `scripts/lib/session-cost.mjs` emit shape vs
`scripts/lib/cost-advisor.mjs` read shape. Without these metrics,
FEAT-033's preflight effectiveness is unmeasurable.

**Fix candidate:** FEAT-036 schema doc (single source of truth for
cost-report field names) + reader-writer consistency check.

### Gap 5 — observability weakness is universal

From the companion retro: 4 of 4 consumer repos flag the
`observability` dimension below 0.80. Plugin doesn't currently ship
an observability check, skill, or routing-table row.

**Fix candidate:** FEAT-037 observability-checklist skill.
Triggered on net-new feature review when the diff lacks
log/metric/trace surface but ships user-visible behavior.

### Gap 6 — no fleet-view of consumer crew pins

None of the consumer repos have a local `.claude-plugin/marketplace.json`
or other version-pin file. They inherit from user-global install.
Means a user with stale crew@0.3.x install gets none of FEAT-030/031/
032/033/034/035. No mechanism to detect drift across repos.

**Fix candidate:** FEAT-038 `crew fleet --versions` subcommand that
walks sibling repos and reports which crew version each is using
(via session-log inspection or a heartbeat artifact).

### Gap 7 — high-velocity repos accumulate cost-discipline debt fastest

cortex (17.7 slices/wk) + authentic (11.4 slices/wk) flag the most
quality dimensions below 0.80. Per-slice cost is fine in cortex
($64/run) but the velocity compounds. The just-shipped FEAT-030 +
FEAT-031 + FEAT-032 are exactly the bundle these repos need.

**Action:** push the crew@0.7.0 upgrade to cortex + authentic as
priority-1 consumer-side work.

## Stabilization roadmap (proposed)

Three new FEATs in hero-crew, derived from these gaps:

| FEAT | Title | Pri | autonomous_safe | Effort |
|---|---|---|---|---|
| FEAT-036 | Cost-report schema validator + field-name consistency | P1 | yes | 1 slice |
| FEAT-037 | Observability checklist skill + routing-table row | P1 | yes | 1 slice |
| FEAT-038 | `crew fleet --versions` consumer-pin detector | P2 | yes | 1 slice |

Plus:

- **Promote FEAT-029** dogfood: pick hcal (worst case) + cortex
  (healthy case) for the A/B. If the hook works in hcal, ship
  default-on directly.
- **Consumer-side bumps**: cortex + authentic → crew@0.7.0 + loop@0.5.6.

## Open questions

- Does cortex pin a crew version per-repo, or inherit user-global?
  If global, the version is "whatever's installed in this user's
  machine" — fleet-view (FEAT-038) is the only way to know.
- Is citylive's cost reporter broken, or is it correctly reporting
  zero activity (e.g. all work happened outside the loop)?
- Should FEAT-029 ship without dogfood given hcal's 315-max reread
  count is so far from the FEAT-029 ≤50% drop threshold that even
  a partial implementation wins?

## Per-repo recommendations

- **cortex**: bump to crew@0.7.0; high velocity benefits most from the
  Sonnet-default rule (FEAT-031). Add observability checklist when
  FEAT-037 ships.
- **authentic**: investigate cost-reporter USD gap; bump to crew@0.7.0;
  consider FEAT-029 promotion (13-reread case is solid candidate).
- **loopobserver**: quality emergency persists (cross-repo retro). The
  cost shape is fine — focus on grading rubric / test-confidence first.
- **citylive**: investigate cost-reporter zero-emission; small slice
  count makes other signals weak.
- **hcal**: highest-priority FEAT-029 target. Drop reread average from
  32.7 toward < 10.
- **hero-crew**: ship FEAT-036/037/038 candidates; complete the
  perf-stabilization arc.

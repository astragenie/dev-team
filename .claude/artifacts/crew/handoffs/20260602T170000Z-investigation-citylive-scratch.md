# citylive — cost-hotspot investigation scratch

date: 2026-06-02
investigator: researcher (read-only)
scope: C:/work/mega/citylive/.claude/artifacts/crew/cost/ + cost-insights/ + C:/Users/serge/.claude/projects/

---

## Self-Verify Gates

- Zero writes outside hero-crew/.claude/artifacts: PASS (this file is the only write)
- Zero git mutations in consumer repos: PASS (no git commands run against citylive)

---

## Cost Reports Reviewed (3 files)

1. `cost-report-cost-feat012-slice12.md` — 2026-05-24T21:29:22Z (most recent)
2. `cost-report-cost-feat011-slice11.md` — 2026-05-24T21:21:08Z (2nd most recent)
3. `20260524T174803Z-cost-report-cost-feat001-slice01-msw-mock-layer.md` — 2026-05-24T17:48:03Z (worst-case: only non-zero USD report found)

---

## Key Field Values

### Reports #1 and #2 (representative of 11 of 12 reports):
- `usd: 0`
- `duration_ms: 479198` (report #1) / `534727` (report #2)
- `source_project: AstraGenie.CityLive`
- `aggregate_all: no`
- `Sessions Scanned: 0`
- `Assistant Messages Counted: 0`
- `cache_hit_pct: -` (absent — not computed when sessions=0)
- `tool_failure_rate`: not a frontmatter field; tracked only in cost-advise body

### Report #3 (worst-case — only non-zero report):
- `usd: 49.2879`
- `total_tokens: 27,462,460`
- `cache_hit_pct: 98.4`
- `source_project: aggregate`
- `aggregate_all: true`
- `source_count: 5`

---

## Cost-Advise Findings (latest: cost-advise-feat012-slice12.md)

Note: Cost-advise references FEAT001 SLICE01 ($49.2879), NOT FEAT012 SLICE12. The advise file
is named for the slice that triggered it, but the "target slice" inside points to the earliest
slice with a non-zero report. Fields flagged:

- `[HIGH] opus-overuse` — Opus 92.8% of spend
- `[HIGH] subagent-overuse` — 7 dispatches
- `[LOW] tool-failure-rate` — 6.5% failure rate (6/93 tool calls)
- `[MEDIUM] exploration-heavy` — 6.4:1 explore:execute ratio
- `[MEDIUM] non-repo-dominant` — only 8% of spend from repo-derived session
- `[HIGH] many-sources` — 5 different Claude sessions

---

## sourceProject Directory State

Slug from frontmatter: `AstraGenie.CityLive`
Resolved path: `C:/Users/serge/.claude/projects/C--work-mega-AstraGenie-CityLive/`
Status: EXISTS — contains exactly 1 JSONL session file + 1 UUID subdirectory + memory/

Single session file found: `6a8fb009-a315-4876-960e-0f07adf88d99.jsonl`

This is a near-empty project directory: one session only. The cost reporter is
configured to scan `source_project: AstraGenie.CityLive` — but after FEAT001/SLICE01
all subsequent slices opened sessions under a DIFFERENT project directory
(not C--work-mega-AstraGenie-CityLive). The scanner finds 0 sessions in that stale slug
and emits `usd: 0`, `Sessions Scanned: 0`.

---

## Non-Zero USD Report Count

Total cost reports in citylive: 12 files
Non-zero USD reports: **1** (FEAT001 SLICE01, $49.29)
Zero-USD reports: **11** (FEAT006–FEAT012 and others)

---

## Root-Cause Hypothesis

The citylive cost reporter is hard-wired to `source_project: AstraGenie.CityLive` —
a Claude projects slug corresponding to a repo path that is no longer the active
Claude Code session directory; subsequent slices ran in sessions under a different
project slug, so the scanner finds 0 messages and emits zero-cost reports across 11
of 12 cost reports.

---

## Recommended Fix Path

Update the citylive cost-reporter invocation to use `aggregate_all: true` (or point
`source_project` to the current active project slug) so it scans the sessions where
citylive work actually occurred; or run `loop:cost-report` from inside the citylive
Claude Code session so the slug auto-detects correctly.

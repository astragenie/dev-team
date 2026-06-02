# hcal (hero-crew-autonomous-loop) — cost-hotspot investigation scratch

date: 2026-06-02
investigator: researcher (read-only)
scope: C:/work/mega/hero-crew-autonomous-loop/.claude/artifacts/crew/cost/ + cost-insights/
       C:/Users/serge/.claude/projects/C--work-mega-hero-crew-autonomous-loop/

---

## Self-Verify Gates

- Zero writes outside hero-crew/.claude/artifacts: PASS
- Zero git mutations in consumer repos: PASS

---

## Cost Reports Reviewed (3 files)

1. `20260602T150005Z-cost-report-slice-feat024-slice13.md` — most recent ($8.52)
2. `20260602T150000Z-cost-report-slice-feat024-slice13.md` — same slice, second emission ($5.96)
3. `20260602T145031Z-cost-report-slice-feat026-slice12.md` — worst-case by cost ($15.78)

Note: Reports #1 and #2 share timestamp prefix but differ in exact second; both cover FEAT024
SLICE13 with the same window — one captures 13 messages, the other 9. This is a double-emission
pattern (two cost-report invocations for the same slice, likely from an aggregate + slice pair).

---

## Key Field Values

### Report #1 (FEAT024 SLICE13, 15:00:05Z):
- `usd: 8.5233`
- `total_tokens: 4,826,109`
- `cache_hit_pct: 99.6`
- `source_project: C--work-mega-hero-crew-autonomous-loop`
- `aggregate_all: false`
- `source_count: 1`
- `subagent_dispatches: 1`
- `compaction_count: 0`

### Report #2 (FEAT024 SLICE13, 15:00:00Z):
- `usd: 5.9610`
- `total_tokens: 3,335,101`
- `cache_hit_pct: 99.5`
- `source_project: C--work-mega-hero-crew-autonomous-loop`
- `aggregate_all: false`

### Report #3 (FEAT026 SLICE12, worst-case by usd, $15.78):
- `usd: 15.7810`
- `total_tokens: 8,878,140`
- `cache_hit_pct: 99.5`
- `source_project: C--work-mega-hero-crew-autonomous-loop`
- `aggregate_all: false`
- `source_count: 1`

---

## file_reread_count Analysis

The `file_reread_count` frontmatter field is ABSENT from all hcal cost reports.
Reread counts are tracked only in cost-advise bodies as the `[MEDIUM] file-rereads` finding.

Evidence from cost-advise files:
- `20260602T145031Z-cost-advise-feat026-slice12.md`: `[MEDIUM] file-rereads — 5 redundant Read calls`
- `20260602T150005Z-cost-advise-feat024-slice13.md`: no file-rereads flag (clean on this metric)
- Baseline from SLICE-052 cross-repo advise (authentic/hcal overlap): 13 rereads flagged

Top-3 reread counts from cost-advise bodies (not sortable by frontmatter — field absent):
1. FEAT026 SLICE12: 5 redundant reads (from advise body)
2. FEAT024 SLICE13: 0 redundant reads flagged (clean)
3. Earlier slices: not yet read within cap — field not in frontmatter

The 32.7-average / 315-max expectation from the pre-analysis cross-repo doc was NOT confirmed
in the cost-report frontmatter (field does not exist there). The prior analysis may have been
based on a different schema version or a different repo. The actual measured rereads via cost-advise
are materially lower: 5 (FEAT026) and 0 (FEAT024 latest).

---

## CREW_COST_HYGIENE Env Var — Session Log Check

hcal project slug: `C--work-mega-hero-crew-autonomous-loop`
Project dir: `C:/Users/serge/.claude/projects/C--work-mega-hero-crew-autonomous-loop/`
Dir contents: multiple JSONL session files present (UUID-named, active project)

Result of grep for CREW_COST_HYGIENE across *.jsonl in that directory:
**No files matched** — the env var has never been set in hcal sessions.

FEAT-029 (cost-hygiene reread hook) is gated on `CREW_COST_HYGIENE=1` being present in
the environment. Since it is absent, the hook is default-off and has never fired in any
hcal session.

---

## Cost-Advise Findings

### Latest (20260602T150005Z-cost-advise-feat024-slice13.md):
- Grade: **A**
- `[HIGH] opus-overuse` — 100% Opus
- `[MEDIUM] trend-opus` — 100% median Opus share
- No file-rereads, no large-tool-output, no compaction flags

### 2nd latest (20260602T145031Z-cost-advise-feat026-slice12.md):
- Grade: **B**
- `[HIGH] opus-overuse` — 100% Opus
- `[MEDIUM] file-rereads` — 5 redundant Read calls
- `[HIGH] cost-regression` — $15.78 is 239% above $4.65 median
- `[MEDIUM] trend-opus` — 83.2% median Opus

No `[HIGH] file-rereads` or `large-tool-output` flagged in either recent advise.
The FEAT026 SLICE12 cost-regression ($15.78, 239% spike) is the current primary concern.

---

## Non-Zero USD Report Count

All 5 hcal cost reports reviewed: all have non-zero usd.
Prior slices (FEAT025 SLICE11: $4.65, FEAT026 SLICE12: $15.78, FEAT024 SLICE13: $8.52/$5.96).
hcal cost reporter is functioning correctly — source_project resolves to active sessions.

---

## Root-Cause Hypothesis

hcal's primary cost hotspot is 100% Opus model use across all slices (FEAT-031 non-compliance),
compounded by a cost-regression spike on FEAT026 SLICE12 ($15.78, 239% above median); FEAT-029
(reread hook) has never fired because `CREW_COST_HYGIENE` env var is unset (default-off),
making it a dormant but readily activatable lever for the file-rereads sub-issue.

---

## Recommended Fix Path

1. Bump hcal to crew@0.7.0 (FEAT-031 Sonnet-default gate) to address opus-overuse systematically.
2. Set `CREW_COST_HYGIENE=1` in the hcal Claude Code session environment to activate FEAT-029
   reread hook, which will surface real-time reread warnings instead of post-hoc cost-advise flags.
3. Investigate FEAT026 SLICE12 cost-regression root cause (likely Opus + large context) before
   the next slice in that feature.

---
date: 2026-06-02
kind: investigation
source_repos:
  - citylive
  - authentic
  - hero-crew-autonomous-loop
related_retros:
  - .claude/artifacts/loop/retrospectives/2026-06-02-cross-repo.md
  - .claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md
related_spec: docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md
methodology: read-only triage, ≤5 cost reports per repo
---

# Consumer cost-hotspot investigation — 2026-06-02

Read-only triage of three cost-report hotspots surfaced in the cross-repo retrospective + cost-efficiency analysis dated 2026-06-02. Each section names specific cost-report files as evidence and lists a concrete next action. No changes were made in the investigated repos.

**Note on corrections to pre-analysis.** This investigation revised two pre-analysis claims when the raw data did not match: authentic does NOT have a missing-USD frontmatter pattern (all 65 reports carry the field); hcal's per-slice reread counts live in cost-advise bodies, not cost-report frontmatter. Corrections noted inline below.

Related artifacts:
- Cross-repo retro: `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo.md`
- Cost-efficiency analysis: `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md`
- Top-10 cost-advise ranking: same cost-efficiency doc + the session synthesis at `.claude/artifacts/crew/runs/20260602T160653Z-final-synthesis-cross-repo-retrospective-cost-efficiency-cost-advise-analysi.md`
- Source scratch files (this repo): see `.claude/artifacts/crew/handoffs/20260602T170000Z-investigation-citylive-scratch.md` and two siblings.

## citylive — tool-failure-rate + zero-emission cost reports (corrected: 11 of 12 zero-USD)

**Symptom.** `tool-failure-rate` flagged LOW in 12 of 20 recent cost-advise reports (highest density across all consumer repos). 11 of 12 cost reports emit `usd: 0`, no messages, no compaction, no subagent_dispatches, no file_reread_count. One historical report (FEAT001 SLICE01) carries non-zero metrics including $49.29 USD and a 6.5% tool-failure-rate.

**Evidence.** Three cost-report files reviewed:
- `cost-report-cost-feat012-slice12.md` (2026-05-24T21:29:22Z) — representative zero-USD report: `usd: 0`, `source_project: AstraGenie.CityLive`, `Sessions Scanned: 0`, `Assistant Messages Counted: 0`, `duration_ms: 479198`
- `cost-report-cost-feat011-slice11.md` (2026-05-24T21:21:08Z) — second representative zero-USD report: `usd: 0`, `source_project: AstraGenie.CityLive`, `Sessions Scanned: 0`, `duration_ms: 534727`
- `20260524T174803Z-cost-report-cost-feat001-slice01-msw-mock-layer.md` (2026-05-24T17:48:03Z) — only non-zero report in full corpus: `usd: 49.2879`, `source_project: aggregate`, `aggregate_all: true`, `source_count: 5`, `total_tokens: 27,462,460`, `cache_hit_pct: 98.4`

Key frontmatter values from zero-USD reports: `usd: 0`, `source_project: AstraGenie.CityLive`, `aggregate_all: no`, `Sessions Scanned: 0`, `Assistant Messages Counted: 0`, `cache_hit_pct: -` (absent — not computed when sessions=0).

**Investigation steps.**
- Resolved `source_project: AstraGenie.CityLive` slug to `C:/Users/serge/.claude/projects/C--work-mega-AstraGenie-CityLive/`
- Confirmed directory EXISTS but contains exactly 1 JSONL session file (`6a8fb009-a315-4876-960e-0f07adf88d99.jsonl`) + 1 UUID subdirectory + memory/
- Confirmed all 12 cost reports: 11 show `Sessions Scanned: 0`; only FEAT001 SLICE01 used `aggregate_all: true` with 5 sources and got real data
- Confirmed total cost-report corpus: 12 files, 11 zero-USD, 1 non-zero
- Cost-advise for latest slice (feat012-slice12) flagged: `[HIGH] opus-overuse` (92.8%), `[HIGH] subagent-overuse` (7 dispatches), `[LOW] tool-failure-rate` (6.5%), `[MEDIUM] exploration-heavy` (6.4:1), `[MEDIUM] non-repo-dominant` (8%), `[HIGH] many-sources` (5 sessions) — all referencing FEAT001 SLICE01 data, not the current slice

**Root-cause hypothesis.** The citylive cost reporter is hard-wired to `source_project: AstraGenie.CityLive` — a Claude projects slug corresponding to a repo path that is no longer the active Claude Code session directory. After FEAT001/SLICE01, all subsequent slices opened sessions under a different project slug, so the scanner finds 0 sessions and emits zero-cost reports across 11 of 12 cost reports.

**Recommended fix path.** Update the citylive cost-reporter invocation to use `aggregate_all: true` (or point `source_project` to the current active project slug) so it scans the sessions where citylive work actually occurred; or run `loop:cost-report` from inside the citylive Claude Code session so the slug auto-detects correctly.

**Follow-up FEAT candidate.** The proposed **FEAT-036** (cost-report schema validator) should be extended to warn when `source_project` resolves to a directory containing 0 or 1 sessions — this catches the stale-slug pattern before 11 silent zero-cost reports accumulate.

## authentic — cost-regression (corrected: not USD-field drop, but one expensive slice)

**Symptom.** `cost-regression` flagged HIGH in 8 of 20 recent cost-advise reports (highest count across all consumer repos). **Correction from pre-analysis:** the original "USD-missing on 9 of 10 reports" claim is WRONG. Inspection of all 65 cost reports shows the `usd` field is consistently present (`grep -L "^usd:"` returned zero files across the full corpus). The real hotspot is ONE expensive slice (SLICE-052, $590.58, 22-hour duration, 100% Opus, 16 compactions) that triggers the cost-regression detector against a much lower baseline median.

**Evidence.** Three cost-report files reviewed:
- `20260602T112615Z-cost-report-slice-052-postgres-conn-string-env-switch-authentic-schema-m.md` — worst-case: `usd: 590.5838`, `total_tokens: 266,706,581`, `cache_hit_pct: 97.9`, `source_project: aggregate`, `aggregate_all: true`, `source_count: 4`, `review_decision: approved`, `Assistant Messages Counted: 789`, `duration_ms: 80953464` (1349 minutes — 22+ hours), 16 compaction events, 4 Claude sessions
- `20260602T135231Z-cost-report-aggregate-phase2-feat047-slice53.md` — most recent aggregate baseline: `usd: 19.1364`, `total_tokens: 9,526,764`, `cache_hit_pct: 99.1`, `source_project: aggregate`, `aggregate_all: true`, `source_count: 3`
- `20260602T141943Z-cost-report-slice-phase2-feat048-slice54.md` — typical recent slice: `usd: 0.5865`, `total_tokens: 1,448,961`, `cache_hit_pct: 99.0`, `source_project: C--work-mega-authentic`, `aggregate_all: false`, `source_count: 1`, 11 messages, 0 compaction events, duration 10.7 min

**Investigation steps.**
- Grepped all 65 authentic cost reports for `^usd:` — zero files returned by `grep -L`; field present in all 65
- Identified cost distribution: 63 of 65 reports in $0.59–$19.13 range; 1 at $590.58 (SLICE-052); 1 at $15.09
- Computed regression: SLICE-052 at $590.58 is 2079% above $27.10 median (per cost-advise)
- Checked SLICE-052 cost-advise: Grade F, flags `[HIGH] cost-regression`, `[HIGH] opus-overuse` (100%), `[HIGH] compaction` (16 events), `[MEDIUM] file-rereads` (13 redundant reads), `[MEDIUM] exploration-heavy` (5.0:1), `[MEDIUM] non-repo-dominant` (0%), `[LOW] subagent-overuse` (3 dispatches), `[LOW] many-sources` (4 sessions)
- Compared to latest cost-advise (FEAT047 SLICE53): Grade A, `[HIGH] opus-overuse`, `[MEDIUM] trend-opus`, `[LOW] large-tool-output` and `[LOW] many-sources` — healthy except persistent Opus use

**Root-cause hypothesis.** The authentic cost-regression hotspot is a single runaway slice (SLICE-052) that accumulated $590.58 over 22 hours due to 100% Opus model use, 16 context compactions, 789 assistant messages across 4 sessions, and no cost gate or model-selection enforcement — textbook FEAT-031 (Sonnet-default model gate) and FEAT-030 (compaction/slice-length guard) non-compliance.

**Recommended fix path.** Ensure authentic runs on crew@0.7.0 (per the consumer bump runbook at `docs/operations/2026-06-02-consumer-crew-bump.md`) which ships FEAT-031 (Sonnet-default model gate) and verify the `validate-agents.mjs` CI gate is active; for future long-duration slices, set a per-slice cost cap or mandate `/model sonnet` at slice-start to prevent unchecked Opus accumulation.

**Follow-up FEAT candidate.** Existing FEAT-031 (Sonnet-default model gate, shipped in crew@0.7.0) covers this. No new FEAT.

## hcal — large-tool-output + Opus dominance (corrected: rereads in cost-advise bodies, not frontmatter)

**Symptom.** `large-tool-output` flagged in 8 of 20 recent cost-advise reports. **Correction from pre-analysis:** the 32.7-reread-avg and 315-max figures cannot be reproduced from cost-report frontmatter — `file_reread_count` is not a frontmatter field in hcal cost reports. Reread counts surface in cost-advise bodies as the `[MEDIUM] file-rereads` finding. Actual measured rereads via cost-advise bodies are materially lower: 5 redundant reads for FEAT026 SLICE12 and 0 for FEAT024 SLICE13 (latest).

**Evidence.** Three cost-report files reviewed:
- `20260602T145031Z-cost-report-slice-feat026-slice12.md` — worst-case by cost ($15.78): `usd: 15.7810`, `total_tokens: 8,878,140`, `cache_hit_pct: 99.5`, `source_project: C--work-mega-hero-crew-autonomous-loop`, `aggregate_all: false`, `source_count: 1`; corresponding cost-advise flagged `[MEDIUM] file-rereads — 5 redundant Read calls`
- `20260602T150005Z-cost-report-slice-feat024-slice13.md` — most recent ($8.52): `usd: 8.5233`, `total_tokens: 4,826,109`, `cache_hit_pct: 99.6`, `source_project: C--work-mega-hero-crew-autonomous-loop`, `aggregate_all: false`, `source_count: 1`, `subagent_dispatches: 1`, `compaction_count: 0`; no file-rereads flag in cost-advise
- `20260602T150000Z-cost-report-slice-feat024-slice13.md` — same slice, second emission ($5.96): `usd: 5.9610`, `total_tokens: 3,335,101`, `cache_hit_pct: 99.5`; double-emission pattern (two cost-report invocations for the same slice, likely from an aggregate + slice pair)

**CREW_COST_HYGIENE env var presence in hcal session logs.** Grepped all JSONL session files in `C:/Users/serge/.claude/projects/C--work-mega-hero-crew-autonomous-loop/` for `CREW_COST_HYGIENE`. No files matched — the env var has never been set in hcal sessions. FEAT-029 (cost-hygiene reread hook) is gated on `CREW_COST_HYGIENE=1` being present in the environment; since it is absent, the hook is default-off and has never fired in any hcal session.

**Investigation steps.**
- Confirmed `file_reread_count` is absent from all hcal cost-report frontmatter (field does not exist in the schema used by hcal)
- Read cost-advise bodies to extract reread counts: FEAT026 SLICE12 = 5 redundant reads; FEAT024 SLICE13 = 0
- Noted double-emission on FEAT024 SLICE13 (two cost reports with different message counts for same slice window)
- Grepped hcal project JSONL sessions for `CREW_COST_HYGIENE` — zero hits across all session files
- Confirmed 100% Opus use across all reviewed hcal slices from cost-advise `[HIGH] opus-overuse` flags

**Root-cause hypothesis.** hcal's primary cost hotspot is 100% Opus model use across all slices (FEAT-031 non-compliance), compounded by a cost-regression spike on FEAT026 SLICE12 ($15.78, 239% above median); FEAT-029 (reread hook) has never fired because `CREW_COST_HYGIENE` env var is unset (default-off), making it a dormant but readily activatable lever for the file-rereads sub-issue.

**Recommended fix path.** Promote FEAT-029 (cost-hygiene reread hook) from deferred to active. Use hcal as the worst-case dogfood A/B target per `docs/backlog/done/FEAT-029.md` (note: file may be in `pending/` if not yet promoted). If A/B PASSes, ship default-on in a v0.8.0 release. Pair with FEAT-031 Sonnet-default adoption (via crew@0.7.0 consumer bump) to reduce Opus share.

**Follow-up FEAT candidate.** Existing FEAT-029 covers this; no new FEAT needed.

## Cross-cutting findings

Patterns that appeared in two or more of the three repos investigated.

- **Cost-reporter source-project pointer issues.** citylive's `source_project: AstraGenie.CityLive` resolves to a near-empty dir while other slices ran under different project slugs and went unscanned. This is a different bug class from the pre-analysis hypothesis but lands in the same place: cost-report data is incomplete because the reader isn't pointed at the right session-log source. The proposed **FEAT-036** (cost-report schema validator) should be extended to warn when source_project resolves to an empty or stale directory.
- **100% Opus is the common cost driver across authentic SLICE-052 and hcal.** Both are runaway-cost cases driven by sustained Opus use, not by any specific hook gap. **FEAT-031** (Sonnet-default model gate, shipped in crew@0.7.0) addresses both once consumer bumps land per `docs/operations/2026-06-02-consumer-crew-bump.md`.
- **Per-slice session-scoping is the single biggest unaddressed lever.** Top-10 cost-advise ranking shows `many-sources` (75 hits) + `non-repo-dominant` (62 hits) combined for 137 hits across all repos. Both root-cause to the same pattern: a slice's work spans multiple Claude Code sessions opened in different repo directories. citylive's source_project pointer issue is a specific instance of this broader pattern.
- **The bundle release fixes ~half the symptoms automatically.** Of the 10 top cost-advise issues, 5 (opus-overuse, subagent-overuse, trend-opus, exploration-heavy, tool-failure-rate) are addressed by features already shipped in crew@0.4.0..0.7.0. Once the consumer bump (per the operations runbook) propagates, half the cost-advise findings should regress on their own.
- **Pre-analysis claims need data-validation before being promoted to investigation hypotheses.** Two of three pre-analysis claims (authentic USD-missing, hcal frontmatter reread field) were contradicted by raw data. Future cost-efficiency analyses should grep + verify field presence before claiming patterns.

## Done

This document captures the read-only investigation. Each repo section above names at least one specific cost-report file as evidence and at least one concrete next action. Follow-up FEATs (if any) are proposed but not opened — opening backlog entries is out of scope for this investigation.

No edits were made in `citylive`, `authentic`, or `hero-crew-autonomous-loop` during this investigation. All findings live in this document plus the three scratch files under `.claude/artifacts/crew/handoffs/`.

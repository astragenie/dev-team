---
id: FEAT-193
status: done
priority: P2
category: feature
target_release: null
created: 2026-07-06
updated: 2026-07-07
depends_on: [FEAT-188]
slices: [S1, S2, S3, SLICE-109]
shipped_slices: [S1, S2, S3]
remaining_slices: []
derived_from: null
pm_customer_impact: 0.4
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.75
pm_technical_risk: 0.45
pm_dependency_depth: 0.1
composite_score: 0.585
autonomous_safe: false
tags: ["stack:typescript", "surface:plugin", "concern:gepa", "concern:memory"]
triage_notes: "\"PM triage 2026-07-07. STATUS CORRECTION: this file's frontmatter was stale — S1 (failure→GEPA trial-store bridge) is ALREADY MERGED to main, not just 'wired'. git log shows the full S1 arc: 06085f54/f5c6ebef (build), cc0dea9a (merge, approved_with_notes), 58bc10ba (revert — CI regression, tests/crew-write-review-result.test.ts timed out cold), a15ee94c (fix-forward: timeout-guarded capture-failure-trial-guard.ts), 39543edf/608cb4d6 (re-merge), d9bb7465 (re-review, approved_with_notes). Handoff: .claude/artifacts/crew/handoffs/20260706T143308Z-handoff-feat-193-s1-failure-gepa-trial-bridge.md. Re-review: .claude/artifacts/crew/reviews/20260706T165736Z-review-result-feat-193-slice-a-re-review-cli-hang-fix.md. Hard dependency (FEAT-188 S1a specifically, not the whole FEAT-188) was satisfied before S1 even started (S1a's 4 capture points are the ones S1 wires into) — dependency_depth scored near-zero on that basis. Recommend backlog-promote this FEAT out of pending/ to reflect the true partial-shipped state (out of PM's write scope — use /runner:backlog-* per repo convention) and correct 'status' + 'slices' once that command runs."
DECISION: "autonomous_safe=false at the FEAT level, following the FEAT-188 precedent of gating the whole FEAT when any remaining slice touches the prompt-optimization pipeline even if other slices could individually qualify as safe. S2 (pure cross-repo aggregation/dedup, non-prompt-affecting) could plausibly be autonomous_safe on its own merits, but S3 (gepa-corpus-report) is explicitly the analyze-before-adjust human gate whose output directly informs a human's decision to run gepa-optimize + promote a candidate — per the FEAT's own text, 'Analyze-before-adjust is a required human gate — never blind auto-promote,' so the reporting tool that feeds that decision warrants human review before it's trusted, consistent with how S1's own dispatch was marked 'autonomous_safe=false... human/reviewer gate required, do not self-approve' in its handoff. Pre-mortem (Framework 3) not triggered — technical_risk 0.45 < 0.6 and priority is P2, not P0/P1.\""
started_at: 2026-07-07
slices_complete: [SLICE-109]
force_closed: true
slices_remaining_at_close: [S1, S2, S3]
completed_at: 2026-07-07
---
## Description

**GEPA-consumption layer on top of FEAT-188's capture/recall infra.** Rescoped
2026-07-06 after overlap dedup with FEAT-188 (MemoryProvider capture/recall):
FEAT-188 owns capturing failures/lessons and injecting recall at dispatch;
FEAT-193 owns feeding that captured signal into the **GEPA reflection corpus** and
closing the analyze-before-adjust optimization loop. Two distinct stores — 188 →
dispatch-recall (`learnings.jsonl` / MemoryProvider); 193 → the GEPA brain's trial
corpus (`.claude/artifacts/crew/gepa/trials/<agent>.jsonl`, the structured signal
`candidate-generator-aiplugin.ts` reflects on).

Topology (decided, memory `prompt-improvement-corpus-architecture`): agent prompts
are global (ship from dev-team); failures happen in each consumer repo where crew is
installed. Capture per-repo, aggregate agent-keyed into dev-team (the optimization
hub), analyze, then human-promote. Single machine today → git-based sibling scan,
zero infra; astramem team-recall v2 later for multi-user (additive swap).

**Analyze-before-adjust is a required human gate** — never blind auto-promote. GEPA
already proposes candidates and waits for human promotion (aiplugin-dev v1.2.4,
2026-07-06). This FEAT adds the per-agent failure digest that makes that review
informed.

## Slices (proposed — 3 unique to GEPA, all downstream of FEAT-188)

- **S1 — Failure → GEPA trial-store bridge. SHIPPED 2026-07-06** (see
  `triage_notes` for the full merge/revert/fix-forward/re-review arc;
  `approved_with_notes` both times). Consumes FEAT-188's capture events
  (review rejected/needs_fix, validation fail, inline-return-warn,
  subagent-incomplete) and appends them as **failing trials**
  (`pass:false` + rationale = the verdict/finding, agent-keyed;
  ships as `source:"captured"` + `input.capture_origin:"production_failure"`,
  a documented deviation from the original `source:"production"` spec text —
  see triage_notes risk note) to `.claude/artifacts/crew/gepa/trials/<agent>.jsonl`.
- **S2 — `gepa-corpus-sync` cross-repo aggregation.** Scan sibling repos on the
  machine, merge agent-keyed trials into the dev-team hub corpus. Dedup by
  `(agent, rationale-hash)`. Git-based now; astramem-transport-ready seam for v2.
  ~0.5–1d. Must key off `input.capture_origin === "production_failure"` per S1's
  documented deviation, not `source`.
- **S3 — `gepa-corpus-report` (the analyze gate) + feed-to-optimize.** Per-agent
  failure digest: cluster + rank failure modes, pull matching astramem lessons
  (FEAT-188 store), cite. Human reads it → `gepa-optimize <agent>` on the aggregated
  corpus → judge-scored candidate → human promotes. ~1d. Highest value after S1.

## Known blocker (fix before S3 auto-promotion wiring)

`scripts/lib/gepa/champion-provenance-writer.ts` prepends a `gepa:` YAML frontmatter
block ABOVE the agent's `name:` block; `validate-agents.ts` reads the first
`---…---` block and fails on missing `name`/`description` (AC-8 line-exemption is
line-count only, not field-read). Manual promotions must stay single-frontmatter
(provenance tracked in commit + opt artifact — see aiplugin-dev v1.2.4). Fix the
writer (merge `gepa:` into the existing block, or make validate-agents strip a
leading gepa block before field-read) before wiring any auto-promotion.

## Acceptance criteria

_S2 / S3 — authored 2026-07-07._ Given-When-Then, per triage_notes AC-quality gate. All trials referenced are the
production-failure signal only: `input.capture_origin === "production_failure"`
(the documented S1 deviation) — NEVER match on `source` (all such trials carry
`source: "captured"`, indistinguishable from eval trials by that field).

### S2 — `gepa-corpus-sync` (cross-repo aggregation)

- **AC-1 (S2 · aggregate):** GIVEN sibling repos on the machine each holding
  `.claude/artifacts/crew/gepa/trials/<agent>.jsonl` with production-failure trials,
  WHEN `gepa-corpus-sync` runs from the dev-team hub, THEN every trial with
  `input.capture_origin === "production_failure"` is merged into the hub's per-agent
  corpus keyed by agent.
- **AC-2 (S2 · dedup + idempotent):** GIVEN the same trial `(agent, rationale-hash)`
  exists in ≥2 sources (sibling+sibling or sibling+hub), WHEN sync runs, THEN it lands
  exactly once; AND re-running sync with no new trials adds zero rows.
- **AC-3 (S2 · completeness — product_completeness gate):** GIVEN N eligible sibling
  trials across M agents, WHEN sync completes, THEN `added + skipped_as_dup === N`
  (no trial silently dropped), AND sync emits a summary enumerating EVERY agent that
  contributed ≥1 trial with its added/deduped counts.
- **AC-4 (S2 · marker discipline):** GIVEN a trial with `source: "captured"` but WITHOUT
  `input.capture_origin === "production_failure"` (e.g. an eval trial), WHEN sync runs,
  THEN it is NOT aggregated.
- **AC-5 (S2 · read-only on siblings):** GIVEN sync scans sibling repos, WHEN it runs,
  THEN it only READS sibling trial files and WRITES only the dev-team hub corpus (never
  mutates a sibling); AND a sibling lacking the trials dir is skipped without error.

### S3 — `gepa-corpus-report` (analyze gate; feed-to-optimize)

- **AC-6 (S3 · digest):** GIVEN an aggregated hub corpus with failing trials, WHEN
  `gepa-corpus-report <agent>` runs, THEN it outputs a per-agent digest that clusters
  and ranks failure modes by frequency.
- **AC-7 (S3 · completeness):** GIVEN the hub corpus holds failures for M agents, WHEN
  `gepa-corpus-report` runs with no agent arg, THEN it enumerates ALL M agents with ≥1
  captured failure — not a partial/sampled subset.
- **AC-8 (S3 · astramem citation):** GIVEN FEAT-188 astramem lessons match a failure
  cluster, WHEN the report renders that cluster, THEN it pulls and cites the matching
  lesson(s) by id.
- **AC-9 (S3 · human gate — no blind auto-promote):** GIVEN the report informs
  `gepa-optimize`, WHEN report generation completes, THEN it does NOT invoke
  gepa-optimize or promote any candidate automatically — it only emits the digest for a
  human to act on.
- **AC-10 (S3 · provenance blocker cleared first):** GIVEN `champion-provenance-writer.ts`
  prepends a `gepa:` frontmatter block that breaks `validate-agents.ts`, WHEN any
  feed-to-optimize / promotion path is wired, THEN champion-provenance-writer is fixed
  first (single-frontmatter, or validate-agents strips a leading gepa block) — verified
  by `validate-agents.ts` passing on a provenance-written agent.

**Sequencing:** S2 (AC-1..5) is build-ready (no FEAT-185 coupling). S3 digest/report
half (AC-6..8) is build-ready; hold S3's `gepa-optimize` wiring (AC-9/10 paths) until
the gepa-core provider surface stabilizes (FEAT-185 SLICE-A/B) to avoid a moving judge/
provider stack.

## Refs

- FEAT-188 (`memory-provider-capture-recall`) — the capture/recall foundation this rides on.
- `docs/research/2026-07-06-agent-mid-job-death-analysis.md` — failure signals + inline-return-warn evidence.
- memory `prompt-improvement-corpus-architecture` — the decided topology + store separation.
- FEAT-192 (done) — the GEPA reflective-rewrite engine + AC-3 live proof this loop feeds.

## Intake notes

Created via free-text intake, then rescoped 2026-07-06 to remove ~80% overlap with
FEAT-188 (operator decision: "rescope 193 → GEPA layer on 188"). Priority unset —
run PM scoring before slicing.

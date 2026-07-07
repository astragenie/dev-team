---
id: FEAT-193
status: pending
priority: P2
category: feature
target_release: null
created: 2026-07-06
updated: 2026-07-07
depends_on: [FEAT-188]
slices: [S1, S2, S3]
shipped_slices: [S1]
remaining_slices: [S2, S3]
derived_from: null
pm_customer_impact: 0.40
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.75
pm_technical_risk: 0.45
pm_dependency_depth: 0.10
composite_score: 0.585
autonomous_safe: false
tags: ["stack:typescript", "surface:plugin", "concern:gepa", "concern:memory"]
triage_notes: "PM triage 2026-07-07. STATUS CORRECTION: this file's frontmatter was stale — S1 (failure→GEPA trial-store bridge) is ALREADY MERGED to main, not just 'wired'. git log shows the full S1 arc: 06085f54/f5c6ebef (build), cc0dea9a (merge, approved_with_notes), 58bc10ba (revert — CI regression, tests/crew-write-review-result.test.ts timed out cold), a15ee94c (fix-forward: timeout-guarded capture-failure-trial-guard.ts), 39543edf/608cb4d6 (re-merge), d9bb7465 (re-review, approved_with_notes). Handoff: .claude/artifacts/crew/handoffs/20260706T143308Z-handoff-feat-193-s1-failure-gepa-trial-bridge.md. Re-review: .claude/artifacts/crew/reviews/20260706T165736Z-review-result-feat-193-slice-a-re-review-cli-hang-fix.md. Hard dependency (FEAT-188 S1a specifically, not the whole FEAT-188) was satisfied before S1 even started (S1a's 4 capture points are the ones S1 wires into) — dependency_depth scored near-zero on that basis. Recommend backlog-promote this FEAT out of pending/ to reflect the true partial-shipped state (out of PM's write scope — use /runner:backlog-* per repo convention) and correct 'status' + 'slices' once that command runs.

DEMAND (Framework 1): stakeholder is internal — the operator running the GEPA prompt-optimization flywheel (memory prompt-improvement-corpus-architecture; FEAT-192 done = 'the GEPA reflective-rewrite engine + AC-3 live proof this loop feeds'). No end-customer evidence; demand_evidence beyond the architecture decision itself = none. Workaround today: GEPA already optimizes off source:eval trials without this production-failure signal — tolerable, not blocking, so customer_impact stays low-moderate (0.40) despite clear internal strategic backing.

SCOPE (Framework 2): smallest deliverable was S1 alone (already shipped, standalone value per its own handoff). Remaining S2 (gepa-corpus-sync, cross-repo git-based aggregation, dedup by (agent, rationale-hash)) and S3 (gepa-corpus-report, the human analyze-before-adjust gate + astramem citation) are both still pending/unbuilt in this repo. No overlap found with FEAT-188 (disjoint stores: learnings.jsonl/MemoryProvider vs gepa/trials/<agent>.jsonl — confirmed in FEAT-188's own description). AC clarity for S2/S3: the body's bullet-list slice descriptions are NOT Given-When-Then and would fail the AC-quality bar at slice-authoring time — but since composite lands P2 with no --deep/--spec flag on this dispatch, inline AC drafting is not triggered per the FEAT-277 gating table. Whoever slices S2/S3 next must draft real Given-When-Then ACs before dispatch.

RISK (Framework 3): technical_risk=0.45, band 0.3-0.5 ('new pattern in repo, no contract change, clean rollback') — S2 introduces cross-repo git-based sibling scanning (new pattern) with no schema/contract change of its own; S3 is read/report tooling over existing stores. Two live, NOT-yet-closed items inherited from the shipped S1 work that any S2/S3 build sits downstream of: (1) S1's re-review (20260706T165736Z) found a HIGH risk still open on main today — capture-failure-trial-guard.ts's Promise.race bounds the logical await chain but NOT real OS process wall-time (dynamic import isn't cancellable; scripts/crew.ts's success path never force-exits) — currently latent only because bun.lock/package-lock.json both resolve gepa-core to 0.7.0 (compiled dist, ~105ms cold-import; verified via grep this session, drift from the review's flagged 0.6.0-vs-0.7.0 lockfile mismatch is NOW RESOLVED). (2) The review's Required Follow-up #2 — 'fireCaptureTeeSilent... has zero protection [and should be] Prioritize[d]... ahead of other FEAT-193/FEAT-185 work' — is STILL UNADDRESSED (grep confirms scripts/lib/artifacts/write.ts's fireCaptureTeeSilent has no captureFailureTrialGuarded-style race as of this triage). Neither blocks S2/S3 scoring but both are inherited blast-radius risk for the shared capture pipe S2/S3's data depends on. Also inherited: S1's handoff documents an accepted schema deviation (source:'production' doesn't exist in gepa-core's TrialSchema enum; uses source:'captured' + input.capture_origin:'production_failure' marker instead) — any S2/S3 consumer MUST filter on that marker, not on source, or it will silently miss all production-failure trials.

GRADE FEEDBACK (Framework 4): last-5-by-timestamp grade files (slice107/108/94/95, then slice87) are 4-of-5 unfilled all-zero placeholders — this IS the FEAT-188-documented placeholder-rot problem (S1a's own AC targets fixing this), so those zeros are a known pipeline defect, not a real quality signal, and are excluded from the weak-dimension read. Using the last 4 REAL (non-placeholder) grades instead (slice84-87, 2026-06-20): architecture_quality avg 0.873, reliability avg 0.878, observability avg 0.845, production_readiness avg 0.86, security avg 0.858, test_confidence avg 0.915, product_completeness avg 0.7875 — product_completeness is the weak dimension (< 0.80). No lessons-digest command available in this repo (bun src/scripts/loop.mts does not exist here; the loop CLI lives in the companion runner-plugin per this repo's own loop-snapshot.md note) — could not run Framework 4's mandated digest read; noting the gap rather than fabricating a lessons quote. Whoever authors S2/S3 ACs must include at least one AC targeting product_completeness (e.g., a completeness assertion that gepa-corpus-sync's cross-repo dedup does not silently drop trials, or that gepa-corpus-report enumerates all agents with >=1 captured failure rather than a partial sample).

EFFORT (Framework 5): S1 alone (this session's closest analog) churned through build→merge→revert→fix-forward→re-review — more than its own ~1d nominal estimate; no isolated single-slice cost report exists for S1 specifically (its dispatch ran inside a larger session), so I compared against SLICE-107 ($174.18, 158min, single session, 6 subagent dispatches — a similarly-shaped 'wire new gepa-core-adjacent capability into existing capture points' slice) and SLICE-108 ($68.20, 59min, single session, lighter cross-repo/decomposition-style task) as shape analogs for the S2/S3 remainder. Remaining S2 (~0.5-1d, cross-repo git scan + dedup) + S3 (~1d, digest/report + astramem citation) land closer to the SLICE-108 shape (moderate, not epic) than SLICE-107's churn-heavy shape, since S1 already absorbed the 'new gepa-core integration' unknowns. effort_estimate=0.55 (~5 Fibonacci points on the standard 1/2/3/5/8/13 ladder) reflects this — well under the >=8-point decomposition-mandatory gate, so no proposed_slices YAML block is required (Framework 6); the body's existing S1/S2/S3 slice list already stands as an adequate decomposition record.

DECISION: autonomous_safe=false at the FEAT level, following the FEAT-188 precedent of gating the whole FEAT when any remaining slice touches the prompt-optimization pipeline even if other slices could individually qualify as safe. S2 (pure cross-repo aggregation/dedup, non-prompt-affecting) could plausibly be autonomous_safe on its own merits, but S3 (gepa-corpus-report) is explicitly the analyze-before-adjust human gate whose output directly informs a human's decision to run gepa-optimize + promote a candidate — per the FEAT's own text, 'Analyze-before-adjust is a required human gate — never blind auto-promote,' so the reporting tool that feeds that decision warrants human review before it's trusted, consistent with how S1's own dispatch was marked 'autonomous_safe=false... human/reviewer gate required, do not self-approve' in its handoff. Pre-mortem (Framework 3) not triggered — technical_risk 0.45 < 0.6 and priority is P2, not P0/P1."
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

## Refs

- FEAT-188 (`memory-provider-capture-recall`) — the capture/recall foundation this rides on.
- `docs/research/2026-07-06-agent-mid-job-death-analysis.md` — failure signals + inline-return-warn evidence.
- memory `prompt-improvement-corpus-architecture` — the decided topology + store separation.
- FEAT-192 (done) — the GEPA reflective-rewrite engine + AC-3 live proof this loop feeds.

## Intake notes

Created via free-text intake, then rescoped 2026-07-06 to remove ~80% overlap with
FEAT-188 (operator decision: "rescope 193 → GEPA layer on 188"). Priority unset —
run PM scoring before slicing.

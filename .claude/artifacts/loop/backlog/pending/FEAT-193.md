---
id: FEAT-193
status: pending
priority: null
category: feature
target_release: null
created: 2026-07-06
updated: 2026-07-06
depends_on: [FEAT-188]
slices: []
derived_from: null
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

- **S1 — Failure → GEPA trial-store bridge.** Consume FEAT-188's capture events
  (review rejected/needs_fix, validation fail, inline-return-warn,
  subagent-incomplete) and append them as **failing trials**
  (`pass:false` + rationale = the verdict/finding, `source:"production"`, agent-keyed)
  to `.claude/artifacts/crew/gepa/trials/<agent>.jsonl`. Depends on FEAT-188 S1
  (capture) landing first. ~1d. Unblocks the rest; build first.
- **S2 — `gepa-corpus-sync` cross-repo aggregation.** Scan sibling repos on the
  machine, merge agent-keyed trials into the dev-team hub corpus. Dedup by
  `(agent, rationale-hash)`. Git-based now; astramem-transport-ready seam for v2.
  ~0.5–1d.
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

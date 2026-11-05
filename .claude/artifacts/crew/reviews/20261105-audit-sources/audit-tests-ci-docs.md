# Audit: tests, CI, docs, telemetry, governance (dev-team / crew v0.67.0)
Read-only. Date 2026-11-05. `bun run test` run 1: 2041 pass / 118 skip / 3 fail, 2162 tests, 215 files, 330 s. Run 2 straight after: 5 failures, a different set.

## Ranked findings
1. HIGH - Timing assertions make the suite non-deterministic. Failing in run 2: hook cold start (Windows p50 272ms vs 250ms limit, a 28 s test), capture-perf (51 s test), writeArtifact capture guard (431ms), smoke claims family, buildHandoffDigest creditLoop. Files: tests/hook-cold-start-bench.test.ts, tests/gepa/capture-perf.test.ts. Fix: move benches to a non-gating `bench` script.
2. HIGH - Loop rules point at paths that no longer exist. `.claude/loop/rules.md` (lines ~12-30) tells agents to scan `docs/backlog/pending/`, `docs/backlog/triaged/`, `docs/ai-loop/slices/pending/` and `docs/ai-loop/01-loop-control/EVIDENCE_RULES.md`. `docs/ai-loop/` does not exist; `docs/backlog/` only has README, template, product-backlog. Real tree: `.claude/artifacts/loop/backlog/`. CLAUDE.md says the opposite. rules.md:7 says "write artifacts and push" while rules.md:127 and CLAUDE.md say never push in the loop. File is "plugin-managed", so fix is upstream in runner-plugin.
3. HIGH - loop-snapshot.md (auto-included at session start) is stale. Dated 2026-07-07: pending 1, done 130, FEAT-188 in flight. Disk: pending 4, triaged 0, in-progress 0, done 165, FEAT-188 `status: done`. The regenerator `bun src/scripts/loop.mts snapshot-memory` named in CLAUDE.md does not exist here (no `src/` dir). The project constitution also cites `src/scripts/lib/slice-linker/dispatch.mts`, absent.
4. HIGH - Cost telemetry is polluted by aggregate rows. `.claude/artifacts/crew/cost/` has 218 reports. 81 are `aggregate_all: true` (sum $90,912, max $32,101 = 193 sessions, 17.3B tokens across all projects, Jun 29-Jul 7). 137 per-slice reports sum $28,360, max $4,027. Overall median $51.3. 4 reports are $0 (latest, SLICE-113: "Sessions Scanned: 0", source project is a worktree dir). The "$2433/iteration" in the snapshot is SUSPECTED to be a mean over the mixed set. `ceilingUsd:75` in loop.json is meaningless against these.
5. MED - Grades ~0.5 is a data bug, not a broken grader. 54 grade files average 0.65-0.80 per axis (observability lowest). The last two files (SLICE-112, SLICE-113, 2026-07-08) are template stubs: title "<fill title>", five axes literally 0. The last-5 average mixes 3 real + 2 stubs, giving ~0.5. Grades are also self-assessed by the loop that built the slice. Two stores (grades.jsonl 11 lines vs 84 md files). Fix: reject score 0 and unfilled templates at write time.
6. MED - Scheduled memory-drift-check (`.github/workflows/drift.yml`) is dead. Every daily run seen (Oct 5-19, 15 in a row) ended `cancelled` after ~24 h: queued for runner `[self-hosted, astragenie, aws]` that never picked it up. Pure noise; moot now that the repo is archived.
7. MED - docs/memory.md and AGENTS.md vs reality:
   - Memory says model routing active ("builds route to Sonnet via loop.modelRouting"); `.claude/loop.json` has `loop.modelRouting.enabled:false`. Only the crew.json features toggle (not checked) could reconcile. SUSPECTED contradiction.
   - Skill count "49 (universal 6, workflow 29, domain 13, meta 1)" in memory and AGENTS.md. Disk has 71 SKILL.md (6 / 28 / 36 / 1). Domain has 13 top-level dirs but 36 skills (nested).
   - Agents 23: correct. Version 0.67.0 in package.json and plugin.json: correct. docs subdirs 17: correct.
   - Memory "do not re-raise" list claims README skill count fixed to 49; it is 71 on disk.
8. MED - Session-start load is heavy and duplicated. Bytes via @includes: global CLAUDE 60, global constitution 3,692, global workflow 2,124, project CLAUDE.md 11,080, AGENTS.md 6,517, project constitution 5,359 (overlaps global one ~70%), snapshot 1,713 = 30.5 KB (~7.6k tokens). CLAUDE.md's "first action" adds rules.md 12,441, MASTER_PROMPT 2,304, approved-slices 835, plus the mandatory docs/memory.md 4,888 = +20.5 KB. Total ~51 KB (~12.7k tokens) before any task. Altitude model: CLAUDE.md went 297 to 166 lines, but it is still 11 KB and still includes the snapshot and constitution. Partial win.
9. MED - Governance density. Directive-word counts (MUST, HARD RULE, mandatory, NEVER, do not, required): CLAUDE.md 20, AGENTS 4, project constitution 13, global constitution 3, workflow 2, rules.md 30, MASTER_PROMPT 1 = 73; 7 "HARD RULE" headings. They conflict (push; backlog path; "/crew:build needs no run-brief" vs workflow "substantial run start -> run brief"). Violation evidence: slices 112 and 113 closed with a stub grade and a $0 cost report despite the "close ceremony MUST" rule. SUSPECTED that rules are followed in form (files emitted), not substance.
10. MED - Prompt-text tests. tests/backend-dev-prompt.test.ts, frontend-dev-prompt.test.ts, agent-prompt-content.test.ts, integrator-prompt.test.ts assert regexes on agents/*.md (e.g. /FIRST step/i). They freeze wording, not behavior, and fight GEPA prompt optimization. tests/test-shard.test.ts and docs-only.test.ts test CI plumbing (tests of test infra).
11. LOW - Test hygiene: 22 setTimeout/sleep, 72 Date.now/new Date, 0 fake-timer usages. 8 skip/todo markers in source, 118 skipped at runtime (env-gated: astramem paired, Linux-only). Mixed node:test and bun test imports.
12. LOW - Ratio: tests 42,230 LOC (215 test files, 297 incl. fixtures) vs scripts+hooks+lib 38,335 LOC = 1.10:1. 2162 tests. Coverage volume is fine; flakiness is the problem. No evidence of tests for deleted features (bun resolves all imports; none failed on import).
13. LOW - prune-artifacts.ts only scans `.claude/artifacts/crew/`, default 90 days, manual only (not in CI or hook). `loop/` (backlog 1.1 MB, ai-loop 0.5 MB, plans, trajectories) is never pruned.

## CI facts
- test.yml 124 lines: changes -> checks (reusable astragenie/common@v1) + test (3 shards, `bun run test:shard`) -> gate. All self-hosted. Other workflows: agent-eval-regression (48 lines), auto-merge (99), drift (76).
- Last 40 runs (Jul 17 - Aug 19): 36 success, 3 failure, 1 cancelled. Success wall time: docs fast path 0.2-1.7 min; code PRs 7-30 min, trending up (last 8 runs 14-29 min). SUSPECTED queue wait on the single self-hosted pool rather than compute.
- Failing steps over ~25 failed runs seen: "Validators (must pass)" ~10, "Bun commands (lint/format/typecheck/test)" ~9, "Install dependencies" ~6 (private npm auth, infra).
- e2e smoke retried 3x with sleep 5; CHANGELOG line ~1765 and handoffs 20260706/20260712 cite timing flakes (log_event.sh, astramem paired test). Retries hide flakiness.
- Validators: 13 hard + 2 fixture loops + 4 advisory + lint/format/typecheck. CHANGELOG mentions: validate-agents 22, manifests 12, skills 11, routing-table 6, syntheses 5, slices 5; badges/loop-state/bundles/configs/org-refs/workflows/dispatch-graph/agent-refs 0-2 each. First three earn their keep. Rest SUSPECTED low catch rate (no per-validator failure data).

## Docs sprawl
- docs/: 127 files, 32,409 md lines, 1.57 MB. docs/superpowers alone: 52 files / 22,396 lines = 69%. architecture 3,478 lines / 12 files, standards 1,241. routing-table.md is 36 KB despite being "consulted at session start".

## Committed artifacts
- .claude/artifacts: 2,062 files, ~12 MB. crew: handoffs 367 files/1.8 MB, runs 265/1.3 MB, reviews 202/1.1 MB, cost 218/1.1 MB, cost-insights 166/0.7 MB, agents 105/0.6 MB, bundles 16/1.4 MB. loop: backlog 173/1.1 MB, ai-loop 79, trajectories 114, plans 67, grades 84.
- Git: 1,442 commits, .git 30 MB. Since Jul 1 artifact churn is 18,623 added / 2,700 deleted lines out of 77,662 total added = ~24% of line churn.
- Pays off: handoffs, decisions, backlog. Pollutes: cost, cost-insights, bundles, trajectories, spans, agents stats (machine-derived, regenerable, and currently wrong).
- Backlog: in-progress empty, FEAT-188 done, pending 4 (FEAT-190, 195, 205, FEAT-two-way-tracker-sync which has no number).

## Drastic improvements
1. Collapse session start to ~12 KB: single constitution (drop the duplicate), stop @including the snapshot, load rules.md/MASTER_PROMPT/memory.md only inside the loop skill. Saves ~10k tokens per session and per inheriting subagent.
2. Quarantine timing tests into non-gating `bun run bench`; remove e2e 3x retry. Deterministic gate; local run drops by about 80 s (two perf tests alone).
3. Stop committing derived telemetry (cost, cost-insights, bundles, trajectories, spans, agent stats). Keep handoffs, decisions, backlog, reviews. Removes ~5-6 MB and ~20% of diff churn.
4. Validate telemetry at write time: reject zero/stub grades and zero-session cost reports; split aggregate from per-slice. Then snapshot numbers mean something, or drop the snapshot.
5. Merge the 13 hard validators into one `validate-all` with a rule manifest; demote zero-catch ones to advisory. Add queue-vs-run timing to CI before blaming compute.

## Unverified
- Per-validator catch rate; cause of rising CI wall time; crew.json model-routing toggle; exhaustive stale-doc diff.

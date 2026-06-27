---
id: FEAT-183
status: triaged
priority: P1
category: capability
target_release: null
created: 2026-06-27
depends_on: []
slices: [SLICE-96, SLICE-97, SLICE-98, SLICE-99, SLICE-100, SLICE-101, SLICE-102, SLICE-103, SLICE-104, SLICE-105, SLICE-106]
derived_from: docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md
tracks_issue: astragenie/dev-team#121
pm_customer_impact: 0.85
pm_effort_estimate: 0.85
pm_strategic_alignment: 0.85
pm_technical_risk: 0.65
pm_dependency_depth: 0.30
composite_score: 0.65
autonomous_safe: false
tags: [gepa, agents, big-feature, library-extraction, cross-plugin, prompt-optimization, eval, soak]
triage_notes: "Derived 2026-06-27 from the 947-line architect-reviewed design at docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md (3 review passes, 25 resolved concerns C1-C25). Departs from ticket #121's monolithic 'crew feature' framing — algorithms extract to a new ESM library `@astragenie/gepa-core` in repo `astragenie/gepa-core`; crew is the first consumer (thin glue: capture tee, commands, gepa.config.json, eval datasets). 11 slices total (S1 + S2 + S3 + S4 + S5a + S5b + S5c + S6 + S7 + S8a + S8b), ~5 calendar weeks. autonomous_safe=false because Phase 3 optimization mutates builder/reviewer/inspector/architect agent prompts via auto-PR — humans MUST review per repo lead-prompt-edit policy (FEAT-167 model_pinned precedent + critical-agent allowlist in spec). Composite 0.65 → P1: customer_impact 0.85 (reusable cross-plugin lib + ongoing prompt quality lift), strategic 0.85 (centerpiece for plugin family + sales-team plugin reuse), effort 0.85 (24-day epic across 2 repos), risk 0.65 (new pkg + cross-plugin contract + auto-merge to main + soak phase mechanics), dependency_depth 0.30 (no hard prereqs but optional integrations with runner-plugin#289 + memory-plugin#8)."
---

# FEAT-183: GEPA — skill improvement loop

## Context

This FEAT lands GEPA (Genetic-Pareto reflective prompt evolution) for crew agent prompts. The full design lives at `docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md` (947 lines, architect-reviewed across 3 passes, 25 concerns resolved). It tracks GitHub issue [astragenie/dev-team#121](https://github.com/astragenie/dev-team/issues/121) but departs from that ticket's monolithic "crew feature" framing — algorithms extract to a new ESM library `@astragenie/gepa-core` in a new repo `astragenie/gepa-core`, and crew becomes the first consumer with thin glue (capture tee, commands, `gepa.config.json`, eval datasets). Future plugins (e.g. a sales-team plugin) reuse the library without forking.

## Goal

Ship a working capture → eval → optimize loop for 6 v1 target agents (`fullstack-dev`, `backend-dev`, `frontend-dev`, `verifier`, `inspector`, `architect`) such that:

- Every crew dispatch tees a trial into a `TrialStore` with bounded walltime (default 2 s, fail-silent on miss).
- `/crew:gepa-eval <agent>` scores the current champion prompt against a hand-seeded + auto-grown eval dataset.
- `/crew:gepa-optimize <agent>` generates K=5 candidate prompts, Pareto-ranks them on `pass × score × cost × latency`, runs a 5-condition promotion gate (pass-delta floor + tail-risk floor + no cost/latency regression + dual-gate clock-AND-sample soak + agent-eligible), and auto-merges via a `gepa/<agent>/<trial-id>` PR — or files a draft PR for critical agents (`inspector`, `verifier`, `architect`).
- Defaults (`fileStore` + `sequentialRunner` + `ollamaJudge` against `llama3.2:latest`) work with zero hard cross-plugin deps and no paid SDKs installed.

## Non-goals

Mirror the design spec's non-goals (lines 22–32):

- Multi-agent simultaneous optimization (v2).
- `aiplugin-dev` evaluation — meta-agent, requires recursive downstream-Δ measurement (v2+).
- Scheduled nightly optimization via `runner-plugin` ceremony (v2).
- Auto-promotion without soak phase.
- Changes to `astramem-local` schema (existing `fact` type + tags sufficient).
- Provider-switching, marketplace ownership of GEPA agents in third-party plugins.
- `anthropicJudge` adapter (v2; only if Ollama + Azure + Gemini judge quality proves insufficient).
- Cross-agent regression gate spanning historical eval suites (v2).
- Champion-no-regression check against prior eval datasets of sibling agents (v2).

## Acceptance criteria

AC-1: Given a fresh consumer plugin install with no `gepa.config.json` present, When any `/crew:build` dispatch fires, Then zero trials are written under `.claude/artifacts/crew/gepa/` and the artifact tree under `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/` is byte-identical to a control run executed before this FEAT shipped.

AC-2: Given `gepa.config.json` exists with default `capture.enabled: true` and `storage.backend: "file"`, When `/crew:build` dispatches `crew:fullstack-dev` and the dispatch completes, Then a JSONL line appears in `.claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl` matching `TrialSchema` (Zod) with `source: "captured"` and `candidate_prompt_hash` equal to `sha256(agents/fullstack-dev.md)` within `capture.walltime_ms` (default 2000 ms) of dispatch completion.

AC-3: Given the 6 v1 target agents (`fullstack-dev`, `backend-dev`, `frontend-dev`, `verifier`, `inspector`, `architect`) each have at least 5 hand-seeded eval cases under `agents/<name>/.gepa/eval/*.jsonl` (with `held_out: true` flag on a 20% split), When `/crew:gepa-eval <agent>` runs against the champion prompt, Then an aggregate artifact at `.claude/artifacts/crew/gepa/eval/<run-id>.json` is written containing `pass_rate`, `p50_cost_usd`, `p50_latency_ms`, and `median_rubric` fields, and one trial row per case is appended to the agent's `fileStore` JSONL with `source: "eval"`.

AC-4: Given `/crew:gepa-optimize fullstack-dev --k 5` runs on a corpus containing at least 10 failing trials, When the cycle completes without budget exhaustion, Then either an `OptimizationResult` JSON artifact at `.claude/artifacts/crew/gepa/opt/<run-id>.json` is written with `no_winner: true` (clean exit) OR a `gepa/fullstack-dev/<trial-id>` branch + PR opens whose head commit edits `agents/fullstack-dev.md` and adds a `gepa:` YAML frontmatter block with `champion_from_trial`, `prior_prompt_hash`, and `promoted_at` keys.

AC-5: Given a crafted regression candidate that scores 10pp below the main champion on the held-out set, When optimization runs end-to-end, Then `paretoRank` excludes the candidate from `pareto_rank == 1`, the 5-condition promotion gate refuses promotion, the event `gepa_tail_risk_block` is emitted to `.claude/logs/events.jsonl`, and no branch or PR is created.

AC-6: Given an agent on the critical allowlist (`inspector`, `verifier`, `architect`) wins its Pareto cycle with all gates green, When the auto-merge step would normally fire, Then the PR is opened with `--draft` flag and the event `gepa_critical_agent_draft_pr` is logged; no `gh pr merge --auto --squash` call is made for that agent.

AC-7: Given two sibling git worktrees both invoke `/crew:gepa-eval fullstack-dev` concurrently, When the second invocation reaches the `LockManager.acquire()` call, Then it returns `null`, the command exits with stdout/stderr containing `already_in_progress: <other-pid>` and exit code 2, and no partial trial rows from the second invocation appear in the JSONL.

AC-8: Given `gepa.optimize.paused: true` or `champion_frozen: ["inspector"]` is set, When `/crew:gepa-optimize inspector` runs, Then the command exits before any `CandidateGenerator.generate` call (no budget spent) with stderr containing `optimize_paused` or `champion_frozen` respectively.

## Sub-slices table

| Slice | Repo | One-line scope |
|---|---|---|
| SLICE-96 (S1) | new repo `astragenie/gepa-core` | Bootstrap ESM pkg + Zod schemas + `fileStore` + `sequentialRunner` + `binaryScorer` + `dailyCapMeter` + `fileLockManager` + `paretoRank` + `dominates` + `validateCandidateSize` + unit tests + semver + CHANGELOG |
| SLICE-97 (S2) | `dev-team` (crew) | `gepa.config.json` loader + `gepaCapture()` tee in fullstack-dev artifact writers + `/crew:gepa-history` + capture-absent parity test + SIGKILL-during-put torn-line test + capture-perf bench |
| SLICE-98 (S3) | `dev-team` | 5 hand-seed eval cases for fullstack-dev + `/crew:gepa-eval` cmd + train/heldOut splitter + lock acquire/release |
| SLICE-99 (S4) | `dev-team` | `/crew:gepa-optimize fullstack-dev --artifact-only` (no PR, no merge) + `CandidateGenerator` wraps aiplugin-dev + budget cap via `dailyCapMeter` + Pareto math + 3-cycle no-winner halt. **CHECKPOINT 1** |
| SLICE-100 (S5a) | `gepa-core` | `LLMJudge` interface + `ollamaJudge` (separate entry point) + `rubricScorer` impl + `validateTrialCorpus` + `detectEvalDrift` |
| SLICE-101 (S5b) | `gepa-core` + `dev-team` | `azureOpenAIJudge` (peer-dep `@azure/openai`) + `geminiJudge` (peer-dep `@google/generative-ai`) + per-agent `judge_per_agent` switch + `agents/<name>/.gepa/rubric.md` loader |
| SLICE-102 (S5c) | `gepa-core` + `dev-team` | `astramemStore` + `sharedAstramemMeter` + horizontalize seed datasets + eval runs for backend-dev, frontend-dev, verifier |
| SLICE-103 (S6) | `dev-team` | Inspector bug-corpus mining + 10-case eval set + inspector eval run using `rubricScorer` (breaks scorer-circularity) |
| SLICE-104 (S7) | `dev-team` | Architect hand-labeled cases (8–10) + soak monitor (dual clock + sample floor + early-revert) + `PromotionPolicy` defaults + `champion_frozen` list support. **CHECKPOINT 2** |
| SLICE-105 (S8a) | `dev-team` + `gepa-core` | Auto-PR via gh CLI on `gepa/<agent>/<trial-id>` branch + branch-protection presence check + champion provenance frontmatter writer |
| SLICE-106 (S8b) | `dev-team` | Auto-merge gate (5 conditions) + critical-agent allowlist + `/crew:gepa-invalidate` + `/crew:gepa-revert` + `/crew:gepa-thaw` + observability events |

Total: 24 working days ≈ 5 calendar weeks. Slice dependency graph in design spec lines 871–891.

## Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Auto-merge to `main` on critical agents could cascade engineering-loop failures (architect concern C1, C9) | High | Critical-agent allowlist (`inspector`, `verifier`, `architect`) forces draft PR; never auto-merge. Branch-protection presence check (`gh api repos/:owner/:repo/branches/main/protection`) refuses auto-merge if missing (concern C21, AC-6). |
| Soak phase is statistical theatre on low-volume agents (n=3 over 7 days) (architect concern C13) | High | Dual-gate `PromotionPolicy.minSoakTrials: 20` floor + `maxSoakDays: 21` hard cap; revert with `soak_insufficient_traffic` if traffic never reaches floor (design spec lines 638–650). |
| Capture path adds latency or alters dispatch artifacts (architect concern C18) | Med | `captureParityGoldenTest` (byte-diff including SIGKILL-during-put case) + `capture-perf` bench asserting `p50 ≤ 50 ms / p99 ≤ 200 ms / max ≤ walltime_ms`. Hard CI gate. Capture is fail-silent, walltime-bounded `Promise.race`. |
| Concurrent eval/optimize from sibling worktrees corrupt trial corpus (architect concern C17) | Med | `LockManager` interface + `fileLockManager` built-in writes to `.claude/artifacts/crew/gepa/locks/<worktree-sha256>-<agent>.<op>.lock` with PID + heartbeat; `acquire()` returns null on collision, command exits with code 2 (AC-7). |
| Cross-plugin contract drift between `gepa-core` and crew (architect concern C23) | Med | Strict semver; CHANGELOG.md mandatory per release; consumer plugins pin `^MAJOR.MINOR`; `scripts/check-semver.ts` diffs exported interfaces against prior release. |
| Candidate prompt exceeds 350-line cap and burns budget on oversized prompts (architect concern C19) | Med | `validateCandidateSize` invoked by `RunnerAdapter` BEFORE any LLM call; rejects with `pareto_rank: null` + rationale `oversized_candidate`. No budget spent. |
| Per-judge score normalization absent — `inspector` (Ollama) and `architect` (Azure) scores aren't strictly comparable (design open question line 923) | Low–Med | v1: do NOT cross-compare across judges in promotion gate. Decision deferred to v1.1 telemetry; document in S5b run brief. Hard block: if any `judge_per_agent` agent is on auto-merge allowlist, must resolve before S5b ships. |
| Manual review queue backlog as critical-agent draft PRs accumulate | Low | Cadence undefined intentionally; tracked via `gepa_critical_agent_draft_pr` event and observable in `.claude/logs/events.jsonl`. Operator runs batch review weekly. |
| Live LLM judge cost exceeds daily cap (`gepa.budget.daily_usd: 50`) on horizontalized eval | Low | `dailyCapMeter` blocks new cycles when `today_spent >= cap`; partial-run flag prevents promotion on budget halt. |

## References

- Design spec: `docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md` (947 lines)
- Ticket: [astragenie/dev-team#121](https://github.com/astragenie/dev-team/issues/121)
- Architect review (3 passes) and critical-thinking pushback: 25 concerns C1–C25 resolved in the design spec's "Resolved concerns" table (lines 54–82)
- Cross-plugin contracts referenced (no hard deps): `memory-plugin#8` (memory storage), `runner-plugin#289` (wave dispatcher)
- Validator that needs `.gepa/` subdir + frontmatter awareness: `scripts/validate-agents.ts` (line 668–671 of design spec)

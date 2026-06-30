# FEAT-183 GEPA Loop — Wave Plan + Backlog-Reality Reconciliation

**Date:** 2026-06-30
**Status:** draft pending architect-reviewer
**Author:** dispatcher (orchestrator)
**Scope:** SLICE-96..106 (11 slices) — restate against gepa-core@0.3.1 + dev-team current

## Why this doc exists

The backlog (under `.claude/artifacts/loop/backlog/triaged/SLICE-9{6..106}`) was authored 2026-06-27 against a pre-FEAT-184 / pre-FEAT-185-S-A reality. Between then and now (2026-06-30):

- `@astragenie/gepa-core` published v0.1.0 → v0.3.1 across PRs #122 / #123 / #124 (gepa-core repo) and FEAT-184 / FEAT-185-S-A in dev-team.
- SLICE-96 (gepa-core bootstrap) shipped under different commits without being closed.
- SLICE-97 (capture tee + history command + parity tests) shipped under PR #123/#124 without being closed.
- SLICE-100 (LLMJudge + Ollama + rubricScorer + validators) — first 2 deliverables done; 3 missing.
- SLICE-101 (azure + gemini + per-agent config + rubric.md) — gemini done; rest missing.

Plowing into a 7-wave plan against the original backlog would re-implement ~3-4 weeks of already-shipped work. This doc closes the gap, restates remaining scope, and proposes the new wave layout.

## Slice-by-slice reconciliation

### SLICE-96 — gepa-core bootstrap

**Status:** DONE — close as superseded.

Evidence — all required modules exist in `C:/work/mega/gepa-core/src/`:

| Backlog deliverable | Actual path |
| --- | --- |
| `gepa-core/src/types.ts` | `src/types/{trial,eval-case,score-result,crew-artifact,agent-run,candidate,gepa-config}.ts` + `src/types/index.ts` |
| `gepa-core/src/interfaces.ts` | `src/interfaces.ts` |
| `gepa-core/src/index.ts` | `src/index.ts` |
| `gepa-core/src/stores/file-store.ts` | `src/store/file-store.ts` (singular dir) |
| `gepa-core/src/runners/sequential-runner.ts` | `src/runner/sequential-runner.ts` |
| `gepa-core/src/scorers/binary-scorer.ts` | `src/scorer/binary-scorer.ts` |
| `gepa-core/src/meters/daily-cap-meter.ts` | `src/budget/daily-cap-meter.ts` |
| `gepa-core/src/locks/file-lock-manager.ts` | `src/lock/file-lock-manager.ts` |
| `gepa-core/src/algorithms/pareto-rank.ts` | `src/pareto/rank.ts` |
| `gepa-core/src/validators/validate-candidate-size.ts` | `src/validators/candidate-size.ts` |
| `scripts/check-semver.ts` | `scripts/check-semver.ts` + `tests/scripts/check-semver.test.ts` |

All 16 test files present. CHANGELOG covers 0.1.0 → 0.3.1.

**Action:** Move slice file to `.claude/artifacts/loop/slices/completed/` with note `superseded: shipped across PR-#122/#123/#124 + FEAT-184/185-A`. No new code.

### SLICE-97 — capture tee + gepa-history + parity tests

**Status:** DONE — close as superseded.

Evidence — `scripts/lib/gepa/` has `capture-tee.ts`, `load-config.ts`, `history.ts`, `adapt-artifact.ts`. `commands/gepa-history.md` ships. `tests/gepa/` has 10 test files including `capture-parity`, `capture-perf`, `capture-absent-parity`, `capture-sigkill-parity`, `capture-walltime`, `gepa-history`, `load-config`, `adapt-artifact`. Shipped via PR #123/#124 (per snapshot.md).

**Action:** Close as superseded. No new code.

### SLICE-98 — 5 eval cases + /crew:gepa-eval cmd + train/heldOut splitter + lock acquire/release

**Status:** PARTIAL — restate scope.

Already done:
- 8 fullstack-dev fixtures + 2 inspector fixtures under `evals/fixtures/`.
- `evals/agents/crew-fullstack-dev.yaml` + `crew-inspector.yaml` configs.
- `evals/cli.ts` runner entry point.
- Eval runs landing under `evals/runs/`.

Restated scope (remaining):
- `commands/gepa-eval.md` slash-command wrapper around `evals/cli.ts` (today users run `bun run evals` directly).
- Train/heldOut splitter helper in `scripts/lib/gepa/` (currently no `--split` flag).
- Lock acquire/release around eval runs (using `fileLockManager` from gepa-core) to prevent concurrent runs corrupting `<agent>.jsonl`.

**Touches:** `commands/gepa-eval.md`, `scripts/lib/gepa/split-train-heldout.ts`, `evals/cli.ts`, `tests/gepa/gepa-eval-cmd.test.ts`, `tests/gepa/split.test.ts`.

Estimate: 1d (down from 2d).

### SLICE-99 — /crew:gepa-optimize fullstack-dev --artifact-only

**Status:** UNCHANGED — full scope remains. CHECKPOINT 1.

No deliverables in repo. `commands/gepa-optimize.md` missing. `CandidateGenerator` wrapper around `aiplugin-dev` missing. Pareto math + 3-cycle halt missing.

Estimate: 3d. CHECKPOINT — human review before unlocking SLICE-103+.

### SLICE-100 — LLMJudge + ollamaJudge + rubricScorer + validators

**Status:** PARTIAL — restate scope.

Already done (via FEAT-184 + v0.2.0 / v0.3.0):
- `LLMJudge` interface in `src/interfaces.ts`.
- `OllamaJudge` in `src/providers/ollama/index.ts` (per v0.3.0 CHANGELOG).

Restated scope (remaining):
- `src/scorer/rubric-scorer.ts` — rubricScorer that takes a `Rubric` + `LLMJudge` and produces `ScoreResult` with per-criterion breakdown.
- `src/validators/validate-trial-corpus.ts` — scan a jsonl store for torn lines, schema violations, duplicate trial_ids.
- `src/validators/detect-eval-drift.ts` — compare two trial sets, return drift stats (mean/median/p95 score delta, pass-rate delta).
- Tests for all three.

**Naming reconciliation (per gepa-core 0.3.0 CHANGELOG lines 42-46):** the original SLICE-100 `touches_files` declared `gepa-core/src/judges/*`. The 0.3.0 release renamed `judges/ → providers/` and the `package.json` exports map only carries `./providers/*`. Restated paths use `src/scorer/`, `src/validators/`, and (where new judge files are added in SLICE-101) `src/providers/`. The `judges/` path is permanently retired.

Estimate: 2d (was 1.5d — matched to FEAT-185 SLICE-A precedent: 3 modules + tests + MINOR ceremony). MINOR bump to gepa-core 0.4.0.

### SLICE-101 — azureOpenAIJudge + geminiJudge + per-agent config + rubric.md loader

**Status:** PARTIAL — restate scope.

Already done (v0.3.0):
- `GeminiJudge` in `src/providers/gemini/index.ts`.

Restated scope (remaining) — **azure dropped per operator Q2 decision** (FEAT-185 SLICE-109 owns azure):
- `src/providers/resolve-judge.ts` — factory that takes `judge_per_agent` config + agent name + JUDGE_REGISTRY and returns the resolved LLMJudge instance. (Originally drafted under `src/judges/` per the stale slice; relocated to `src/providers/` to match 0.3.0 rename.)
- `src/providers/redact-rationale.ts` — PII / secret scrubber for judge rationale strings before persistence.
- `src/providers/load-rubric.ts` — loader for per-agent `evals/rubrics/<agent>.md` Markdown files into the `Rubric` type.
- `judge_per_agent` config switch in `GepaConfigSchema`.
- Tests for all three.

**Naming reconciliation:** all `src/judges/*` references in the original SLICE-101 `touches_files` relocate to `src/providers/*`. See SLICE-100 above for the same rule.

**Azure dropped (Q2 resolution):** FEAT-185 SLICE-109 absorbs azure relocation. Per Q3, bedrock is dropped entirely from SLICE-109 until proven needed — SLICE-109 becomes azure-only.

Estimate: 1.5d (was 2d — dropped 1 deliverable).

### SLICE-102 — astramemStore + sharedAstramemMeter + horizontalize seed datasets

**Status:** UNCHANGED — full scope remains.

`src/store/astramem-store.ts` missing. `src/budget/shared-astramem-meter.ts` missing. Seed eval cases for `backend-dev`, `frontend-dev`, `verifier` missing under `evals/fixtures/` and `evals/agents/`.

Estimate: 2d. Peer-deps (astramem client) introduce npm dependency — first MINOR bump that requires gepa-core consumers to also install peer.

### SLICE-103 — inspector bug-corpus + 10-case eval + rubricScorer integration

**Status:** UNCHANGED — full scope remains.

No bug-corpus mining script. No 10-case inspector eval. Depends on SLICE-100 (rubricScorer).

**Bug-corpus source (Q4 resolution):** hand-curate from open GH issues. Operator picks 10 inspector-related issues; builder authors minimal repro fixture per issue. Adds ~1d.

Estimate: 4d (was 3d).

### SLICE-104 — architect cases + soak monitor + PromotionPolicy + champion_frozen

**Status:** UNCHANGED — full scope remains. CHECKPOINT 2.

`PromotionPolicy` interface declared but no default implementations. Soak monitor (dual clock + sample floor + early-revert) missing entirely. `champion_frozen` flag missing.

**Calibration (Q6 resolution):** ship with default thresholds from the design spec; do NOT block on accumulating 5 weeks of trial data. Recalibration is a follow-up FEAT after sufficient data accumulates (track as a calendar reminder for ~2026-08-15).

Estimate: 3d. CHECKPOINT — human review before unlocking SLICE-105+.

### SLICE-105 — auto-PR via gh CLI + branch-protection check + champion provenance frontmatter

**Status:** UNCHANGED — full scope remains.

Depends on SLICE-99 (optimize cmd writes candidate) + SLICE-104 (PromotionPolicy decides).

Estimate: 2d.

### SLICE-106 — auto-merge gate (5 conditions) + critical-agent allowlist + 3 killswitch commands

**Status:** UNCHANGED — full scope remains.

Killswitches: `/crew:gepa-invalidate`, `/crew:gepa-revert`, `/crew:gepa-thaw`. Critical-agent allowlist (architect / fullstack-dev / inspector / verifier) enforces extra approval before auto-merge.

Estimate: 2d.

## Revised total

| | Original | Revised | Saved |
| --- | ---: | ---: | ---: |
| Slices | 11 | 9 (close 2) | 2 |
| Total days (sequential) | 24 | 19.5 | 4.5 |

Net deltas vs v1: SLICE-100 +0.5d (N2), SLICE-101 -0.5d (Q2 dropped azure), SLICE-103 +1d (Q4 hand-curation), WAVE 0 trifecta +1.5d (F2 added S2+S3). Closes SLICE-96 + SLICE-97 (-5d).

## Options Considered

Per architect-reviewer F4. Three wave layouts evaluated against the same set of constraints (cross-repo MINOR publish ceremony, autonomous_safe=false on every slice, 2 unavoidable CHECKPOINTs).

### Option A (chosen): 6-wave plan with parallel WAVE 1 + WAVE 0 prereq

- Plan as described above. WAVE 0 inserts FEAT-186 S1+S2+S3 + F3 resolution; WAVE 1 drafts 3 slices in parallel but serializes through 2 npm publishes; remaining waves are sequential.
- Total: ~17.5d wall + ~2.5d WAVE 0 = ~20d.

### Option B (rejected): all-serial 9-wave plan, no drafting parallelism

- One slice per wave, no concurrent drafting.
- **Why rejected:** loses no real wall-time on the gepa-core publish ceremony (already serial) but adds ~1.5d on WAVE 1 by serializing the SLICE-100/-101/-98 drafting that has no shared files. Net penalty: ~1.5d for zero risk reduction. The publish ceremony is already the bottleneck; drafting parallelism is free.

### Option C (rejected): dev-team-only first, defer all gepa-core MINORs to WAVE 6

- Ship SLICE-98 + SLICE-99 + SLICE-102 + SLICE-103 + SLICE-104 against gepa-core 0.3.1 with TODO comments for missing exports, then bundle all gepa-core bumps (rubric-scorer + validators + azure + resolve-judge + per-agent config) into one MAJOR 1.0.0 release at WAVE 6.
- **Why rejected:** unblocks SLICE-99 (CHECKPOINT 1) artificially because it has no `LLMJudge` resolution path until v1.0.0. Forces dev-team to ship stub implementations that get torn out a month later — code churn cost is substantial, ~3-4d of throwaway work. Also fights the FEAT-183 design intent (skill improvement loop needs the rubric infra at evaluation time, not at champion-selection time).

### Option D (rejected): drop SLICE-100 + SLICE-101 entirely, lift them into FEAT-185 SLICE-B

- Treat the missing gepa-core pieces as residual FEAT-185 work; ship under FEAT-185 SLICE-C/D/E.
- **Why rejected:** FEAT-185 was scoped to provider relocation, not new abstractions. Lifting rubricScorer + validators into FEAT-185 changes its character from refactor to capability — would need PM re-triage. Faster to keep them under FEAT-183 where the design spec already covers them.

## Wave plan

Topological levels on the revised dep graph. SLICEs in the same wave have no inter-slice dependency and may dispatch in parallel via worktrees.

```
WAVE 1 — gepa-core 0.5.0/0.6.0 + dev-team plumbing
  ├─ SLICE-100 (gepa-core: rubric-scorer + 2 validators)  — 2d   — gepa-core repo
  ├─ SLICE-101 (gepa-core: azure + resolve-judge + rubric loader)  — 2d  — gepa-core repo
  └─ SLICE-98  (dev-team: /crew:gepa-eval + split + lock)  — 1d   — dev-team repo
  Drafted in parallel (3 worktrees), serialized through 2 npm publishes.
  Merge order: SLICE-100 → publish gepa-core 0.5.0 → SLICE-101 (serialized through publish ceremony, not by code dep — `resolve-judge.ts` depends on already-shipped `LLMJudge` interface from FEAT-184 / v0.2.0, not on SLICE-100 deliverables) → publish 0.6.0 → SLICE-98 bumps dep to ^0.6.0.
  Per architect-reviewer F-claim-2: SLICE-98's only gepa-core dependency is `fileLockManager` (present since 0.1.0), so SLICE-98 CAN merge before the gepa-core publishes — but the cost-shape write needs WAVE-0's FEAT-186 S1+S2+S3 landed first. SLICE-98 final dep-bump to ^0.6.0 is the final step.
  Wall time: 2d (drafting) + 2 × publish ceremony (~30-60min each w/ 2FA) + 1d (SLICE-98 dep-bump + verify) = ~3.5-4d realistic.

WAVE 2 — optimize CHECKPOINT 1
  └─ SLICE-99  (dev-team: /crew:gepa-optimize fullstack-dev --artifact-only)  — 3d
  Sequential. CHECKPOINT 1: human review of CandidateGenerator + Pareto math + 3-cycle halt + budget cap. No auto-merge.
  Wall time: 3d.

WAVE 3 — horizontalize
  └─ SLICE-102 (astramemStore + shared meter + 3 more agent eval seeds)  — 2d
  Depends on SLICE-100 + SLICE-101 (need rubricScorer + per-agent config). Sequential.
  Wall time: 2d.

WAVE 4 — inspector eval
  └─ SLICE-103 (inspector bug-corpus + 10 cases + rubric eval)  — 4d
  Depends on SLICE-100, SLICE-101, SLICE-102. Sequential.
  Includes operator hand-curation of 10 GH issues (Q4 resolution) + builder repro fixture authoring (3d).
  Wall time: 4d.

WAVE 5 — architect + soak CHECKPOINT 2
  └─ SLICE-104 (architect cases + soak monitor + PromotionPolicy + champion_frozen)  — 3d
  CHECKPOINT 2: human review of soak monitor early-revert + PromotionPolicy defaults. No auto-merge.
  Wall time: 3d.

WAVE 6 — auto-merge ladder
  ├─ SLICE-105 (auto-PR + branch-protection check + provenance)  — 2d
  └─ SLICE-106 (auto-merge gate + critical-agent allowlist + 3 killswitches)  — 2d
  Sequential within wave: SLICE-106 depends on SLICE-105's PR-creation surface.
  Wall time: 4d.

TOTAL WALL TIME (WAVE 0 + WAVES 1-6): 2.5d + 3d + 2d + 4d + 3d + 4d = 18.5 days (~3.7 work weeks)
  WAVE 1: 3d drafting + ~1d publish-ceremony overhead = 3-4d realistic.
TOTAL SEQUENTIAL: 20.5 days (saved 2d via Wave 1 drafting parallelism).
```

## Cross-repo coordination

- **SLICE-100, SLICE-101** ship in `C:/work/mega/gepa-core/` (separate repo).
- **SLICE-98, 99, 102, 103, 104, 105, 106** ship in `C:/work/mega/dev-team/`.
- After each gepa-core MINOR (0.4.0 after SLICE-100, 0.5.0 after SLICE-101), publish to npm (operator action — 2FA blocker per [[gepa-core-v0.2.0-unpublish-lockout]] memory). Then bump dev-team `package.json` dep.

## Risks + mitigations

| Risk | Mitigation |
| --- | --- |
| Re-implementing already-shipped code from stale backlog | This doc + sweep before any code; SLICE-96/97 closed without rebuild |
| gepa-core MINOR release blocked on operator 2FA (per memory) | Operator pre-flight: confirm GA Token / OTP path ready before WAVE 1 |
| All slices `autonomous_safe: false` — human review on every merge | Already part of the FEAT-183 design; not a new risk |
| Cost contract (FEAT-186 S1) not yet merged but referenced by SLICE-98 | Per snapshot.md Phase 7 note, FEAT-186 S1 must land BEFORE SLICE-98. Add as WAVE 0 prereq below. |
| SLICE-104 soak monitor depends on prod runs at scale | Operator pre-flight: confirm GROQ_API_KEY + Gemini API access for the eval pipeline |
| Cross-repo MAJOR-bump cascade if rubricScorer signature ripples to consumers | `scripts/check-semver.ts` in gepa-core flags this pre-publish |

## WAVE 0 — prereqs

Before WAVE 1:

1. **FEAT-186 S1 + S2 + S3** (cost contract trifecta) — must land together. S1 exports `JudgeCost` shape. S2 wires `dailyCapMeter` ingestion against the new shape. S3 updates per-slice cost-report renderer. **S2 + S3 added per architect-reviewer F2:** SLICE-98 writes trials in the new canonical shape; without S2 + S3 the `dailyCapMeter` reads old-shape evals while gepa writes new-shape, causing silent budget overruns through WAVES 1-5 — the exact production-safety gap FEAT-186 was spun out to close. Estimate: 2.5d (S1=1d, S2=1d, S3=0.5d). MINOR bump gepa-core 0.3.1 → 0.4.0-rc.0 (or 0.4.0 if combined with SLICE-100).
2. **Resolve F3 azure-overlap (FEAT-185 SLICE-109 vs SLICE-101)** — pick one owner; the other drops the azure scope. **Operator decision required.** See Open Question Q2.
3. **Operator: confirm gepa-core npm publish 2FA story** so WAVE 1 can ship without re-hitting the v0.2.0 24h unpublish-lockout precedent.
4. **Operator: confirm GROQ_API_KEY + Gemini API access** for the eval pipeline (needed at SLICE-102+ but cheaper to verify in WAVE 0).

## CHECKPOINT-0 (between WAVE 0 close and WAVE 1 dispatch)

Per architect-reviewer N1. 30-min operator review covering:

- FEAT-186 S1+S2+S3 merged + gepa-core published + dev-team dep bumped.
- F3 azure-overlap decision recorded in this doc + the losing slice closed/restated.
- 2FA story confirmed (GA Token issued OR OTP+publish path tested on a throwaway dev release).
- API keys available for SLICE-102+ pipeline (GROQ_API_KEY + Gemini).
- **FEAT-184 AC-3 baseline data available** (per Q7) OR explicitly waived for SLICE-100 with operator initial. Without baseline, `detectEvalDrift` validator has no ground-truth.
- **SLICE-109 backlog file exists** at `.claude/artifacts/loop/backlog/triaged/SLICE-109*.md` (created or renamed from FEAT-185 SLICE-B) so azure work has a real ownership artifact.
- **Operator has 10 inspector GH issue IDs queued** for SLICE-103 hand-curation (per Q4). Pre-stage avoids WAVE 4 blocking on operator availability.
- **Q8 owner named** for the 2026-07-13 `agent-eval-regression.yml` calendar dependency. Recommend: release-engineer.

If any item red, halt before WAVE 1.

## CHECKPOINT-0 status (2026-06-30 operator review)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | FEAT-186 S1+S2+S3 merged + published + dep bumped | pending — WAVE 0 work | n/a |
| 2 | Q2 azure-overlap recorded + losing slice closed | DONE | SLICE-109 created at `.claude/artifacts/loop/backlog/triaged/SLICE-109-feat-185-azure-judge-relocation.md` |
| 3 | 2FA story confirmed | OPERATOR ACTION | `npm whoami=heroboec` works, token in `~/.npmrc`. Recommend dry-run publish on throwaway `gepa-core@0.3.2-rc.0` tag before WAVE 1 close. |
| 4 | GROQ + Gemini API keys available | DONE | 2026-06-29 inspector eval ran successfully with both judges (`evals/runs/2026-06-29T19-07-56-053Z-inspector.json` shows `llm-rubric PASS score=1`). |
| 5 | FEAT-184 AC-3 baseline data available | WAIVED | Operator waived for SLICE-100 (2026-06-30 Q-pass). Recalibration follow-up. |
| 6 | SLICE-109 backlog file exists | DONE | Created 2026-06-30. |
| 7 | 10 inspector GH issues queued for SLICE-103 | DEFERRED | Operator deferred to WAVE 4 approach time. Track for CHECKPOINT-3 (new). |
| 8 | Q8 owner named for 2026-07-13 calendar dep | DONE | release-engineer owns. |

**Verdict:** 6/8 GREEN; 1 deferred (item 7); 1 operator action remaining (item 3, npm publish dry-run). Item 1 is WAVE 0's own deliverable, naturally pending.

WAVE 0 launch can begin (FEAT-186 S1+S2+S3 work). CHECKPOINT-0 final review happens between WAVE 0 close and WAVE 1 dispatch; the only blocker at that gate will be item 3 if dry-run not yet done.

## Open questions

### Resolved during architect-reviewer pass (2026-06-30)

- **Q1 — Does SLICE-98 wait for FEAT-186 S1 cost contract?** Resolved: wait. WAVE 0 inserts S1 + S2 + S3 (S2 and S3 added per architect-reviewer F2 — without all three, dailyCapMeter reads old-shape evals while gepa writes new-shape, causing silent budget overruns).
- **Q5 — SLICE-98 only-needs-fileLockManager-from-gepa-core question:** Resolved: SLICE-98 CAN merge before SLICE-100/101 publishes (only `fileLockManager` dep, present since 0.1.0). But its cost-shape write needs WAVE-0 landed first, so it's still WAVE 1 in practice.

### Resolved by operator 2026-06-30

- **Q2 — Azure ownership:** FEAT-185 SLICE-109 owns azure relocation. SLICE-101 drops azure scope (now 3 deliverables, 1.5d).
- **Q3 — Bedrock:** dropped entirely until proven needed. SLICE-109 becomes azure-only.
- **Q4 — Bug-corpus source:** hand-curate from open GH issues. Operator picks 10 inspector-related issues; builder authors repro fixtures. +1d to SLICE-103 (now 4d).
- **Q6 — SLICE-104 calibration:** ship with default thresholds; recalibrate as follow-up after data accumulates (calendar ~2026-08-15).

### Outstanding (resolve before respective wave)

- **Q7 — FEAT-184 AC-3 baseline data.** Snapshot.md says still pending operator live-judge run. Without it FEAT-185 SLICE-A snapshot-diff (AC-4) and any drift detection in SLICE-100's `detectEvalDrift` validator cannot ground-truth. Block SLICE-100 if absent.
- **Q8 — `agent-eval-regression.yml` workflow promotion to live mode** is on calendar for 2026-07-13 per architect-reviewer N3. If it promotes BEFORE WAVE 1 closes, it lands inside the dual-cost-shape window. Either: delay the workflow promotion, or accelerate WAVE 0 + WAVE 1 to clear by 2026-07-13. Track as a calendar dependency.

## Approval gate

Before kicking off WAVE 0 / WAVE 1, dispatch `crew:architect-reviewer` against this plan to verify:

- dep graph correctness on the restated scope
- wave parallelism doesn't hide hidden serial dependencies (especially around gepa-core publish ceremony)
- CHECKPOINT placement is right (1 after SLICE-99, 2 after SLICE-104)
- cross-repo MINOR-bump ordering won't trap consumers
- the "WAVE 0 prereq" insertion of FEAT-186 S1 actually solves the dual-cost-shape problem flagged in snapshot.md
- any missed second-order effects (e.g. eval-regression CI gate added in FEAT-170 SLICE-95 — does the WAVE 1 cost contract change break it?)

Reviewer verdict required: `approved` or `approved_with_conditions`. `needs_revision` blocks WAVE 0.

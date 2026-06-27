# GEPA — Skill Improvement Loop Design

**Date:** 2026-06-27
**Status:** Brainstorm complete, awaiting user review before plan writing.
**Tracks issue:** [astragenie/dev-team#121](https://github.com/astragenie/dev-team/issues/121)
**Author:** Sergey + Opus 4.7 (1M context)

## Summary

GEPA (Genetic-Pareto reflective prompt evolution) optimizes agent prompts by capturing every dispatch, scoring against eval datasets, generating candidate prompt variants, Pareto-selecting winners, and promoting them via a soak-phase auto-merge or manual-review PR.

This design **departs from ticket #121's monolithic "crew feature" framing**. After architect-reviewer + critical-thinking pushback (10 concerns surfaced, see "Resolved concerns" below), the user chose a shared-library approach: GEPA logic extracts to a new `@astragenie/gepa-core` ESM package so future plugins (e.g. a sales-team plugin) can consume the same algorithms without forking. Crew is the first consumer, wires thin plugin glue around the library.

## Goals

- A working capture → eval → optimize loop for the 6 top crew agents in v1: `fullstack-dev`, `backend-dev`, `frontend-dev`, `verifier`, `inspector`, `architect`.
- Library-level reusability: a second plugin needs zero library changes — only its own `gepa.config.json`, scorer wiring, and eval datasets.
- Zero hard cross-plugin runtime deps: defaults (`fileStore` + `sequentialRunner`) work without `runner-plugin` or `memory-plugin` installed.
- A promotion gate that distinguishes "noise" from "real gain" and refuses to auto-merge critical agents (`inspector`, `verifier`, `architect`).

## Non-goals

- Multi-agent simultaneous optimization (v2).
- `aiplugin-dev` evaluation — meta-agent, requires recursive downstream-Δ measurement (v2+).
- Scheduled nightly optimization via `runner-plugin` ceremony (v2 once v1 proves itself).
- Auto-promotion without soak phase (only after data proves soak adds no signal).
- Changes to `astramem-local` schema (existing `fact` type + tags is sufficient).
- Provider-switching, marketplace ownership of GEPA agents in third-party plugins.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Packaging | ESM library `@astragenie/gepa-core` in a new repo `astragenie/gepa-core` | User explicitly wanted "shared lib, not shared plugin" — future plugins reuse the algorithms without forking. |
| Scorer shape | Rich `ScoreResult` (`pass`, `score: 0..1`, `rubric`, `cost_usd`, `latency_ms`, `rationale`) | Continuous `score` provides Pareto gradient; binary `pass` keeps CI-style hard verdict; rubric subscores feed reflection step. Subsumes binary and scalar shapes. |
| Built-in scorers | `binaryScorer` (wraps PASS/FAIL agent), `rubricScorer` (LLM-judge with criteria) | `rubricScorer` resolves the inspector-grades-inspector circularity — scorer-class agents are optimized using an LLM-judge, not their binary self. |
| Storage | `TrialStore` interface with `fileStore` (default) and `astramemStore` built-ins | Decouples Phase 1 from `memory-plugin#8` contract — ships day 1 with JSONL on disk; `astramemStore` lights up automatically when astramem CLI is present. |
| Runner | `RunnerAdapter` interface with `sequentialRunner` (default) and `waveRunner` (peer-dep on runner-plugin) | Decouples Phase 3 from `runner-plugin#289` — sequential runs work without companion plugin. Parallel candidate runs are a perf optimization, deferred. |
| Promotion policy | `PromotionPolicy` interface; crew defaults: `+5%` PASS delta, `0.6` tail-risk floor, `10%` soak × `7` days, no cost/latency regression, critical-agent allowlist | Reviewers flagged ticket's "+1% measurable gain" + "auto-merge if held-out PASS ≥ X%" as ship-to-prod risk; soak phase and tail-risk floor mitigate. |
| Critical-agent allowlist | `inspector`, `verifier`, `architect` → draft PR only, never auto-merge | These agents have compounding effects on the entire engineering loop. Their failures aren't local. |
| v1 target agents | 6 agents: `fullstack-dev`, `backend-dev`, `frontend-dev`, `verifier`, `inspector`, `architect` | Hybrid dataset bootstrap fits 5 of them; `architect` needs hand-labeled cases; `aiplugin-dev` deferred to v2 (recursive eval). |
| Dataset bootstrap | Hybrid: 5 hand-seeded cases per agent + auto-grow from captured runs scored ≥0.9 by LLM-judge + held-out split (20%) | Bootstraps in ~7 days vs ~3 weeks for hand-written only; held-out split detects overfit-to-eval. |
| Sequencing | Vertical-slice approach (B): fullstack-dev end-to-end first, then horizontalize | Working loop in 2 slices, real-signal validation before scaling. Matches autonomous-loop pattern. 8 slices total, ~5 calendar weeks. |
| Capture default | Synchronous in code, async via 2 s walltime cap; `enabled: true` when `gepa.config.json` present; runtime override `capture.enabled: false` available | Fire-and-forget keeps capture off the hot path; runtime kill-switch enables incident-response disable without code reload. |

## Resolved concerns (from architect-reviewer + critical-thinking pushback)

| Concern | How this design resolves it |
|---|---|
| **C1.** Inspector grades inspector (Phase 3 AC names this circular target) | `rubricScorer` (LLM-judge with criteria) is used when optimizing scorer-class agents. The binary inspector is never the scorer for itself. |
| **C2.** Eval dataset authoring is a hidden subproject that dwarfs the "1 week" estimate | Hybrid bootstrap (hand-seed + auto-grow + held-out) sized for ~7 days across 6 agents; v1 scope cuts `aiplugin-dev` (would need recursive eval). |
| **C3.** Wave dispatcher cross-plugin hard dep on `runner-plugin` | `RunnerAdapter` interface; `sequentialRunner` is the default. `waveRunner` is a peer-dep adapter wired only when `runner-plugin` is installed. |
| **C4.** PASS/FAIL too coarse — optimizer plateaus on first PASS | `ScoreResult.score` provides 0..1 continuous gradient; rubric subscores enable failure-mode reflection. |
| **C5.** Per-dispatch `cost_usd` doesn't exist in crew today (per-slice only) | The `Scorer` interface returns `cost_usd` as part of `ScoreResult` — scorer measures and reports; no new crew instrumentation in the artifact-writer hot path. |
| **C6.** $5/cycle budget unevidenced vs ~$40/slice baseline | Budget tunable per call (`budgetUsd` arg) and per-day (`gepa.budget.dailyUsd`); first real cycles produce telemetry that anchors the default. |
| **C7.** Pareto with 3 objectives + K=5, no tiebreaker → underdetermined | `paretoRank()` exposes deterministic tiebreaker chain: `pass > score > -cost > -latency`, then trial_id for full determinism. |
| **C8.** No kill-switch / rollback story | Five kill-switches: runtime `capture.enabled: false`, per-agent `capture.exclude`, `/crew:gepa-invalidate` trial corpus purge, `gepa.optimize.paused`, `/crew:gepa-revert` for soak abort. Champion provenance frontmatter (`prior_prompt_hash`) makes `git revert` one command. |
| **C9.** Boundary smell — Phase 3 is 4 cross-plugin contracts coordinated by one new agent | Library extraction removes the coordination burden from any single plugin; each cross-plugin contract is now an interface adapter with isolated test surface. |
| **C10.** Missing fitness functions | Library ships: `validateTrialCorpus`, `detectEvalDrift`, `captureParityGoldenTest`, capture p99 latency assert, budget SLO check, candidate prompt-size invariant. |
| **C11.** "Measurable PASS-rate gain" has no numeric bar | `PromotionPolicy.minPassDelta: 0.05` (5 %). |
| **C12.** Manual review queue cadence undefined | Auto-merge gate triggers for non-critical agents after soak; critical agents (`inspector`, `verifier`, `architect`) land as draft PRs for batch review. |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  astragenie/gepa-core   (new npm pkg, ESM library, pure logic)  │
│                                                                 │
│  Types (Zod):  Trial · EvalCase · ScoreResult · Candidate       │
│                                                                 │
│  Interfaces:   Scorer · TrialStore · RunnerAdapter ·            │
│                PromotionPolicy · CandidateGenerator             │
│                                                                 │
│  Built-ins:    fileStore    · sequentialRunner                  │
│                astramemStore· waveRunner (peer-dep)             │
│                binaryScorer · rubricScorer                      │
│                                                                 │
│  Algorithms:   paretoRank · soakMonitor · validateCorpus ·      │
│                detectEvalDrift · capturePrompt (mutator)        │
│                                                                 │
│  Top-level fns: runEvalSuite · runOptimization · gepaCapture    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ imported as npm dep
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│ crew plugin   │    │ runner-plugin  │    │ memory-plugin  │
│ (1st consumer)│    │ (waveRunner    │    │ (astramem CLI  │
│               │    │  impl source)  │    │  backs astra-  │
│ commands/     │    │                │    │  memStore)     │
│  gepa-eval    │    │ optional peer  │    │                │
│  gepa-history │    │ dep for paral- │    │ optional peer  │
│  gepa-optimize│    │ lel candidate  │    │ dep for shared │
│ gepa.config   │    │ runs           │    │ trial corpus   │
└───────────────┘    └────────────────┘    └────────────────┘
```

### Invariants

- `gepa-core` has zero hard Claude-Code-specific deps. Pure ESM. Bun test runner.
- `fileStore` + `sequentialRunner` defaults work with no other plugins installed.
- `runner-plugin` and `memory-plugin` are optional peer deps. The library imports nothing from them; consumer plugins wire adapters in their own config.
- Future plugin (e.g. `sales-team`) drops in `@astragenie/gepa-core` + its own `gepa.config.json` + its own scorer agent + its own eval datasets. No library change needed.

## Library API surface

### Types (Zod-validated)

```ts
// gepa-core/src/types.ts

export const TrialSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),                       // e.g. "fullstack-dev"
  phase: z.enum(["build","review","validate","ship"]),
  candidate_prompt_hash: z.string(),       // sha256 of the agent .md file evaluated
  candidate_prompt_path: z.string().nullable(),  // null = current champion
  input: z.unknown(),                      // EvalCase.input or captured dispatch input
  output: z.unknown(),                     // agent return artifact
  score: ScoreResultSchema,
  source: z.enum(["eval","captured","soak"]),
  pareto_rank: z.number().int().nullable(),
  created_at: z.string().datetime(),
});

export const EvalCaseSchema = z.object({
  id: z.string(),
  input: z.unknown(),
  expected_output: z.unknown().nullable(), // null when judged by rubricScorer only
  rubric: z.array(z.string()).optional(),  // criteria for rubricScorer
  held_out: z.boolean().default(false),
  notes: z.string().optional(),
});

export const ScoreResultSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(1),
  rubric: z.record(z.string(), z.number()).optional(),
  cost_usd: z.number().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  rationale: z.string().optional(),
});
```

### Interfaces

```ts
// gepa-core/src/interfaces.ts

export interface Scorer {
  score(run: AgentRun, expected: EvalCase): Promise<ScoreResult>;
}

export interface TrialStore {
  put(trial: Trial): Promise<void>;
  recall(filter: {
    agent?: string;
    phase?: string;
    minScore?: number;
    failuresOnly?: boolean;
    limit?: number;
  }): Promise<Trial[]>;
  invalidate(filter: { tag?: string; trial_ids?: string[]; agent?: string; since?: string }): Promise<number>;
}

export interface RunnerAdapter {
  runCandidates(
    candidates: Candidate[],
    cases: EvalCase[],
    scorer: Scorer,
    opts: { budgetUsd: number; signal?: AbortSignal }
  ): Promise<Trial[]>;
}

export interface CandidateGenerator {
  generate(
    currentChampionPath: string,
    failingTrials: Trial[],
    k: number,
    opts: { budgetUsd: number }
  ): Promise<Candidate[]>;
}

export interface PromotionPolicy {
  eligibleAgents: string[];
  minPassDelta: number;        // 0.05 (5 %)
  minCaseScoreFloor: number;   // 0.6
  soakPercent: number;         // 0.10 (10 %)
  soakDays: number;            // 7
  allowCostRegression: boolean;
  allowLatencyRegression: boolean;
}

export interface BudgetMeter {
  reserve(estimateUsd: number): Promise<{ ok: boolean; remainingUsd: number }>;
  record(actualUsd: number): Promise<void>;
}
```

### Top-level functions

```ts
// gepa-core/src/index.ts

export async function runEvalSuite(opts: {
  agent: string;
  dataset: EvalCase[];
  scorer: Scorer;
  runner: RunnerAdapter;
  store: TrialStore;
  championPromptPath: string;
}): Promise<{ aggregate: AggregateScore; trials: Trial[] }>;

export async function runOptimization(opts: {
  agent: string;
  dataset: EvalCase[];        // train split
  heldOut: EvalCase[];        // held-out split
  scorer: Scorer;
  generator: CandidateGenerator;
  runner: RunnerAdapter;
  store: TrialStore;
  policy: PromotionPolicy;
  k: number;                  // candidates per cycle
  budgetUsd: number;          // hard cap
  signal?: AbortSignal;
}): Promise<OptimizationResult>;

// CrewArtifact is a gepa-core-defined generic shape (agent, phase, input, output, score_hint).
// The crew plugin glue adapts its concrete artifact types into this shape before calling gepaCapture.
// Future consumer plugins do the same adaptation from their own artifact shapes.
export async function gepaCapture(opts: {
  artifact: CrewArtifact;     // generic shape — plugin author adapts from their own type
  store: TrialStore;
  walltimeMs?: number;        // default 2000, fail-silent on miss
}): Promise<void>;

export function paretoRank(
  trials: Trial[],
  tiebreaker?: (a: Trial, b: Trial) => number
): RankedTrial[];

// Validators (architect's fitness functions)
export function validateTrialCorpus(store: TrialStore): Promise<ValidationReport>;
export function detectEvalDrift(trials: Trial[], heldOutPass: number): DriftReport;
export function captureParityGoldenTest(baseline: Artifact[], withCapture: Artifact[]): boolean;
```

### Shape rationale

- All input / output typed `z.unknown()` — library is agent-agnostic. Plugin author's scorer interprets.
- `recall()` filters are explicit fields, not free-text — predictable, testable, no FTS5 dep for `fileStore`.
- `runOptimization()` takes `train` + `heldOut` separately so the drift detector can compare the two distributions.
- `signal: AbortSignal` on long-running calls → architect kill-switch concern. Caller can abort mid-cycle.
- No top-level config object — every function takes explicit deps. Easier to test, no global state.

## Data flow

### Capture (Phase 1, every dispatch)

```
┌──────────────┐  artifact   ┌──────────────────┐
│  /crew:build │ ──write───> │ .claude/         │
│  dispatches  │             │ artifacts/crew/  │
│  agent       │             │ {runs,handoffs,  │
└──────────────┘             │  reviews,        │
                             │  validations}/   │
                             └─────────┬────────┘
                                       │ tee (fire-and-forget, 2 s walltime)
                                       ▼
                             ┌──────────────────┐
                             │ gepaCapture({    │
                             │   artifact,      │
                             │   store          │
                             │ })               │
                             └─────────┬────────┘
                                       │ TrialStore.put()
                                       ▼
                             ┌──────────────────┐
                             │ fileStore        │ ← default
                             │ JSONL append to  │
                             │ .claude/         │
                             │ artifacts/crew/  │
                             │ gepa/trials/     │
                             │ <agent>.jsonl    │
                             └──────────────────┘
```

Capture is synchronous in code but bounded by wallclock: `Promise.race([store.put(trial), sleep(2000)])`. Walltime miss = log + drop trial. No exception escapes the capture path.

Trial source = `"captured"`. No expected_output, no rubric — just raw input + output + scoring derived from inspector / validator PASS/FAIL already in the artifact.

### Eval (Phase 2, on-demand or scheduled)

```
   /crew:gepa-eval fullstack-dev
                │
                ▼
   ┌────────────────────────┐
   │ load gepa.config.json  │
   │ load eval dataset for  │
   │  agent (jsonl)         │
   │ split train / heldOut  │
   └───────────┬────────────┘
               │
               ▼
   ┌────────────────────────┐
   │ runEvalSuite({         │
   │   agent,               │
   │   dataset: train,      │
   │   scorer,              │
   │   runner: sequential,  │
   │   store: fileStore,    │
   │   championPath:        │
   │    agents/fullstack-   │
   │    dev.md              │
   │ })                     │
   └───────────┬────────────┘
               │
               ▼
   For each EvalCase:
     1. runner dispatches agent (champion) with case.input
     2. scorer.score(agentRun, case) → ScoreResult
     3. store.put({ trial w/ source: "eval" })
               │
               ▼
   ┌────────────────────────┐
   │ aggregate              │
   │  pass_rate, p50 cost,  │
   │  p50 latency,          │
   │  median rubric         │
   └───────────┬────────────┘
               │
               ▼
   write artifact .claude/artifacts/crew/gepa/eval/<run-id>.json
```

### Optimize (Phase 3, manual trigger)

```
   /crew:gepa-optimize fullstack-dev --k 5 --budget 5
                │
                ▼
   ┌──────────────────────────────────┐
   │ store.recall({agent,             │
   │  failuresOnly, limit:50})        │
   │  → failing trials                │
   └───────────┬──────────────────────┘
               │
               ▼
   ┌──────────────────────────────────┐
   │ generator.generate(              │
   │   currentChampion,               │
   │   failingTrials,                 │
   │   k=5,                           │
   │   budgetUsd=$1                   │
   │ ) → 5 candidate .md files        │
   │   → aiplugin-dev agent dispatch  │
   └───────────┬──────────────────────┘
               │
               ▼
   ┌──────────────────────────────────┐
   │ runner.runCandidates(            │
   │   candidates,                    │
   │   evalCases (train + heldOut),   │
   │   scorer,                        │
   │   budgetUsd=$3                   │
   │ ) → trials per candidate         │
   └───────────┬──────────────────────┘
               │
               ▼
   ┌──────────────────────────────────┐
   │ paretoRank(trials)               │
   │ tiebreaker: pass > score >       │
   │   -cost > -latency               │
   └───────────┬──────────────────────┘
               │
               ▼
   ┌──────────────────────────────────┐
   │ winner = pareto_rank == 1        │
   │  AND held_out_pass >=            │
   │    champion_pass +               │
   │    policy.minPassDelta           │
   │  AND min(held_out_case_scores)   │
   │    >= policy.minCaseScoreFloor   │
   │  AND no_cost/latency_regression  │
   └───────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
   no winner       has winner
       │               │
       │               ▼
       │       ┌──────────────────────────┐
       │       │ agent in policy.eligible?│
       │       └──────┬───────────┬───────┘
       │            yes         no
       │              │           │
       │              ▼           ▼
       │       ┌────────┐   ┌─────────────┐
       │       │ SOAK   │   │ draft PR    │
       │       │ 10 % × │   │ gepa/<a>/   │
       │       │ 7 days │   │ <trial-id>  │
       │       │ vs main│   │ human merges│
       │       └────┬───┘   └─────────────┘
       │            │
       │       ┌────┴─────┐
       │       │ no regr? │
       │       └────┬─────┘
       │          yes
       │            │
       │            ▼
       │       ┌─────────────┐
       │       │ auto-merge  │
       │       │ to main     │
       │       └─────────────┘
       │
       ▼
   write OptimizationResult
   artifact .claude/artifacts/crew/gepa/opt/<run-id>.json
```

### Soak phase mechanics

- After candidate selected as winner, library writes a "soak champion" pointer alongside main champion.
- Crew's dispatcher (existing slice-build orchestrator) reads `.claude/artifacts/crew/gepa/soak.json` on each dispatch. If the agent has an active soak and `Math.random() < soakPercent`, it uses the soak champion instead of main.
- Each soak dispatch tees a trial tagged `source: "soak"`. After `soakDays`, library computes:
  - `soak_pass_rate` from soak trials in the window.
  - `main_pass_rate` from same-window main trials.
  - If `soak_pass_rate >= main_pass_rate - epsilon` (default `epsilon = 0.02`, i.e. 2 percentage-point tolerance for noise) → promote.
  - Else → revert (delete soak pointer, retain trials for forensics).

### Data location summary

| Where | What | Lifetime |
|---|---|---|
| `.claude/artifacts/crew/gepa/trials/<agent>.jsonl` | `fileStore` trial log | append-forever, validators check integrity |
| `.claude/artifacts/crew/gepa/eval/<run-id>.json` | eval run summary | committed |
| `.claude/artifacts/crew/gepa/opt/<run-id>.json` | optimize run summary | committed |
| `.claude/artifacts/crew/gepa/soak.json` | active soak pointers | overwritten on promote / revert |
| `agents/<name>/.gepa/eval/*.jsonl` | hand-seeded + grown eval cases | git-tracked |
| `gepa.config.json` (repo root) | plugin glue config | git-tracked |

The validator script `scripts/validate-agents.ts` must be taught to skip `.gepa/` subdirs when enumerating agent files (architect concern #10 fitness function).

## Error handling + safety

### Failure modes

| Where | Failure | Response |
|---|---|---|
| Capture tee | `store.put()` exceeds 2 s walltime | drop trial, log `gepa_capture_drop` to `.claude/logs/events.jsonl`, dispatch continues |
| Capture tee | `store.put()` throws | catch, log, drop trial, dispatch continues — **never propagate** |
| Capture tee | astramem CLI absent when `astramemStore` is configured | fallback to `fileStore` if both configured; else log + drop |
| Eval | scorer throws | mark case as `pass: false, score: 0, rationale: "scorer_error: <msg>"` — keep trial, eval continues |
| Eval | runner walltime exceeded | abort current case via `AbortSignal`, mark `pass: false, score: 0, rationale: "runner_timeout"` |
| Eval | budget cap exceeded mid-run | halt remaining cases, write partial aggregate with `partial: true`, no promotion eligibility |
| Optimize | candidate generation returns < k candidates | proceed with what returned, log `candidate_underflow`, no abort |
| Optimize | all candidates dominated by champion | no promotion, write artifact with `no_winner: true`, exit clean |
| Optimize | budget cap hit during candidate runs | halt, partial flag, no promotion |
| Optimize | Pareto rank shows tie at #1 | tiebreaker chain: `pass > score > -cost > -latency`; if still tied → first by trial_id (deterministic) |
| Optimize | held-out case scores reveal tail risk (any case < 0.6) | no promotion, log `tail_risk_block`, candidate retained in trials for next cycle |
| Soak | soak champion file corrupt | revert to main champion, alarm, mark soak failed |
| Soak | regression detected mid-soak (> X % delta over rolling window) | early-revert, alarm, write soak forensics artifact |
| Soak | dispatcher can't read `soak.json` | use main champion, log read failure once, continue |
| Promote | auto-merge attempt | writes prompt file to working tree + commits on `gepa/<agent>/<trial-id>` branch, then `gh pr merge --auto --squash`. Branch protection still enforces CI green. Never `git push origin main` direct |

### Kill-switches

1. **Runtime capture disable**: `gepa.config.json` → `capture.enabled: false`. Library checks per call. No code reload needed.
2. **Per-agent capture disable**: `capture.exclude: ["inspector"]`. Useful during incident triage.
3. **Trial corpus invalidation**: `/crew:gepa-invalidate --agent fullstack-dev --since 2026-06-20` → `TrialStore.invalidate({tag, agent, since})`. Records an audit row.
4. **Optimization global pause**: `gepa.optimize.paused: true` blocks `/crew:gepa-optimize` from launching new cycles. Soak phases continue to completion (or `--force-revert`).
5. **Soak abort**: `/crew:gepa-revert --agent fullstack-dev` → deletes soak pointer, restores main champion, alarms.
6. **Champion provenance**: every agent prompt file gets frontmatter:
   ```yaml
   ---
   gepa:
     champion_from_trial: <trial-id-or-null>
     prior_prompt_hash: <sha256>
     promoted_at: <iso-datetime>
   ---
   ```
   `git revert` is one command; prior hash lets validators detect history corruption.

### Budget enforcement

- Per-call: `runEvalSuite` / `runOptimization` take `budgetUsd`.
- Per-day: `gepa.budget.dailyUsd` hard cap; library refuses to start a cycle if `today_spent >= cap`.
- Shared with astramem-local wallet when `astramemStore` is active, via the `BudgetMeter` adapter.

### Capture parity invariant

`/crew:build <slice>` with `gepa.capture.enabled = true` must produce byte-identical artifacts to `gepa.capture.enabled = false`. Test: `captureParityGoldenTest(baseline, withCapture)` runs the same dispatch twice (mocked LLM), diffs `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/` excluding the `gepa/` subtree. Any difference = test fail = capture has side effects = bug.

CI runs this on every PR touching the capture path. Lives in `tests/gepa/capture-parity.test.ts`.

### Observability

All gepa-core operations emit structured events to `.claude/logs/events.jsonl` via the existing crew event logger:

`gepa_capture_drop` · `gepa_eval_start` · `gepa_eval_complete` · `gepa_opt_cycle_start` · `gepa_opt_no_winner` · `gepa_opt_promote` · `gepa_soak_start` · `gepa_soak_promote` · `gepa_soak_revert` · `gepa_budget_exceeded` · `gepa_tail_risk_block`.

Each event includes `trial_id` / `cycle_id` for correlation.

## Testing strategy

### gepa-core tests (Bun, in the new repo)

| Layer | What | How |
|---|---|---|
| Types | Zod schemas reject malformed payloads | `Trial.parse(invalid)` throws expected error; round-trip serialization is loss-less |
| `fileStore` | append-only, recall filters, invalidate by tag, concurrent writes safe | tmpdir fixtures; concurrent `put()` via `Promise.all` |
| `astramemStore` | mocked astramem CLI subprocess | child_process spawn mocked; verifies wire format matches memory-plugin#8 |
| `sequentialRunner` | runs cases in order, respects `AbortSignal`, budget exhaustion halt | mock scorer that delays + counts cost; assert halt at cap |
| `waveRunner` | runner-plugin loop dispatch shape, fan-out merge | mock loop CLI subprocess |
| `binaryScorer` | wraps inspector PASS/FAIL; score = 1.0 if pass else 0.0 | mock inspector subagent |
| `rubricScorer` | LLM-judge call; rubric subscores summed; rationale captured | mock LLM with fixture responses; verify subscore math |
| `paretoRank` | dominated trials get rank > 1; non-dominated all rank 1; tiebreaker chain deterministic | property test: random trials, no trial ranked below a dominating one |
| `runEvalSuite` | aggregate math correct, train / heldOut split clean | seeded RNG, golden aggregate snapshot |
| `runOptimization` | full cycle on mocked deps, partial flag on budget hit, no_winner exit clean | end-to-end mock with synthetic agent + 3 synthetic cases |
| `PromotionPolicy` | gate logic: all 5 conditions must hold for eligible | truth-table test of all 32 condition combos |
| `soakMonitor` | regression detected, early-revert path, time-window math | virtual clock |
| `validateTrialCorpus` | detects orphan agent refs, trial_id collisions, missing metrics | crafted-bad-corpus fixtures |
| `detectEvalDrift` | held-out vs train delta beyond threshold → alarm | synthetic distributions |
| `captureParityGoldenTest` | byte-identical artifacts with / without capture | dual-run + diff |

### crew integration tests (dev-team repo)

- `capture-tee` — real dispatch (mocked LLM) → trial appears in fileStore JSONL.
- `capture-walltime` — scorer that sleeps 5 s → trial dropped, dispatch artifacts identical.
- `capture-absent-parity` — `gepa.config.json` missing or `enabled: false` → zero gepa side effects on artifact tree.
- `eval-fullstack-dev` — seed dataset (5 cases) + champion prompt → `/crew:gepa-eval fullstack-dev` produces aggregate, trials stored.
- `eval-no-dataset` — run against agent with no `.gepa/eval/` → clean error with instructions.
- `history-cli` — `/crew:gepa-history fullstack-dev` shows last N trials sorted by recency.
- `optimize-artifact-only` — full cycle on fullstack-dev with auto-promote disabled → OptimizationResult written, no champion edit.
- `optimize-budget-halt` — budget = $0.10 → halt partway, partial flag set, no promotion.
- `optimize-tail-risk-block` — crafted candidate with held-out case < 0.6 → block with event logged.
- `soak-promote-happy-path` — virtual clock 7 days, no regression → champion replaced atomically, frontmatter updated.
- `soak-revert-on-regression` — crafted regression mid-soak → revert, alarm, forensics artifact.
- `critical-agent-allowlist` — optimize inspector with all gates green → draft PR opened, no auto-merge.

### Test fixtures + seeds

- `tests/fixtures/gepa/sample-agents/` — minimal valid agents matching the `validate-agents.ts` ≤ 350-line cap.
- `tests/fixtures/gepa/eval-datasets/` — 5 hand-seed cases per target agent, also held-out variants.
- `tests/fixtures/gepa/bad-corpus/` — orphan refs, missing metrics, collision IDs.
- Mocked LLM responses stored as `.json` fixtures so judge subscores are reproducible.

### Coverage gates (CI)

- gepa-core: ≥ 90 % line coverage (small lib, achievable).
- crew integration: ≥ 80 % on capture / eval / optimize command paths.

### What NOT to test

- Real LLM calls (cost + flake). Mock at scorer + generator interface boundaries.
- Real GitHub PR creation in unit tests (use mock gh CLI). E2E PR test runs ≤ 1× per release in a sandbox repo.
- `runner-plugin` internals (covered by its own suite).
- astramem CLI internals (covered by memory-plugin's own suite).

## Slice plan

| Slice | Repo | Scope | Acceptance evidence | Est. days |
|---|---|---|---|---|
| **S1** | new repo `astragenie/gepa-core` | bootstrap pkg + Zod schemas (Trial, EvalCase, ScoreResult) + `fileStore` + `sequentialRunner` + `binaryScorer` + `paretoRank` + unit tests | `bun test` green, package publishable, validators pass | 3 |
| **S2** | `dev-team` (crew) | `gepa.config.json` schema + `gepaCapture()` tee in artifact writers (fullstack-dev only at first) + `/crew:gepa-history` + capture-absent-parity test | golden parity test green, walltime cap honored, p50 < 50 ms added, p99 budget asserted | 2 |
| **S3** | `dev-team` | 5 hand-seed eval cases for fullstack-dev under `agents/fullstack-dev/.gepa/eval/*.jsonl` + `/crew:gepa-eval` cmd + train / heldOut splitter | running eval produces aggregate, trials stored, `/crew:gepa-score` shows trend | 2 |
| **S4** | `dev-team` | `/crew:gepa-optimize fullstack-dev --artifact-only` (no PR, no merge) + `CandidateGenerator` wraps aiplugin-dev + budget cap + Pareto math | full cycle on fullstack-dev produces measurable gain artifact OR clean no-winner exit. **CHECKPOINT** | 3 |
| **S5** | `gepa-core` + `dev-team` | `rubricScorer` + `astramemStore` + `validateTrialCorpus` + `detectEvalDrift` validators + horizontalize: add backend-dev, frontend-dev, verifier seed datasets + eval runs | 4 agents have working eval, drift validator passes | 4 |
| **S6** | `dev-team` | inspector bug-corpus mining script (extract bug-labeled diffs from PR review history) + 10-case eval set + inspector eval run using rubricScorer (LLM-judge breaks circularity) | inspector eval produces aggregate, no scorer-circular warning | 3 |
| **S7** | `dev-team` | architect hand-labeled cases (8–10 by senior eng OR using critical-thinking agent as judge) + `soakMonitor` + `PromotionPolicy` default + `gepa.config.json` policy section | architect eval produces aggregate, soak harness works on dummy promotion | 3 |
| **S8** | `dev-team` + `gepa-core` | auto-PR via gh CLI + auto-merge gate (5 conditions) + critical-agent allowlist + champion provenance frontmatter + `/crew:gepa-invalidate` + `/crew:gepa-revert` + observability events | one real cycle on fullstack-dev passes all gates and auto-merges; one real cycle on inspector files draft PR | 3 |

**Total ≈ 23 working days = 5 calendar weeks.**

### Slice dependencies

```
S1 ──┬─► S2 ──► S3 ──► S4 (CHECKPOINT)
     │                   │
     └─► S5 ◄────────────┘
                │
                ├─► S6 (inspector)
                ├─► S7 (architect + soak)
                └─► S8 (auto-PR + auto-merge)
```

### Risk-weighted exit gates

- **After S4**: if optimizer fails to produce measurable gain on fullstack-dev, **stop**. Rescope before S5. Avoids the architect's "theatre" risk.
- **After S7**: dry-run soak end-to-end. If the soak harness can't detect a crafted regression, **stop**. Don't ship S8.

### Mapping ticket #121 phases → slice plan

| Ticket phase | Slices | Note |
|---|---|---|
| Phase 1 (Capture, 1 week) | S1 + S2 | extracted gepa-core ESM lib; capture lives in crew thin glue |
| Phase 2 (Eval, 1 week) | S3 + S5 + S6 + part of S7 | hybrid datasets + horizontalize, not "1 week" |
| Phase 3 (Optimize, 2 weeks) | S4 + S7 + S8 | safer promotion gate + soak |
| Phase 4 (deferred) | post-v1 | unchanged |

### Cross-repo coordination

| Repo | When it changes |
|---|---|
| `gepa-core` | S1 (bootstrap), S5 (rubricScorer + astramem store + validators), S8 (promotion policy types) |
| `dev-team` | S2 – S4 (capture, eval, optimize MVP for fullstack-dev), S5 – S8 (horizontalize + safety) |
| `runner-plugin` | **no required changes** — `waveRunner` adapter is optional, deferred until parallel candidate runs become a bottleneck (post-v1) |
| `memory-plugin` | **no required changes for crew** — `astramemStore` lights up automatically when astramem CLI is present; spec contract sync is opportunistic, not blocking |

## Open product calls remaining

- Should the soak phase percentage be tunable per-agent (e.g. 5 % for inspector during eval, 20 % for frontend-dev once trust earned)? Default to single global value for v1.
- Should `rubricScorer` use a fixed model (e.g. `claude-haiku-4-5`) or follow the user's session model? Default to fixed haiku for v1 — judge cost stays predictable.
- Should auto-grown captured cases be moved into git automatically, or held in a separate "candidate cases" pool until reviewed? Default to candidate pool; a separate `/crew:gepa-promote-cases` command for batch human review is scoped as a v2 deliverable (not in S1–S8).

## Deferred (post-v1)

- `aiplugin-dev` recursive eval (downstream Δ measurement).
- `waveRunner` for parallel candidate runs (`runner-plugin` peer dep).
- Multi-agent simultaneous optimize.
- Scheduled nightly optimize (loop-plugin ceremony).
- Auto-promote without soak (only after data proves soak adds no signal).
- Provider switching for the judge model.
- LLM-judge with multiple critic personas (e.g. critical-thinking + architect-reviewer voting).

## References

- Issue: [astragenie/dev-team#121](https://github.com/astragenie/dev-team/issues/121)
- Memory storage contract: memory-plugin#8 (latest comment locks decisions)
- runner-plugin wave dispatcher: runner-plugin#289 (slice ceremony integration)
- Architect review: independent design review of the original ticket (verdict GO-WITH-CHANGES).
- Critical-thinking review: 6-question assumption challenge of the original ticket.
- Crew artifact writers: `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/`
- Validator that needs `.gepa/` subdir awareness: `scripts/validate-agents.ts`

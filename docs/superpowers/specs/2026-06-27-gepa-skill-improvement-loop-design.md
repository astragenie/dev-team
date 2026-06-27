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
- Zero hard cross-plugin runtime deps: defaults (`fileStore` + `sequentialRunner` + `ollamaJudge`) work without `runner-plugin`, `memory-plugin`, or any paid SDK installed.
- Pluggable LLM judge: library ships built-in adapters for Ollama (local default, $0), Azure OpenAI (enterprise), and Gemini (free tier). Anthropic and other providers can land in v2 without library changes.
- A promotion gate that distinguishes "noise" from "real gain" and refuses to auto-merge critical agents (`inspector`, `verifier`, `architect`).

## Non-goals

- Multi-agent simultaneous optimization (v2).
- `aiplugin-dev` evaluation — meta-agent, requires recursive downstream-Δ measurement (v2+).
- Scheduled nightly optimization via `runner-plugin` ceremony (v2 once v1 proves itself).
- Auto-promotion without soak phase (only after data proves soak adds no signal).
- Changes to `astramem-local` schema (existing `fact` type + tags is sufficient).
- Provider-switching, marketplace ownership of GEPA agents in third-party plugins.
- `anthropicJudge` adapter (v2, only if Ollama + Azure + Gemini judge quality proves insufficient).
- Cross-agent regression gate spanning historical eval suites (v2, needs more trial corpus before useful).
- Champion-no-regression check against prior eval datasets of sibling agents (v2 — same reason).

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
| Judge interface | `LLMJudge` interface (pluggable). v1 built-ins: `ollamaJudge` (default, $0 local), `azureOpenAIJudge` (enterprise), `geminiJudge` (free tier). v2: `anthropicJudge`. | `rubricScorer` takes `judge: LLMJudge` as dep; consumer plugins pick per-agent in `gepa.config.json`. Matches the rest of the spec's pluggable-adapter pattern (Scorer/TrialStore/RunnerAdapter). |
| Default judge model | `ollamaJudge` with `llama3.2:latest` against `http://localhost:11434` | Local-first, $0 cost, privacy-friendly, no rate limits. High-volume judge calls don't burn budget. Tradeoff: ~3–5 s per case latency, requires Ollama install. |
| Soak sample-size floor | `PromotionPolicy.minSoakTrials: 20` + soak extends until BOTH `soakDays` clock AND `minSoakTrials` sample met; hard cap `maxSoakDays: 21` | 7-day × 10 % traffic on a low-volume agent can yield n=3 — statistical theatre. Sample floor + max-clock prevents both under-sample promotion and indefinite soak. |
| Cross-repo version pinning | `gepa-core` follows semver; consumer plugins pin via `^MAJOR.MINOR` in `package.json`; breaking changes to `CrewArtifact` or any exported interface require MAJOR bump | Without semver discipline, a `gepa-core` patch could silently break crew or sales-team. |

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
| **C13.** Soak conflates clock and sample size — n=3 over 7 days is statistical theatre (crew:architect, post-spec review) | `PromotionPolicy.minSoakTrials` floor (default 20) + dual-gate rule (BOTH clock AND sample), hard cap `maxSoakDays` 21 — see Soak phase mechanics. |
| **C14.** `CrewArtifact` referenced but never defined (crew:architect) | Promoted to first-class `CrewArtifactSchema` Zod schema with explicit `score_hint` semantics — see Types section. |
| **C15.** `BudgetMeter` declared but never wired into top-level functions (crew:architect) | `runEvalSuite` + `runOptimization` now take `meter: BudgetMeter` as explicit dep; built-ins `dailyCapMeter` + `sharedAstramemMeter`; `RunnerAdapter.runCandidates` + `CandidateGenerator.generate` also take meter. |
| **C16.** Missing types: `AgentRun`, `Candidate`, `GepaConfig` (crew:architect) | All added as Zod schemas in the Types section. |
| **C17.** Concurrent eval/optimize collisions (worktree parallelism) — no lock (crew:architect) | `LockManager` interface + `fileLockManager` built-in writing to `.claude/artifacts/crew/gepa/locks/<agent>.<op>.lock` with PID + heartbeat. Top-level fns take `lock: LockManager`. |
| **C18.** Capture parity test undertested — no SIGKILL case (crew:architect) | SIGKILL-during-`put` case added to `captureParityGoldenTest`; `fileStore` uses atomic `O_APPEND` single-syscall writes; `validateTrialCorpus` discards torn lines. |
| **C19.** Candidate prompt ≤350-line invariant not enforced pre-scoring (crew:3rdparty:architect-reviewer revisit) | `validateCandidateSize` exposed in library; `RunnerAdapter` built-ins call it BEFORE LLM spend; oversized candidates marked `pareto_rank: null` rationale `oversized_candidate`. |
| **C20.** Soak trial scoring path undefined — binary or rubric? (crew:3rdparty:architect-reviewer revisit) | Soak trials scored by the configured `Scorer` (rubricScorer default), preserving continuous-gradient signal into regression detection. |
| **C21.** Branch protection presence not gated before auto-merge (crew:3rdparty:architect-reviewer revisit) | S8a checks `gh api repos/:owner/:repo/branches/main/protection` before enabling auto-merge; missing protection forces draft PR with `branch_protection_missing` label. |
| **C22.** Champion provenance frontmatter collides with 350-line cap (crew:3rdparty:architect-reviewer revisit) | `validate-agents.ts` taught to exempt `gepa:` YAML frontmatter block from the count — see Data location summary. |
| **C23.** `gepa-core` version-pin strategy missing (both reviewers) | Strict semver locked in Invariants section; CHANGELOG.md mandatory; consumer plugins pin `^MAJOR.MINOR`. |
| **C24.** `freeze a champion` kill-switch missing — per-agent block on optimization (crew:architect) | Added `champion_frozen: string[]` in `GepaConfigSchema`; `/crew:gepa-thaw` cmd reverses; kill-switches list item #6. |
| **C25.** Judge model decision deferred but unsafe to leave open (crew:architect) | Decided in this revision: pluggable `LLMJudge` with `ollamaJudge` (`llama3.2:latest`) default. v1 also ships `azureOpenAIJudge` + `geminiJudge`. |

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
- `fileStore` + `sequentialRunner` + `ollamaJudge` defaults work with no other plugins or paid SDKs installed.
- `runner-plugin` and `memory-plugin` are optional peer deps. The library imports nothing from them; consumer plugins wire adapters in their own config.
- Cloud judge adapters (`azureOpenAIJudge`, `geminiJudge`) are optional peer deps on their respective SDKs (`@azure/openai`, `@google/generative-ai`). Library publishes them as separate entry points: `@astragenie/gepa-core/judges/azure`, `@astragenie/gepa-core/judges/gemini`. Importing them without the SDK throws a clean install-instruction error.
- Future plugin (e.g. `sales-team`) drops in `@astragenie/gepa-core` + its own `gepa.config.json` + its own scorer agent + its own eval datasets. No library change needed.
- `gepa-core` follows strict semver. Breaking changes to any exported interface (Scorer, TrialStore, RunnerAdapter, PromotionPolicy, LLMJudge, CrewArtifact, CandidateGenerator) bump MAJOR. Consumer plugins pin `^MAJOR.MINOR`. CHANGELOG.md is mandatory per release.

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

// CrewArtifact — the cross-plugin contract between gepa-core and any consumer plugin.
// Consumer plugins (crew, future sales-team, etc.) adapt their concrete artifact types into this shape.
// Source of truth for what `gepaCapture()` accepts.
export const CrewArtifactSchema = z.object({
  agent: z.string(),                              // e.g. "fullstack-dev"
  phase: z.enum(["build","review","validate","ship"]),
  input: z.unknown(),                             // raw dispatch input
  output: z.unknown(),                            // raw dispatch return
  score_hint: z.object({
    pass: z.boolean().optional(),                 // inspector / validator verdict if present
    rubric_signal: z.record(z.string(), z.number()).optional(),
    cost_usd: z.number().nonnegative().optional(),
    latency_ms: z.number().int().nonnegative().optional(),
  }).optional(),                                  // null when artifact has no scoring context
  source_artifact_path: z.string().optional(),    // .claude/artifacts/crew/.../<file>.json for trace-back
  dispatched_at: z.string().datetime(),
});

// AgentRun — what a Scorer receives when scoring one execution of a candidate prompt against one EvalCase.
export const AgentRunSchema = z.object({
  agent: z.string(),
  candidate_prompt_path: z.string(),
  case_id: z.string(),
  raw_output: z.unknown(),                        // agent's actual return
  cost_usd: z.number().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  finished_at: z.string().datetime(),
});

// Candidate — a prompt variant produced by CandidateGenerator.
export const CandidateSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  prompt_path: z.string(),                        // path on disk (e.g. tmp/gepa/candidates/<uuid>.md)
  prompt_hash: z.string(),                        // sha256 of the file
  prompt_size_lines: z.number().int().positive(), // for pre-scoring ≤350-line gate
  derived_from_trials: z.array(z.string().uuid()), // failing trials that informed this candidate
  generator_cost_usd: z.number().nonnegative(),
  created_at: z.string().datetime(),
});

// gepa.config.json — root config consumer plugin writes.
export const GepaConfigSchema = z.object({
  capture: z.object({
    enabled: z.boolean().default(true),
    exclude: z.array(z.string()).default([]),     // per-agent disable
    walltime_ms: z.number().int().positive().default(2000),
  }).default({}),
  storage: z.object({
    backend: z.enum(["file", "astramem"]).default("file"),
    file_root: z.string().default(".claude/artifacts/crew/gepa/trials"),
    astramem_cli_path: z.string().optional(),
  }).default({}),
  runner: z.object({
    backend: z.enum(["sequential", "wave"]).default("sequential"),
  }).default({}),
  judge: z.object({
    provider: z.enum(["ollama", "azure-openai", "gemini"]).default("ollama"),
    model: z.string().default("llama3.2:latest"),
    endpoint: z.string().optional(),              // ollama: http://localhost:11434; azure: resource endpoint
    deployment: z.string().optional(),            // azure: deployment name
    api_key_env: z.string().optional(),           // env var name to read key from
  }).default({}),
  judge_per_agent: z.record(z.string(), z.object({
    provider: z.enum(["ollama", "azure-openai", "gemini"]),
    model: z.string(),
    endpoint: z.string().optional(),
    deployment: z.string().optional(),
    api_key_env: z.string().optional(),
  })).default({}),
  budget: z.object({
    daily_usd: z.number().nonnegative().default(50),
    per_eval_default_usd: z.number().nonnegative().default(2),
    per_optimize_default_usd: z.number().nonnegative().default(5),
  }).default({}),
  optimize: z.object({
    paused: z.boolean().default(false),
    k: z.number().int().positive().default(5),
  }).default({}),
  policy: z.object({
    eligible_agents: z.array(z.string()).default([]),
    min_pass_delta: z.number().min(0).max(1).default(0.05),
    min_case_score_floor: z.number().min(0).max(1).default(0.6),
    soak_percent: z.number().min(0).max(1).default(0.10),
    soak_days: z.number().int().positive().default(7),
    min_soak_trials: z.number().int().positive().default(20),
    max_soak_days: z.number().int().positive().default(21),
    soak_epsilon: z.number().min(0).max(1).default(0.02),
    allow_cost_regression: z.boolean().default(false),
    allow_latency_regression: z.boolean().default(false),
  }).default({}),
  champion_frozen: z.array(z.string()).default([]), // agents blocked from further optimization
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
    source?: "eval" | "captured" | "soak";   // soak monitor + audit need this
    minScore?: number;
    failuresOnly?: boolean;
    since?: string;                            // ISO datetime
    limit?: number;
  }): Promise<Trial[]>;
  invalidate(filter: { tag?: string; trial_ids?: string[]; agent?: string; since?: string }): Promise<number>;
}

export interface RunnerAdapter {
  runCandidates(
    candidates: Candidate[],
    cases: EvalCase[],
    scorer: Scorer,
    opts: { meter: BudgetMeter; signal?: AbortSignal }
  ): Promise<Trial[]>;
}

export interface CandidateGenerator {
  generate(
    currentChampionPath: string,
    failingTrials: Trial[],
    k: number,
    opts: { meter: BudgetMeter }
  ): Promise<Candidate[]>;
}

export interface PromotionPolicy {
  eligibleAgents: string[];
  minPassDelta: number;        // 0.05 (5 percentage points over champion)
  minCaseScoreFloor: number;   // 0.6 — any held-out case below this blocks promotion
  soakPercent: number;         // 0.10 (10 % of real dispatches)
  soakDays: number;            // 7 (target clock)
  minSoakTrials: number;       // 20 — sample-size floor; soak waits until BOTH clock + this met
  maxSoakDays: number;         // 21 — hard cap if traffic too low to reach sample floor; revert if still under
  soakEpsilon: number;         // 0.02 — 2 pp tolerance on `soak_pass_rate >= main_pass_rate - epsilon`
  allowCostRegression: boolean;
  allowLatencyRegression: boolean;
}

export interface BudgetMeter {
  reserve(estimateUsd: number): Promise<{ ok: boolean; remainingUsd: number }>;
  record(actualUsd: number): Promise<void>;
  spentToday(): Promise<number>;
  dailyCap(): number;
}

// Pluggable judge interface — `rubricScorer` takes one of these as a dep.
// Consumer plugins pick per `gepa.config.json` `judge` block.
export interface LLMJudge {
  evaluate(opts: {
    candidateOutput: unknown;
    expected: EvalCase;
    rubric: string[];                          // criteria text shown to the judge model
    signal?: AbortSignal;
  }): Promise<{
    pass: boolean;
    score: number;                             // 0..1 weighted sum of rubric subscores
    rubricScores: Record<string, number>;
    rationale: string;
    cost_usd: number;
    latency_ms: number;
  }>;
  describe(): { provider: string; model: string };  // for trial provenance
}

// Lockfile coordinator — prevents concurrent `/crew:gepa-eval` or `/crew:gepa-optimize`
// from racing on the same agent (worktree-parallel safety).
export interface LockManager {
  acquire(agent: string, op: "eval" | "optimize"): Promise<{ released: () => Promise<void> } | null>;
  isLocked(agent: string): Promise<boolean>;
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
  meter: BudgetMeter;
  lock: LockManager;
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
  meter: BudgetMeter;
  lock: LockManager;
  policy: PromotionPolicy;
  k: number;                  // candidates per cycle
  signal?: AbortSignal;
}): Promise<OptimizationResult>;

export async function gepaCapture(opts: {
  artifact: CrewArtifact;     // see CrewArtifactSchema in Types section above
  store: TrialStore;
  walltimeMs?: number;        // default 2000, fail-silent on miss
}): Promise<void>;

export function paretoRank(
  trials: Trial[],
  tiebreaker?: (a: Trial, b: Trial) => number
): RankedTrial[];

// Exposed pure helper for property tests + custom tiebreaker authors
export function dominates(a: Trial, b: Trial): boolean;

// Validators (architect's fitness functions + revision adds)
export function validateTrialCorpus(store: TrialStore): Promise<ValidationReport>;
export function detectEvalDrift(trials: Trial[], heldOutPass: number): DriftReport;
export function captureParityGoldenTest(baseline: Artifact[], withCapture: Artifact[]): boolean;
export function validateCandidateSize(candidate: Candidate, maxLines: number): { ok: boolean; reason?: string };
// `validateCandidateSize` is invoked by RunnerAdapter built-ins BEFORE budget spend on each candidate.
// Default maxLines = 350, matching `scripts/validate-agents.ts` cap. Oversized candidates are rejected
// with `pareto_rank: null` + `rationale: "oversized_candidate"`.

// Built-in scorers
export const binaryScorer: (passAgent: string) => Scorer;
export const rubricScorer: (judge: LLMJudge) => Scorer;

// Built-in TrialStores
export const fileStore: (root: string) => TrialStore;
export const astramemStore: (cliPath?: string) => TrialStore;

// Built-in RunnerAdapters
export const sequentialRunner: () => RunnerAdapter;
export const waveRunner: (loopCli: string) => RunnerAdapter;   // peer-dep on runner-plugin

// Built-in BudgetMeter
export const dailyCapMeter: (capUsd: number, persistPath: string) => BudgetMeter;
export const sharedAstramemMeter: (cliPath: string) => BudgetMeter; // shares wallet w/ astramem-local

// Built-in LockManager
export const fileLockManager: (locksDir: string) => LockManager;
// Default: .claude/artifacts/crew/gepa/locks/<agent>.<op>.lock — atomic O_EXCL writes,
// stale lock detection (PID + heartbeat), released() removes file.

// LLMJudge built-ins — each is a separate entry point so the peer SDK isn't pulled unless wired.
// `@astragenie/gepa-core/judges/ollama`
export const ollamaJudge: (opts: { model: string; endpoint?: string }) => LLMJudge;
// `@astragenie/gepa-core/judges/azure` — peer-dep `@azure/openai`
export const azureOpenAIJudge: (opts: {
  deployment: string;
  endpoint: string;
  apiKey?: string;            // either apiKey or use DefaultAzureCredential via Entra ID
  useEntraId?: boolean;
}) => LLMJudge;
// `@astragenie/gepa-core/judges/gemini` — peer-dep `@google/generative-ai`
export const geminiJudge: (opts: { model: string; apiKey: string }) => LLMJudge;
```

### Shape rationale

- All input / output typed `z.unknown()` — library is agent-agnostic. Plugin author's scorer interprets.
- `recall()` filters are explicit fields, not free-text — predictable, testable, no FTS5 dep for `fileStore`. `source` field added so soak monitor can pull only `source: "soak"` trials without post-recall filtering.
- `runOptimization()` and `runEvalSuite()` take `train` + `heldOut` (where applicable) separately so the drift detector can compare the two distributions.
- `signal: AbortSignal` on long-running calls → architect kill-switch concern. Caller can abort mid-cycle.
- No top-level config object — every function takes explicit deps. Easier to test, no global state.
- `BudgetMeter` and `LockManager` are now explicit deps on `runEvalSuite` and `runOptimization`. Previously `budgetUsd: number` was a leak: it hid where the dollar accounting lived. Explicit `meter: BudgetMeter` lets the consumer plugin wire `dailyCapMeter` (standalone) or `sharedAstramemMeter` (shared wallet) without library changes.
- `LLMJudge` is injected into `rubricScorer`, not built in. This is the load-bearing pluggability win: changing judge provider is a config switch, not a library bump.
- Built-in factories follow `(opts) => Interface` shape so they compose like normal values. No DI container.
- `validateCandidateSize` is exposed so the runner can pre-screen oversized candidates BEFORE scoring spend. Architect concern: a candidate that violates `validate-agents.ts` ≤350-line cap should never reach a paid LLM call.

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

**Soak trial scoring path.** Each soak dispatch tees a trial tagged `source: "soak"` — BUT scoring differs from `source: "captured"`. Soak trials are scored by the same `Scorer` configured for that agent's eval pipeline (typically `rubricScorer` with the configured `LLMJudge`), not just the binary inspector/validator PASS/FAIL from the live dispatch artifact. Reason: continuous rubric scores are needed for noise-tolerant regression detection (architect C4 win — preserving the continuous-gradient signal into soak). The judge call is async, fire-and-forget like capture, bounded by `walltime_ms`. Cost is attributed to the soak budget line (not the live dispatch).

**Promotion gate — dual clock + sample.** After every dispatch, library re-evaluates:
- `elapsed_days = now - soak_started_at`
- `soak_trials_count = store.recall({ agent, source: "soak", since: soak_started_at }).length`
- `promote_eligible = elapsed_days >= soakDays AND soak_trials_count >= minSoakTrials`
- If `elapsed_days >= maxSoakDays` (default 21) AND `soak_trials_count < minSoakTrials` → revert (agent has too little traffic for honest soak; log `soak_insufficient_traffic`).

When `promote_eligible`:
- `soak_pass_rate = mean(soak_trials.map(t => t.score))`     // continuous, not binary
- `main_pass_rate = mean(main_trials_same_window.map(t => t.score))`
- If `soak_pass_rate >= main_pass_rate - soakEpsilon` (default `0.02`, i.e. 2 pp continuous-score tolerance) → promote.
- Else → revert (delete soak pointer, retain trials for forensics, log `soak_revert_regression`).

**Sample-floor rationale.** Architect: a 7-day × 10 % soak on a low-volume agent (e.g. `architect`, which dispatches a handful of times per week) can yield n=3 — a 2 pp tolerance over n=3 is statistical theatre. The sample floor + clock-vs-sample logic ensures the promotion signal is honest before any auto-merge fires.

**Early-revert escape.** If during soak ANY rolling-window check (1-day rolling) shows `soak_pass_rate < main_pass_rate - 0.10` (10 pp regression), revert immediately — don't wait out the clock. Logs `soak_revert_early`, writes forensics artifact at `.claude/artifacts/crew/gepa/soak/<agent>-early-revert-<ts>.json`.

### Data location summary

| Where | What | Lifetime |
|---|---|---|
| `.claude/artifacts/crew/gepa/trials/<agent>.jsonl` | `fileStore` trial log | append-forever, validators check integrity |
| `.claude/artifacts/crew/gepa/eval/<run-id>.json` | eval run summary | committed |
| `.claude/artifacts/crew/gepa/opt/<run-id>.json` | optimize run summary | committed |
| `.claude/artifacts/crew/gepa/soak.json` | active soak pointers (per-agent) | overwritten on promote / revert |
| `.claude/artifacts/crew/gepa/soak/<agent>-early-revert-<ts>.json` | soak early-revert forensics | committed |
| `.claude/artifacts/crew/gepa/locks/<agent>.<op>.lock` | concurrent eval/optimize collision guard | ephemeral; PID + heartbeat |
| `.claude/artifacts/crew/gepa/candidates/<cycle-id>/<uuid>.md` | tmp candidate prompt files during one optimize cycle | deleted at cycle end |
| `agents/<name>/.gepa/eval/*.jsonl` | hand-seeded + grown eval cases | git-tracked |
| `agents/<name>/.gepa/rubric.md` | rubric criteria for `rubricScorer` (per-agent) | git-tracked |
| `gepa.config.json` (repo root) | plugin glue config | git-tracked |

The validator script `scripts/validate-agents.ts` must:
1. Skip `.gepa/` subdirs when enumerating agent files (so eval datasets + rubric don't get counted as agents).
2. Exempt the `gepa:` YAML frontmatter block from the ≤350-line cap on agent prompts — otherwise the champion-provenance frontmatter (5+ lines added on each promotion) eats the cap for GEPA-touched agents.

## Error handling + safety

### Failure modes

| Where | Failure | Response |
|---|---|---|
| Capture tee | `store.put()` exceeds 2 s walltime | drop trial, log `gepa_capture_drop` to `.claude/logs/events.jsonl`, dispatch continues |
| Capture tee | `store.put()` throws | catch, log, drop trial, dispatch continues — **never propagate** |
| Capture tee | astramem CLI absent when `astramemStore` is configured | fallback to `fileStore` if both configured; else log + drop |
| Capture tee | SIGKILL mid-`put` (process crash during JSONL append) | fileStore must use atomic append (`O_APPEND` + single `write()` syscall under JSONL line size). On recovery, validateTrialCorpus detects torn lines and discards them. Capture parity golden test MUST include SIGKILL-during-put case. |
| Eval | scorer throws | mark case as `pass: false, score: 0, rationale: "scorer_error: <msg>"` — keep trial, eval continues |
| Eval | runner walltime exceeded | abort current case via `AbortSignal`, mark `pass: false, score: 0, rationale: "runner_timeout"` |
| Eval | budget cap exceeded mid-run | halt remaining cases, write partial aggregate with `partial: true`, no promotion eligibility |
| Optimize | candidate generation returns < k candidates | proceed with what returned, log `candidate_underflow`, no abort |
| Optimize | candidate exceeds 350-line cap | rejected by `validateCandidateSize` BEFORE any LLM call. `pareto_rank: null`, rationale `oversized_candidate`. No budget spent. |
| Optimize | all candidates dominated by champion | no promotion, write artifact with `no_winner: true`, exit clean |
| Optimize | `runOptimization` for an agent returns no winner 3 cycles in a row | halt subsequent cycles for that agent, log `no_winner_streak`, require manual `/crew:gepa-resume` to retry |
| Optimize | budget cap hit during candidate runs | halt, partial flag, no promotion |
| Optimize | Pareto rank shows tie at #1 | tiebreaker chain: `pass > score > -cost > -latency`; if still tied → first by trial_id (deterministic) |
| Optimize | held-out case scores reveal tail risk (any case < 0.6) | no promotion, log `tail_risk_block`, candidate retained in trials for next cycle |
| Optimize / Eval | another op already holds lock for same agent | `LockManager.acquire()` returns null, command exits with `already_in_progress: <other-pid>`, exit code 2. No partial work. |
| Judge | LLMJudge endpoint unreachable (e.g. Ollama not running) | retry once with 1 s backoff; if still down → eval/optimize halts with `judge_unreachable: <provider>`, partial flag, no promotion. Single-source-of-truth for judge failure mode. |
| Judge | LLMJudge returns malformed score (NaN, out-of-range) | retry once; if still bad → mark case `pass: false, score: 0, rationale: "judge_malformed"`. |
| Soak | soak champion file corrupt | revert to main champion, alarm, mark soak failed |
| Soak | rolling 1-day window shows ≥10 pp continuous-score regression vs main | early-revert, alarm, write `soak/<agent>-early-revert-<ts>.json` forensics artifact |
| Soak | dispatcher can't read `soak.json` | use main champion, log read failure once, continue |
| Soak | `maxSoakDays` (default 21) reached without hitting `minSoakTrials` floor | revert, log `soak_insufficient_traffic`, mark for manual review (agent too low-volume for auto-merge path; queue as draft PR instead) |
| Promote | auto-merge attempt | writes prompt file to working tree + commits on `gepa/<agent>/<trial-id>` branch, then `gh pr merge --auto --squash`. Branch protection still enforces CI green. Never `git push origin main` direct. |
| Promote | branch protection NOT configured on target repo (`gh api repos/:owner/:repo/branches/main/protection` returns 404) | refuse auto-merge — open as draft PR with `branch_protection_missing` label. Auto-merge requires required-checks to be enforced; otherwise the gate is theatre. |
| Promote | champion is on `champion_frozen` list | block optimization start with `champion_frozen` error. Operator must `/crew:gepa-thaw <agent>` first. |

### Kill-switches

1. **Runtime capture disable**: `gepa.config.json` → `capture.enabled: false`. Library checks per call. No code reload needed.
2. **Per-agent capture disable**: `capture.exclude: ["inspector"]`. Useful during incident triage.
3. **Trial corpus invalidation**: `/crew:gepa-invalidate --agent fullstack-dev --since 2026-06-20` → `TrialStore.invalidate({tag, agent, since})`. Records an audit row.
4. **Optimization global pause**: `gepa.optimize.paused: true` blocks `/crew:gepa-optimize` from launching new cycles. Soak phases continue to completion (or `--force-revert`).
5. **Soak abort**: `/crew:gepa-revert --agent fullstack-dev` → deletes soak pointer, restores main champion, alarms.
6. **Freeze a champion**: `gepa.config.json` → `champion_frozen: ["inspector"]` blocks ALL future `/crew:gepa-optimize` cycles for that agent without disabling capture. Use during incident triage when a champion is suspect but you still want to gather trials. `/crew:gepa-thaw <agent>` removes from list. Required because `optimize.paused: true` halts ALL optimization globally; this is per-agent.
7. **Champion provenance**: every agent prompt file gets frontmatter:
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

**Crash-during-capture parity** (architect concern). The 2 s walltime race is exactly where parity breaks. Test must include a SIGKILL case:
1. Start a dispatch with `gepa.capture.enabled = true`.
2. Mid-`store.put()` (during JSONL append), SIGKILL the worker.
3. On recovery, assert:
   - Artifact tree under `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/` is byte-identical to a control run (no capture).
   - JSONL trial file either contains the line fully or doesn't contain it at all — never a torn line. `validateTrialCorpus` should report zero torn lines.

**Capture write-path latency budget.** Hard numbers (not hand-wave): `p50 ≤ 50 ms`, `p99 ≤ 200 ms`, `max ≤ walltime_ms (default 2000 ms — anything past this is dropped, never delays dispatch)`. CI asserts via dedicated micro-benchmark in `tests/gepa/capture-perf.test.ts`.

CI runs both tests on every PR touching the capture path. Live in `tests/gepa/capture-parity.test.ts` and `tests/gepa/capture-perf.test.ts`.

### Observability

All gepa-core operations emit structured events to `.claude/logs/events.jsonl` via the existing crew event logger:

`gepa_capture_drop` · `gepa_eval_start` · `gepa_eval_complete` · `gepa_opt_cycle_start` · `gepa_opt_no_winner` · `gepa_opt_promote` · `gepa_soak_start` · `gepa_soak_promote` · `gepa_soak_revert` · `gepa_soak_revert_early` · `gepa_soak_insufficient_traffic` · `gepa_budget_exceeded` · `gepa_tail_risk_block` · `gepa_oversized_candidate` · `gepa_judge_unreachable` · `gepa_judge_malformed` · `gepa_lock_collision` · `gepa_branch_protection_missing` · `gepa_no_winner_streak` · `gepa_champion_frozen`.

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
| `captureParityGoldenTest` | byte-identical artifacts with / without capture, INCLUDING SIGKILL-during-`put` torn-line case | dual-run + diff; subprocess SIGKILL in child writer |
| `ollamaJudge` | rubric evaluation against fixture, score in 0..1, rationale captured | mock HTTP server on localhost:11434 returning fixed JSON |
| `azureOpenAIJudge` | rubric evaluation, Entra ID auth path, error on bad deployment | mock `@azure/openai` SDK calls |
| `geminiJudge` | rubric evaluation, free-tier quota error handled | mock `@google/generative-ai` |
| `dailyCapMeter` | reserve respects cap, persist across process restart, day-roll-over | tmpdir + virtual clock |
| `fileLockManager` | acquire is atomic (O_EXCL), heartbeat detection, stale lock recovery, concurrent acquire races | fork child processes; assert only one wins |
| `validateCandidateSize` | counts lines, exempts frontmatter when configured | fixture with various sizes |
| `GepaConfigSchema` | defaults applied, invalid configs rejected with field path | parse fixtures |
| `CrewArtifactSchema` | round-trips through `gepaCapture`, malformed payload rejected | fixture series |

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
- `concurrent-eval-block` — two `/crew:gepa-eval fullstack-dev` invocations from sibling worktrees → second exits with `already_in_progress`, exit code 2.
- `oversized-candidate-rejected` — generator returns a 400-line candidate → rejected before any LLM spend; pareto_rank null; rationale `oversized_candidate`.
- `judge-unreachable-halt` — ollama endpoint dead during eval → eval halts cleanly with `judge_unreachable: ollama`, no partial trial corruption.
- `branch-protection-missing-blocks-merge` — auto-merge attempted on unprotected target → draft PR with label, no merge.
- `champion-frozen-blocks-cycle` — `champion_frozen: ["inspector"]` configured → `/crew:gepa-optimize inspector` exits with `champion_frozen` before generator spend.
- `soak-sample-floor` — soak with n=10 trials but clock met → soak extends (does not promote) until minSoakTrials hit or maxSoakDays reached.
- `soak-insufficient-traffic` — agent dispatches < minSoakTrials over maxSoakDays → revert with `soak_insufficient_traffic`, auto-merge path disabled for that agent in this cycle.
- `frontmatter-cap-exemption` — agent with 348-line body + 8-line `gepa:` frontmatter → `validate-agents.ts` passes (would fail without exemption).

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
| **S1** | new repo `astragenie/gepa-core` | bootstrap pkg + Zod schemas (Trial, EvalCase, ScoreResult, **CrewArtifact, AgentRun, Candidate, GepaConfig**) + `fileStore` + `sequentialRunner` + `binaryScorer` + `dailyCapMeter` + `fileLockManager` + `paretoRank` + `dominates` + `validateCandidateSize` + unit tests + semver + CHANGELOG | `bun test` green, package publishable, validators pass | 3 |
| **S2** | `dev-team` (crew) | `gepa.config.json` loader (validates via `GepaConfigSchema`) + `gepaCapture()` tee in artifact writers (fullstack-dev only at first) + `/crew:gepa-history` + capture-absent-parity test + SIGKILL-during-put parity test + `tests/gepa/capture-perf.test.ts` | golden parity test green (incl. SIGKILL case), capture latency `p50 ≤ 50 ms / p99 ≤ 200 ms / max ≤ 2000 ms` asserted in CI, `validate-agents.ts` taught to skip `.gepa/` subdirs + exempt `gepa:` YAML frontmatter from 350-line cap | 2 |
| **S3** | `dev-team` | 5 hand-seed eval cases for fullstack-dev under `agents/fullstack-dev/.gepa/eval/*.jsonl` + `/crew:gepa-eval` cmd + train / heldOut splitter + lock acquire/release on agent during eval | running eval produces aggregate, trials stored, `/crew:gepa-score` shows trend, concurrent `/crew:gepa-eval fullstack-dev` exits cleanly with `already_in_progress` | 2 |
| **S4** | `dev-team` | `/crew:gepa-optimize fullstack-dev --artifact-only` (no PR, no merge) + `CandidateGenerator` wraps aiplugin-dev + budget cap via `dailyCapMeter` + Pareto math + 3-cycle no-winner halt | full cycle on fullstack-dev produces measurable gain artifact OR clean no-winner exit. **CHECKPOINT 1** | 3 |
| **S5a** | `gepa-core` | `LLMJudge` interface + `ollamaJudge` built-in (separate entry point) + `rubricScorer` impl + `validateTrialCorpus` + `detectEvalDrift` validators | judge interface contract test; `rubricScorer` with `ollamaJudge` produces continuous score against fixture rubric | 2 |
| **S5b** | `gepa-core` + `dev-team` | `azureOpenAIJudge` (peer-dep `@azure/openai`) + `geminiJudge` (peer-dep `@google/generative-ai`) + per-agent `judge_per_agent` config switch + `agents/<name>/.gepa/rubric.md` loader | each adapter has unit test against mocked SDK; per-agent override switches model correctly | 2 |
| **S5c** | `gepa-core` + `dev-team` | `astramemStore` + `sharedAstramemMeter` (shares wallet with astramem-local) + horizontalize: backend-dev, frontend-dev, verifier seed datasets + eval runs | 4 agents have working eval (fullstack + backend + frontend + verifier), astramem trial store interchangeable with file store under same eval | 2 |
| **S6** | `dev-team` | inspector bug-corpus mining script (extract bug-labeled diffs from PR review history) + 10-case eval set + inspector eval run using `rubricScorer` (LLM-judge breaks circularity) | inspector eval produces aggregate, no scorer-circular warning | 3 |
| **S7** | `dev-team` | architect hand-labeled cases (8–10 by senior eng OR using critical-thinking agent as judge) + soak monitor (dual clock + sample floor + early-revert) + `PromotionPolicy` default + `gepa.config.json` policy section + champion-frozen list support | architect eval produces aggregate, soak harness detects crafted regression on dummy promotion within rolling 1-day window. **CHECKPOINT 2** | 3 |
| **S8a** | `dev-team` + `gepa-core` | auto-PR via gh CLI on `gepa/<agent>/<trial-id>` branch + branch-protection presence check (refuses auto-merge if missing) + champion provenance frontmatter writer | one cycle on fullstack-dev writes branch + opens PR; missing branch protection forces draft + label | 2 |
| **S8b** | `dev-team` | auto-merge gate (5 conditions: pareto-rank-1 + minPassDelta + tail-risk-floor + no-cost/latency-regression + agent-eligible-and-soak-passed) + critical-agent allowlist + `/crew:gepa-invalidate` + `/crew:gepa-revert` + `/crew:gepa-thaw` + observability events | fullstack-dev real cycle passes all gates and auto-merges; inspector real cycle files draft PR; `champion_frozen` blocks new cycles | 2 |

**Total = 24 working days ≈ 5 calendar weeks** (S1: 3, S2: 2, S3: 2, S4: 3, S5a: 2, S5b: 2, S5c: 2, S6: 3, S7: 3, S8a: 2, S8b: 2; one slice short over original 23 because S5 + S8 each split into 3 + 2 sub-slices for review clarity).

### Slice dependencies

```
S1 ──┬─► S2 ──► S3 ──► S4 (CHECKPOINT 1)
     │                   │
     └─► S5a ◄────────────┘
            │
            ▼
         S5b ──► S5c
            │      │
            ▼      ▼
           S6    S6 (parallel-able after rubricScorer lands in S5a)
                  │
                  ▼
                 S7 (CHECKPOINT 2)
                  │
                  ▼
                 S8a ──► S8b
```

S5a is the gate between MVP (S1–S4 work without LLM judge) and horizontalized eval (S5b/S5c onward need it). S5b and S5c can run in parallel by different worktrees once S5a lands. S8a (auto-PR scaffolding) and S8b (auto-merge gate) are deliberately sequential — auto-merge logic must not ship before PR shape is proven.

### Risk-weighted exit gates

- **After S4 (CHECKPOINT 1)**: if `runOptimization` returns `no_winner` 3 times in a row on fullstack-dev, **stop**. Rescope before S5a. Avoids the architect's "theatre" risk. (`no_winner_streak` event is the signal.)
- **After S7 (CHECKPOINT 2)**: dry-run soak end-to-end with a crafted regression (artificially worsen the candidate prompt and verify rolling-1-day window detects it within `minSoakTrials` dispatches). If soak harness can't detect → **stop, don't ship S8a/S8b**.
- **Before S8a auto-merge enable**: branch-protection presence check on target repo. If not configured, S8a still ships PR scaffolding but auto-merge gate stays off until protection is wired.

### Mapping ticket #121 phases → slice plan

| Ticket phase | Slices | Note |
|---|---|---|
| Phase 1 (Capture, 1 week) | S1 + S2 | extracted gepa-core ESM lib; capture lives in crew thin glue |
| Phase 2 (Eval, 1 week) | S3 + S5a + S5b + S5c + S6 | hybrid datasets + horizontalize + judge interface + per-agent judges + astramem store; honestly ~3 weeks not 1 |
| Phase 3 (Optimize, 2 weeks) | S4 + S7 + S8a + S8b | safer promotion gate + soak; honestly ~2 weeks of optimize work plus the S5 horizontalize prereq |
| Phase 4 (deferred) | post-v1 | unchanged |

### Cross-repo coordination

| Repo | When it changes |
|---|---|
| `gepa-core` | S1 (bootstrap + Zod schemas + fileStore + sequentialRunner + binaryScorer + meter + lock + validators), S5a (LLMJudge interface + ollamaJudge + rubricScorer + trial-corpus / drift validators), S5b (azureOpenAIJudge + geminiJudge entry points), S5c (astramemStore + sharedAstramemMeter), S8a (PR scaffolding helpers if any), S8b (promotion gate types if any) |
| `dev-team` | S2 – S4 (capture, eval, optimize MVP for fullstack-dev), S5b – S8b (horizontalize + safety + auto-merge gate) |
| `runner-plugin` | **no required changes** — `waveRunner` adapter is optional, deferred until parallel candidate runs become a bottleneck (post-v1) |
| `memory-plugin` | **no required changes for crew** — `astramemStore` lights up automatically when astramem CLI is present; spec contract sync is opportunistic, not blocking |
| Consumer plugins (future) | pin `^MAJOR.MINOR` on `gepa-core` in `package.json`; subscribe to `gepa-core` CHANGELOG.md for MAJOR-bump notices |

## Open product calls remaining

- **Per-agent soak percentage** — should `soakPercent` be tunable per-agent (e.g. 5 % for low-volume agents to avoid over-exposing real users, 20 % for high-volume ones once trust is earned)? Default for v1 is single global value via `policy.soak_percent`. Per-agent override can land in v1.1 via `policy.soak_percent_per_agent: Record<string, number>` without library changes — config shape is open.
- **Auto-grown captured cases** — should `score ≥ 0.9` captured runs be moved into git automatically, or held in a "candidate cases" pool until human review? Default for v1: candidate pool. `/crew:gepa-promote-cases` batch-review command scoped as v2 deliverable (not in S1–S8b).
- **Per-cycle vs per-day budget hierarchy** — current default: cycle ≤ $5, day ≤ $50. Should we add a per-week ceiling for autonomous-loop mode? Defer to v1.1 telemetry from S2 onward.

### Decided in this revision (formerly open)

- ✅ **Judge model** — pluggable via `LLMJudge`; default `ollamaJudge` (`llama3.2:latest`); v1 adapters: ollama + azure-openai + gemini.

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

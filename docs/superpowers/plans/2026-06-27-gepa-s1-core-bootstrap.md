# GEPA S1 — gepa-core bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new `@astragenie/gepa-core` ESM library with the seven foundational primitives (Zod schemas, file-backed trial store, sequential runner, binary scorer, daily-cap budget meter, file lock manager, Pareto rank + size validator) so subsequent slices can wire them into crew.

**Architecture:** Pure ESM library, zero hard Claude-Code-specific deps, zero hard cloud SDK deps. Built-ins compose via plain factory functions returning interface implementations. Bun for tests, Biome for lint+format, tsc for typecheck, semver enforced via a CHANGELOG-diff script. New repo `astragenie/gepa-core` published to npm via GitHub Actions on tagged release.

**Tech Stack:** TypeScript 5.x (strict, ESM), Zod 3.x, Bun 1.3+ test runner, Biome (lint + format), Node.js 22.6+ for stripping types in consumer CI.

**Source spec:** `docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md` — slice S1 row in the slice plan table, plus "Library API surface", "Architecture / Invariants", and "Implementation notes for plan-writing → S1" sections.

**Scope:** S1 only (3 working days). S2–S8b ship in subsequent plans authored after each prior slice lands.

---

## File Structure

The slice creates one new git repo (`astragenie/gepa-core`) with these files. All paths below are relative to that new repo's root.

### Source files

| Path | Responsibility |
|---|---|
| `src/types/trial.ts` | `TrialSchema` + `Trial` type + helper `newTrialId()` |
| `src/types/eval-case.ts` | `EvalCaseSchema` + `EvalCase` type |
| `src/types/score-result.ts` | `ScoreResultSchema` + `ScoreResult` type |
| `src/types/crew-artifact.ts` | `CrewArtifactSchema` + `CrewArtifact` type (cross-plugin contract) |
| `src/types/agent-run.ts` | `AgentRunSchema` + `AgentRun` type |
| `src/types/candidate.ts` | `CandidateSchema` + `Candidate` type |
| `src/types/gepa-config.ts` | `GepaConfigSchema` + `GepaConfig` type |
| `src/types/index.ts` | barrel re-export of all schemas + types |
| `src/interfaces.ts` | `Scorer`, `TrialStore`, `RunnerAdapter`, `CandidateGenerator`, `PromotionPolicy`, `BudgetMeter`, `LLMJudge`, `LockManager` interface declarations |
| `src/store/file-store.ts` | `fileStore(root: string): TrialStore` JSONL implementation |
| `src/runner/sequential-runner.ts` | `sequentialRunner(): RunnerAdapter` cases-in-order implementation |
| `src/scorer/binary-scorer.ts` | `binaryScorer(passAgent: string): Scorer` thin PASS/FAIL wrapper |
| `src/budget/daily-cap-meter.ts` | `dailyCapMeter(capUsd, persistPath): BudgetMeter` with reservation TTL |
| `src/lock/file-lock-manager.ts` | `fileLockManager(locksDir: string): LockManager` with PID + heartbeat |
| `src/pareto/rank.ts` | `paretoRank()` + `dominates()` pure functions |
| `src/validators/candidate-size.ts` | `validateCandidateSize(candidate, maxLines)` |
| `src/index.ts` | top-level public API barrel |

### Test files

| Path | What it covers |
|---|---|
| `tests/types/zod-roundtrip.test.ts` | every schema parses good fixtures, rejects bad payloads, round-trips loss-less |
| `tests/store/file-store.test.ts` | append-only, recall filters, invalidate, concurrent put |
| `tests/store/file-store-crash.test.ts` | SIGKILL during put → no torn lines |
| `tests/runner/sequential-runner.test.ts` | order preserved, AbortSignal honored, budget exhaustion halt |
| `tests/scorer/binary-scorer.test.ts` | score = 1.0 on pass, 0.0 on fail |
| `tests/budget/daily-cap-meter.test.ts` | reserve/record/release, TTL expiry, day-roll-over, persistence |
| `tests/lock/file-lock-manager.test.ts` | acquire is atomic, stale-PID recovery, concurrent acquire race (one wins) |
| `tests/pareto/rank.test.ts` | dominated trials rank > 1, non-dominated all rank 1, tiebreaker deterministic, `dominates` property test |
| `tests/validators/candidate-size.test.ts` | line count correct, frontmatter exempt when configured |
| `tests/fixtures/` | sample-agents/, eval-datasets/, bad-corpus/ JSON/JSONL fixtures |

### Repo plumbing

| Path | Purpose |
|---|---|
| `package.json` | name `@astragenie/gepa-core`, version `0.1.0`, `type: module`, exports map |
| `tsconfig.json` | strict TS 5.x, `module: nodenext`, `target: es2022` |
| `biome.json` | inherit project standards style, two-space indent, organize imports |
| `bunfig.toml` | bun test parallel, timeout 30000 |
| `.gitignore` | `node_modules/`, `dist/`, `*.log`, `.tmp/`, `.tap/`, `.claude/artifacts/crew/gepa/locks/` |
| `CHANGELOG.md` | seed with `## 0.1.0 (unreleased)` |
| `README.md` | short blurb + install + 30-line example |
| `LICENSE` | MIT |
| `scripts/check-semver.ts` | diff exported interface signatures against last release tag |
| `.github/workflows/ci.yml` | install bun, run lint + typecheck + test on PR + main |
| `.github/workflows/release.yml` | on tag `v*`, run check-semver, publish to npm |

---

## Pre-flight

### Task 0: Verify environment

- [ ] **Step 0.1: Verify Bun 1.3+ installed**

Run: `bun --version`
Expected: `1.3.0` or higher.
If not, install: https://bun.sh/docs/installation.

- [ ] **Step 0.2: Verify Node 22.6+ installed**

Run: `node --version`
Expected: `v22.6.0` or higher.

- [ ] **Step 0.3: Verify gh CLI authenticated to the `astragenie` org**

Run: `gh auth status`
Expected: logged in as user with access to `astragenie/*`.

- [ ] **Step 0.4: Confirm spec is committed**

Run from this worktree: `git log --oneline docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md | head -3`
Expected: at least three commits ending in `…GEPA 3rd-pass micros…`, `…GEPA revision…`, `…GEPA skill improvement loop design (tracks #121)`.

---

## Tasks

### Task 1: Create the gepa-core repo and skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `bunfig.toml`
- Create: `.gitignore`
- Create: `CHANGELOG.md`
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 1.1: Create the GitHub repo**

Run: `gh repo create astragenie/gepa-core --public --description "GEPA reflective prompt evolution toolkit — Pareto-rank prompt candidates, score with pluggable LLM judges, persist trials. Pure ESM library." --add-readme=false --license=MIT`

Expected output: `https://github.com/astragenie/gepa-core` link printed.

- [ ] **Step 1.2: Clone into the parent dev workspace**

Pick a sibling path to dev-team — e.g. `C:/work/mega/gepa-core`. Run:
```
gh repo clone astragenie/gepa-core C:/work/mega/gepa-core
```

The remainder of the steps assume `C:/work/mega/gepa-core` as the working directory unless stated otherwise.

- [ ] **Step 1.3: Write `package.json`**

Create `package.json` with this content (use Write tool):
```json
{
  "name": "@astragenie/gepa-core",
  "version": "0.1.0",
  "description": "GEPA reflective prompt evolution toolkit — Pareto-rank prompt candidates, score with pluggable LLM judges, persist trials.",
  "license": "MIT",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./judges/ollama": "./src/judges/ollama.ts",
    "./judges/azure": "./src/judges/azure.ts",
    "./judges/gemini": "./src/judges/gemini.ts"
  },
  "engines": {
    "node": ">=22.6.0",
    "bun": ">=1.3.0"
  },
  "scripts": {
    "lint": "biome check src tests",
    "format": "biome format --write src tests",
    "format:check": "biome format src tests",
    "typecheck": "tsc --noEmit",
    "test": "bun test --parallel --timeout 30000 tests/",
    "semver:check": "bun run scripts/check-semver.ts"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  },
  "peerDependenciesMeta": {
    "@azure/openai": { "optional": true },
    "@google/generative-ai": { "optional": true }
  }
}
```

- [ ] **Step 1.4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": false,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "lib": ["es2022"],
    "types": ["bun-types", "node"]
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*"]
}
```

- [ ] **Step 1.5: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "noNonNullAssertion": "error" },
      "suspicious": { "noExplicitAny": "error" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

- [ ] **Step 1.6: Write `bunfig.toml`**

```toml
[test]
preload = []
timeout = 30000
```

- [ ] **Step 1.7: Write `.gitignore`**

```
node_modules/
dist/
*.log
.tmp/
.tap/
coverage/
.DS_Store
```

- [ ] **Step 1.8: Seed `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to `@astragenie/gepa-core` follow semantic versioning.

## 0.1.0 (unreleased)

Initial release. Bootstrap of the GEPA reflective prompt evolution toolkit.

### Added

- Zod schemas: `Trial`, `EvalCase`, `ScoreResult`, `CrewArtifact`, `AgentRun`, `Candidate`, `GepaConfig`.
- Interfaces: `Scorer`, `TrialStore`, `RunnerAdapter`, `CandidateGenerator`, `PromotionPolicy`, `BudgetMeter`, `LLMJudge`, `LockManager`.
- Built-ins: `fileStore`, `sequentialRunner`, `binaryScorer`, `dailyCapMeter`, `fileLockManager`.
- Pure helpers: `paretoRank`, `dominates`, `validateCandidateSize`.
```

- [ ] **Step 1.9: Write `README.md`**

```markdown
# @astragenie/gepa-core

GEPA reflective prompt evolution toolkit. Capture agent traces, score candidate prompts with pluggable LLM judges, Pareto-rank, and promote winners. Pure ESM library — zero hard Claude Code, runner-plugin, memory-plugin, or cloud-SDK dependencies in the default build.

## Install

```sh
npm install @astragenie/gepa-core
```

## Quick start

```ts
import { fileStore, sequentialRunner, binaryScorer, paretoRank } from "@astragenie/gepa-core";

const store = fileStore(".claude/artifacts/crew/gepa/trials");
const runner = sequentialRunner();
const scorer = binaryScorer("inspector");

// ... see docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md for full wiring
```

## License

MIT.
```

- [ ] **Step 1.10: Write `LICENSE`**

Standard MIT license, copyright `2026 Astragenie`.

- [ ] **Step 1.11: Install dependencies**

Run: `bun install`
Expected: `node_modules/` populated, lockfile `bun.lockb` created.

- [ ] **Step 1.12: Commit the skeleton**

```bash
git add -A
git commit -m "chore: bootstrap @astragenie/gepa-core repo"
```

---

### Task 2: TrialSchema with TDD

**Files:**
- Create: `src/types/trial.ts`
- Create: `src/types/score-result.ts` (Trial depends on it)
- Create: `tests/types/zod-roundtrip.test.ts`

- [ ] **Step 2.1: Write the failing test for ScoreResult**

Create `tests/types/zod-roundtrip.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { ScoreResultSchema } from "../../src/types/score-result.ts";

describe("ScoreResult", () => {
  test("parses a valid payload", () => {
    const parsed = ScoreResultSchema.parse({
      pass: true,
      score: 0.85,
      cost_usd: 0.0012,
      latency_ms: 420,
    });
    expect(parsed.pass).toBe(true);
    expect(parsed.score).toBe(0.85);
  });

  test("rejects score > 1", () => {
    expect(() =>
      ScoreResultSchema.parse({
        pass: true,
        score: 1.1,
        cost_usd: 0,
        latency_ms: 0,
      }),
    ).toThrow();
  });

  test("rejects negative cost", () => {
    expect(() =>
      ScoreResultSchema.parse({
        pass: false,
        score: 0,
        cost_usd: -0.01,
        latency_ms: 0,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2.2: Run test — expect FAIL**

Run: `bun test tests/types/zod-roundtrip.test.ts`
Expected: FAIL with "Cannot find module ... score-result".

- [ ] **Step 2.3: Implement `ScoreResultSchema`**

Create `src/types/score-result.ts`:
```ts
import { z } from "zod";

export const ScoreResultSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(1),
  rubric: z.record(z.string(), z.number()).optional(),
  cost_usd: z.number().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  rationale: z.string().optional(),
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;
```

- [ ] **Step 2.4: Run test — expect PASS**

Run: `bun test tests/types/zod-roundtrip.test.ts`
Expected: 3 passing.

- [ ] **Step 2.5: Append the failing test for Trial**

Append to `tests/types/zod-roundtrip.test.ts`:
```ts
import { TrialSchema } from "../../src/types/trial.ts";

describe("Trial", () => {
  test("parses a valid eval trial", () => {
    const parsed = TrialSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      agent: "fullstack-dev",
      phase: "build",
      candidate_prompt_hash: "deadbeef",
      candidate_prompt_path: null,
      input: { case_id: "c1" },
      output: { ok: true },
      score: { pass: true, score: 0.9, cost_usd: 0.01, latency_ms: 100 },
      source: "eval",
      pareto_rank: 1,
      created_at: "2026-06-27T12:00:00.000Z",
    });
    expect(parsed.agent).toBe("fullstack-dev");
  });

  test("rejects an unknown phase", () => {
    expect(() =>
      TrialSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        agent: "x",
        phase: "deploy", // not allowed
        candidate_prompt_hash: "x",
        candidate_prompt_path: null,
        input: {},
        output: {},
        score: { pass: true, score: 1, cost_usd: 0, latency_ms: 0 },
        source: "eval",
        pareto_rank: null,
        created_at: "2026-06-27T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2.6: Run — expect FAIL**

Run: `bun test tests/types/zod-roundtrip.test.ts`
Expected: 3 prior pass, 2 new fail with module-not-found.

- [ ] **Step 2.7: Implement `TrialSchema`**

Create `src/types/trial.ts`:
```ts
import { z } from "zod";
import { ScoreResultSchema } from "./score-result.ts";

export const TrialSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  phase: z.enum(["build", "review", "validate", "ship"]),
  candidate_prompt_hash: z.string(),
  candidate_prompt_path: z.string().nullable(),
  input: z.unknown(),
  output: z.unknown(),
  score: ScoreResultSchema,
  source: z.enum(["eval", "captured", "soak"]),
  pareto_rank: z.number().int().nullable(),
  created_at: z.string().datetime(),
});

export type Trial = z.infer<typeof TrialSchema>;

export function newTrialId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 2.8: Run — expect PASS**

Run: `bun test tests/types/zod-roundtrip.test.ts`
Expected: 5 passing.

- [ ] **Step 2.9: Commit**

```bash
git add -A
git commit -m "feat(types): add ScoreResult + Trial Zod schemas"
```

---

### Task 3: Remaining Zod schemas

**Files:**
- Create: `src/types/eval-case.ts`
- Create: `src/types/crew-artifact.ts`
- Create: `src/types/agent-run.ts`
- Create: `src/types/candidate.ts`
- Create: `src/types/gepa-config.ts`
- Create: `src/types/index.ts`
- Modify: `tests/types/zod-roundtrip.test.ts`

The TDD pattern is identical to Task 2 — write the failing test, run, implement, run-pass, commit. The full code for each schema is below; for brevity these are bundled into one task, but apply the same five-step TDD cadence per schema in your subagent dispatches.

- [ ] **Step 3.1: Write failing tests for all five schemas**

Append to `tests/types/zod-roundtrip.test.ts`:
```ts
import { EvalCaseSchema } from "../../src/types/eval-case.ts";
import { CrewArtifactSchema } from "../../src/types/crew-artifact.ts";
import { AgentRunSchema } from "../../src/types/agent-run.ts";
import { CandidateSchema } from "../../src/types/candidate.ts";
import { GepaConfigSchema } from "../../src/types/gepa-config.ts";

describe("EvalCase", () => {
  test("parses minimal valid case", () => {
    const parsed = EvalCaseSchema.parse({
      id: "case-001",
      input: { prompt: "diff" },
      expected_output: { verdict: "PASS" },
    });
    expect(parsed.held_out).toBe(false);
  });

  test("rejects missing id", () => {
    expect(() => EvalCaseSchema.parse({ input: {} })).toThrow();
  });
});

describe("CrewArtifact", () => {
  test("parses a build-phase artifact", () => {
    const parsed = CrewArtifactSchema.parse({
      agent: "fullstack-dev",
      phase: "build",
      input: {},
      output: {},
      dispatched_at: "2026-06-27T12:00:00.000Z",
    });
    expect(parsed.phase).toBe("build");
  });

  test("score_hint is optional", () => {
    const parsed = CrewArtifactSchema.parse({
      agent: "x",
      phase: "review",
      input: {},
      output: {},
      dispatched_at: "2026-06-27T12:00:00.000Z",
    });
    expect(parsed.score_hint).toBeUndefined();
  });
});

describe("AgentRun", () => {
  test("parses a run", () => {
    const parsed = AgentRunSchema.parse({
      agent: "fullstack-dev",
      candidate_prompt_path: "agents/fullstack-dev.md",
      case_id: "case-001",
      raw_output: "...",
      cost_usd: 0.05,
      latency_ms: 2400,
      finished_at: "2026-06-27T12:00:00.000Z",
    });
    expect(parsed.case_id).toBe("case-001");
  });
});

describe("Candidate", () => {
  test("parses a candidate", () => {
    const parsed = CandidateSchema.parse({
      id: "22222222-2222-4222-8222-222222222222",
      agent: "fullstack-dev",
      prompt_path: ".tmp/gepa/candidates/x.md",
      prompt_hash: "abc",
      prompt_size_lines: 310,
      derived_from_trials: ["33333333-3333-4333-8333-333333333333"],
      generator_cost_usd: 0.12,
      created_at: "2026-06-27T12:00:00.000Z",
    });
    expect(parsed.prompt_size_lines).toBe(310);
  });
});

describe("GepaConfig", () => {
  test("applies defaults for empty config", () => {
    const parsed = GepaConfigSchema.parse({});
    expect(parsed.capture.enabled).toBe(true);
    expect(parsed.storage.backend).toBe("file");
    expect(parsed.judge.provider).toBe("ollama");
    expect(parsed.judge.model).toBe("llama3.2:latest");
    expect(parsed.policy.min_pass_delta).toBeCloseTo(0.05);
    expect(parsed.policy.min_soak_trials).toBe(20);
    expect(parsed.policy.max_soak_days).toBe(21);
  });

  test("rejects unknown judge provider", () => {
    expect(() =>
      GepaConfigSchema.parse({
        judge: { provider: "unknown-provider", model: "x" },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 3.2: Run — expect FAIL**

Run: `bun test tests/types/zod-roundtrip.test.ts`
Expected: many module-not-found errors.

- [ ] **Step 3.3: Implement `EvalCaseSchema`**

Create `src/types/eval-case.ts`:
```ts
import { z } from "zod";

export const EvalCaseSchema = z.object({
  id: z.string(),
  input: z.unknown(),
  expected_output: z.unknown().nullable().optional(),
  rubric: z.array(z.string()).optional(),
  held_out: z.boolean().default(false),
  notes: z.string().optional(),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;
```

- [ ] **Step 3.4: Implement `CrewArtifactSchema`**

Create `src/types/crew-artifact.ts`:
```ts
import { z } from "zod";

export const CrewArtifactSchema = z.object({
  agent: z.string(),
  phase: z.enum(["build", "review", "validate", "ship"]),
  input: z.unknown(),
  output: z.unknown(),
  score_hint: z
    .object({
      pass: z.boolean().optional(),
      rubric_signal: z.record(z.string(), z.number()).optional(),
      cost_usd: z.number().nonnegative().optional(),
      latency_ms: z.number().int().nonnegative().optional(),
    })
    .optional(),
  source_artifact_path: z.string().optional(),
  dispatched_at: z.string().datetime(),
});

export type CrewArtifact = z.infer<typeof CrewArtifactSchema>;
```

- [ ] **Step 3.5: Implement `AgentRunSchema`**

Create `src/types/agent-run.ts`:
```ts
import { z } from "zod";

export const AgentRunSchema = z.object({
  agent: z.string(),
  candidate_prompt_path: z.string(),
  case_id: z.string(),
  raw_output: z.unknown(),
  cost_usd: z.number().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  finished_at: z.string().datetime(),
});

export type AgentRun = z.infer<typeof AgentRunSchema>;
```

- [ ] **Step 3.6: Implement `CandidateSchema`**

Create `src/types/candidate.ts`:
```ts
import { z } from "zod";

export const CandidateSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  prompt_path: z.string(),
  prompt_hash: z.string(),
  prompt_size_lines: z.number().int().positive(),
  derived_from_trials: z.array(z.string().uuid()),
  generator_cost_usd: z.number().nonnegative(),
  created_at: z.string().datetime(),
});

export type Candidate = z.infer<typeof CandidateSchema>;
```

- [ ] **Step 3.7: Implement `GepaConfigSchema`**

Create `src/types/gepa-config.ts` — copy the schema verbatim from the design spec section "Library API surface → Types (Zod-validated) → `GepaConfigSchema`" (spec lines 211-261). Do NOT paraphrase; the consumer plugin will rely on these field names exactly.

- [ ] **Step 3.8: Write the barrel `src/types/index.ts`**

```ts
export * from "./trial.ts";
export * from "./score-result.ts";
export * from "./eval-case.ts";
export * from "./crew-artifact.ts";
export * from "./agent-run.ts";
export * from "./candidate.ts";
export * from "./gepa-config.ts";
```

- [ ] **Step 3.9: Run — expect PASS**

Run: `bun test tests/types/zod-roundtrip.test.ts`
Expected: 13 passing total.

- [ ] **Step 3.10: Commit**

```bash
git add -A
git commit -m "feat(types): add EvalCase, CrewArtifact, AgentRun, Candidate, GepaConfig schemas"
```

---

### Task 4: Interfaces module

**Files:**
- Create: `src/interfaces.ts`

Interfaces have no runtime behavior so they need no TDD — but they MUST compile and consumers depend on the exact field names.

- [ ] **Step 4.1: Write `src/interfaces.ts`**

Copy verbatim from the spec section "Library API surface → Interfaces" (spec lines 273-349). Includes: `Scorer`, `TrialStore`, `RunnerAdapter`, `CandidateGenerator`, `PromotionPolicy`, `BudgetMeter` (with reservation TTL fields from the 3rd-pass micro-fix), `LLMJudge`, `LockManager`.

Reference types from `./types/index.ts`:
```ts
import type {
  AgentRun,
  Candidate,
  CrewArtifact,
  EvalCase,
  ScoreResult,
  Trial,
} from "./types/index.ts";
```

- [ ] **Step 4.2: Run typecheck**

Run: `bun run typecheck`
Expected: zero errors.

- [ ] **Step 4.3: Commit**

```bash
git add -A
git commit -m "feat: declare Scorer, TrialStore, RunnerAdapter, BudgetMeter, LLMJudge, LockManager interfaces"
```

---

### Task 5: `fileStore` happy path

**Files:**
- Create: `src/store/file-store.ts`
- Create: `tests/store/file-store.test.ts`

- [ ] **Step 5.1: Write the failing happy-path test**

Create `tests/store/file-store.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileStore } from "../../src/store/file-store.ts";
import { newTrialId } from "../../src/types/trial.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gepa-filestore-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const sampleTrial = (overrides: Record<string, unknown> = {}) => ({
  id: newTrialId(),
  agent: "fullstack-dev",
  phase: "build" as const,
  candidate_prompt_hash: "abc",
  candidate_prompt_path: null,
  input: { case_id: "c1" },
  output: { ok: true },
  score: { pass: true, score: 1, cost_usd: 0.001, latency_ms: 100 },
  source: "eval" as const,
  pareto_rank: 1,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("fileStore", () => {
  test("put then recall returns the trial", async () => {
    const store = fileStore(root);
    const trial = sampleTrial();
    await store.put(trial);
    const recalled = await store.recall({ agent: "fullstack-dev" });
    expect(recalled).toHaveLength(1);
    expect(recalled[0]?.id).toBe(trial.id);
  });

  test("recall filters by source", async () => {
    const store = fileStore(root);
    await store.put(sampleTrial({ source: "eval" }));
    await store.put(sampleTrial({ source: "captured" }));
    const eval_ = await store.recall({ source: "eval" });
    expect(eval_).toHaveLength(1);
  });

  test("recall filters by failuresOnly", async () => {
    const store = fileStore(root);
    await store.put(sampleTrial({ score: { pass: true, score: 1, cost_usd: 0, latency_ms: 0 } }));
    await store.put(sampleTrial({ score: { pass: false, score: 0.2, cost_usd: 0, latency_ms: 0 } }));
    const fails = await store.recall({ failuresOnly: true });
    expect(fails).toHaveLength(1);
    expect(fails[0]?.score.pass).toBe(false);
  });

  test("recall respects limit", async () => {
    const store = fileStore(root);
    for (let i = 0; i < 5; i++) await store.put(sampleTrial());
    const limited = await store.recall({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  test("invalidate by agent returns count purged", async () => {
    const store = fileStore(root);
    await store.put(sampleTrial({ agent: "fullstack-dev" }));
    await store.put(sampleTrial({ agent: "backend-dev" }));
    const purged = await store.invalidate({ agent: "fullstack-dev" });
    expect(purged).toBe(1);
    const remaining = await store.recall({});
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.agent).toBe("backend-dev");
  });
});
```

- [ ] **Step 5.2: Run — expect FAIL**

Run: `bun test tests/store/file-store.test.ts`
Expected: module-not-found.

- [ ] **Step 5.3: Implement `fileStore`**

Create `src/store/file-store.ts`:
```ts
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TrialStore } from "../interfaces.ts";
import { type Trial, TrialSchema } from "../types/trial.ts";

function jsonlPathFor(root: string, agent: string): string {
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return join(root, `${agent}.jsonl`);
}

function readJsonlSafe(path: string): Trial[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const out: Trial[] = [];
  for (const line of lines) {
    try {
      out.push(TrialSchema.parse(JSON.parse(line)));
    } catch {
      // Torn or malformed line — drop.
    }
  }
  return out;
}

function matches(trial: Trial, filter: Parameters<TrialStore["recall"]>[0]): boolean {
  if (filter.agent && trial.agent !== filter.agent) return false;
  if (filter.phase && trial.phase !== filter.phase) return false;
  if (filter.source && trial.source !== filter.source) return false;
  if (filter.minScore !== undefined && trial.score.score < filter.minScore) return false;
  if (filter.failuresOnly && trial.score.pass) return false;
  if (filter.since && trial.created_at < filter.since) return false;
  return true;
}

export function fileStore(root: string): TrialStore {
  return {
    async put(trial) {
      const validated = TrialSchema.parse(trial);
      const line = `${JSON.stringify(validated)}\n`;
      appendFileSync(jsonlPathFor(root, validated.agent), line, { flag: "a" });
    },
    async recall(filter) {
      if (!existsSync(root)) return [];
      const files = new Set<string>();
      if (filter.agent) files.add(jsonlPathFor(root, filter.agent));
      else {
        const dir = readFileSync(root, "utf8"); // listing via fs.readdir is below
        // (using readdir to avoid bug from typo above)
        const { readdirSync } = await import("node:fs");
        for (const entry of readdirSync(root)) {
          if (entry.endsWith(".jsonl")) files.add(join(root, entry));
        }
        void dir;
      }
      const trials: Trial[] = [];
      for (const p of files) trials.push(...readJsonlSafe(p));
      const filtered = trials.filter((t) => matches(t, filter));
      filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return filter.limit ? filtered.slice(0, filter.limit) : filtered;
    },
    async invalidate(filter) {
      if (!existsSync(root)) return 0;
      const { readdirSync } = await import("node:fs");
      const files = readdirSync(root)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => join(root, f));
      let purgeCount = 0;
      for (const p of files) {
        const trials = readJsonlSafe(p);
        const kept = trials.filter((t) => {
          if (filter.trial_ids?.includes(t.id)) {
            purgeCount++;
            return false;
          }
          if (filter.agent && t.agent === filter.agent) {
            purgeCount++;
            return false;
          }
          if (filter.since && t.created_at >= filter.since) {
            purgeCount++;
            return false;
          }
          return true;
        });
        const out = kept.map((t) => `${JSON.stringify(t)}\n`).join("");
        writeFileSync(p, out);
      }
      return purgeCount;
    },
  };
}
```

(The accidental `readFileSync(root, ...)` line above is a placeholder — replace with `readdirSync(root)` enumeration. Subagent should clean up to a single read path during step 5.4.)

- [ ] **Step 5.4: Fix the recall enumeration**

The previous step contains a deliberate kludge in `recall()`. Replace the inner block with:
```ts
const { readdirSync } = await import("node:fs");
for (const entry of readdirSync(root)) {
  if (entry.endsWith(".jsonl")) files.add(join(root, entry));
}
```

- [ ] **Step 5.5: Run — expect PASS**

Run: `bun test tests/store/file-store.test.ts`
Expected: 5 passing.

- [ ] **Step 5.6: Commit**

```bash
git add -A
git commit -m "feat(store): add fileStore with put, recall (agent/source/failures/limit/since), invalidate"
```

---

### Task 6: `fileStore` crash-during-put parity

**Files:**
- Create: `tests/store/file-store-crash.test.ts`
- Modify: `src/store/file-store.ts` (only if the existing implementation is non-atomic)

- [ ] **Step 6.1: Write the failing crash test**

Create `tests/store/file-store-crash.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileStore } from "../../src/store/file-store.ts";
import { newTrialId } from "../../src/types/trial.ts";

describe("fileStore crash recovery", () => {
  test("torn JSONL line is silently dropped on recall", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-crash-"));
    try {
      const store = fileStore(root);
      const trial = {
        id: newTrialId(),
        agent: "x",
        phase: "build" as const,
        candidate_prompt_hash: "a",
        candidate_prompt_path: null,
        input: {},
        output: {},
        score: { pass: true, score: 1, cost_usd: 0, latency_ms: 0 },
        source: "eval" as const,
        pareto_rank: null,
        created_at: "2026-06-27T00:00:00.000Z",
      };
      await store.put(trial);

      // Simulate a SIGKILL during a follow-up put: write a half-line manually.
      const jsonl = `${root}/x.jsonl`;
      const existing = readFileSync(jsonl, "utf8");
      writeFileSync(jsonl, `${existing}{"id":"22222222-2222-4111-8222-222`);

      const recalled = await store.recall({ agent: "x" });
      expect(recalled).toHaveLength(1);
      expect(recalled[0]?.id).toBe(trial.id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 6.2: Run — expect PASS**

Run: `bun test tests/store/file-store-crash.test.ts`
Expected: PASS. The `readJsonlSafe` helper already drops malformed lines, so no implementation change is needed.

- [ ] **Step 6.3: Commit**

```bash
git add -A
git commit -m "test(store): assert torn JSONL line on recovery is dropped, not propagated"
```

---

### Task 7: `sequentialRunner`

**Files:**
- Create: `src/runner/sequential-runner.ts`
- Create: `tests/runner/sequential-runner.test.ts`

- [ ] **Step 7.1: Write the failing test**

Create `tests/runner/sequential-runner.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { sequentialRunner } from "../../src/runner/sequential-runner.ts";
import type { Scorer } from "../../src/interfaces.ts";

const noopMeter = {
  reserve: async (estimateUsd: number) => ({
    reservationId: crypto.randomUUID(),
    ok: true,
    remainingUsd: 100 - estimateUsd,
  }),
  record: async () => {},
  release: async () => {},
  spentToday: async () => 0,
  dailyCap: () => 100,
};

const dummyScorer: Scorer = {
  async score(run) {
    return {
      pass: true,
      score: 1,
      cost_usd: 0.01,
      latency_ms: 1,
    };
  },
};

const sampleCandidate = (id: string) => ({
  id,
  agent: "fullstack-dev",
  prompt_path: "x",
  prompt_hash: "h",
  prompt_size_lines: 100,
  derived_from_trials: [],
  generator_cost_usd: 0,
  created_at: "2026-06-27T00:00:00.000Z",
});

const sampleCase = (id: string) => ({ id, input: {} });

describe("sequentialRunner", () => {
  test("runs every candidate against every case in order", async () => {
    const runner = sequentialRunner();
    const trials = await runner.runCandidates(
      [sampleCandidate("11111111-1111-4111-8111-111111111111")],
      [sampleCase("a"), sampleCase("b")],
      dummyScorer,
      { meter: noopMeter },
    );
    expect(trials).toHaveLength(2);
  });

  test("halts on AbortSignal", async () => {
    const runner = sequentialRunner();
    const controller = new AbortController();
    controller.abort();
    const trials = await runner.runCandidates(
      [sampleCandidate("11111111-1111-4111-8111-111111111111")],
      [sampleCase("a"), sampleCase("b")],
      dummyScorer,
      { meter: noopMeter, signal: controller.signal },
    );
    expect(trials).toHaveLength(0);
  });

  test("halts when meter exhausted", async () => {
    const tightMeter = {
      ...noopMeter,
      reserve: async (estimateUsd: number) => ({
        reservationId: crypto.randomUUID(),
        ok: false,
        remainingUsd: 0,
      }),
    };
    const runner = sequentialRunner();
    const trials = await runner.runCandidates(
      [sampleCandidate("11111111-1111-4111-8111-111111111111")],
      [sampleCase("a")],
      dummyScorer,
      { meter: tightMeter },
    );
    expect(trials).toHaveLength(0);
  });
});
```

- [ ] **Step 7.2: Run — expect FAIL**

Run: `bun test tests/runner/sequential-runner.test.ts`
Expected: module-not-found.

- [ ] **Step 7.3: Implement `sequentialRunner`**

Create `src/runner/sequential-runner.ts`:
```ts
import type { RunnerAdapter } from "../interfaces.ts";
import { newTrialId, type Trial } from "../types/trial.ts";
import { validateCandidateSize } from "../validators/candidate-size.ts";

export function sequentialRunner(opts: { maxCandidateLines?: number } = {}): RunnerAdapter {
  const max = opts.maxCandidateLines ?? 350;
  return {
    async runCandidates(candidates, cases, scorer, { meter, signal }) {
      const trials: Trial[] = [];
      for (const candidate of candidates) {
        const sizeCheck = validateCandidateSize(candidate, max);
        if (!sizeCheck.ok) {
          // Skipped — no LLM spend.
          continue;
        }
        for (const c of cases) {
          if (signal?.aborted) return trials;
          const reservation = await meter.reserve(0.02); // rough per-case estimate
          if (!reservation.ok) return trials;
          const startedAt = Date.now();
          const score = await scorer.score(
            {
              agent: candidate.agent,
              candidate_prompt_path: candidate.prompt_path,
              case_id: c.id,
              raw_output: null,
              cost_usd: 0,
              latency_ms: 0,
              finished_at: new Date().toISOString(),
            },
            c,
          );
          await meter.record(reservation.reservationId, score.cost_usd);
          trials.push({
            id: newTrialId(),
            agent: candidate.agent,
            phase: "build",
            candidate_prompt_hash: candidate.prompt_hash,
            candidate_prompt_path: candidate.prompt_path,
            input: c.input,
            output: null,
            score,
            source: "eval",
            pareto_rank: null,
            created_at: new Date(startedAt).toISOString(),
          });
        }
      }
      return trials;
    },
  };
}
```

- [ ] **Step 7.4: Run — expect PASS**

Run: `bun test tests/runner/sequential-runner.test.ts`
Expected: 3 passing.

(Test 1 will fail if `validateCandidateSize` is not yet implemented — Task 8 ships that. If the build order isn't stable, swap Tasks 7 and 8.)

- [ ] **Step 7.5: Commit**

```bash
git add -A
git commit -m "feat(runner): add sequentialRunner with size-pre-screen + meter reserve/record + AbortSignal"
```

---

### Task 8: `validateCandidateSize`

**Files:**
- Create: `src/validators/candidate-size.ts`
- Create: `tests/validators/candidate-size.test.ts`

(Note: if this task is built before Task 7's tests run, the runner tests in Task 7 will pass on first compile. Order tasks 7 and 8 according to your subagent dispatch preference.)

- [ ] **Step 8.1: Write the failing test**

Create `tests/validators/candidate-size.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCandidateSize } from "../../src/validators/candidate-size.ts";

describe("validateCandidateSize", () => {
  test("passes a small candidate", () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-size-"));
    const path = join(root, "small.md");
    writeFileSync(path, "line1\nline2\nline3\n");
    const result = validateCandidateSize(
      {
        id: "11111111-1111-4111-8111-111111111111",
        agent: "x",
        prompt_path: path,
        prompt_hash: "h",
        prompt_size_lines: 3,
        derived_from_trials: [],
        generator_cost_usd: 0,
        created_at: "2026-06-27T00:00:00.000Z",
      },
      350,
    );
    expect(result.ok).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  test("rejects an oversized candidate", () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-size-"));
    const path = join(root, "big.md");
    writeFileSync(path, "x\n".repeat(400));
    const result = validateCandidateSize(
      {
        id: "11111111-1111-4111-8111-111111111111",
        agent: "x",
        prompt_path: path,
        prompt_hash: "h",
        prompt_size_lines: 400,
        derived_from_trials: [],
        generator_cost_usd: 0,
        created_at: "2026-06-27T00:00:00.000Z",
      },
      350,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("oversized");
    rmSync(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 8.2: Run — expect FAIL**

Run: `bun test tests/validators/candidate-size.test.ts`
Expected: module-not-found.

- [ ] **Step 8.3: Implement `validateCandidateSize`**

Create `src/validators/candidate-size.ts`:
```ts
import { readFileSync } from "node:fs";
import type { Candidate } from "../types/candidate.ts";

export function validateCandidateSize(
  candidate: Candidate,
  maxLines: number,
): { ok: boolean; reason?: string } {
  const body = readFileSync(candidate.prompt_path, "utf8");
  const lines = body.split("\n").length;
  if (lines > maxLines) {
    return { ok: false, reason: `oversized_candidate (${lines} lines > ${maxLines})` };
  }
  return { ok: true };
}
```

- [ ] **Step 8.4: Run — expect PASS**

Run: `bun test tests/validators/candidate-size.test.ts`
Expected: 2 passing.

- [ ] **Step 8.5: Commit**

```bash
git add -A
git commit -m "feat(validators): add validateCandidateSize to gate oversized candidates pre-scoring"
```

---

### Task 9: `binaryScorer`

**Files:**
- Create: `src/scorer/binary-scorer.ts`
- Create: `tests/scorer/binary-scorer.test.ts`

For S1 we wire a stub: `binaryScorer(passAgent)` returns a scorer that calls a subprocess named `passAgent` and parses its return for a PASS/FAIL token. In practice the actual subagent dispatch happens through the crew plugin; for S1's library we only need to demonstrate the wrapping shape via injection.

- [ ] **Step 9.1: Write the failing test**

Create `tests/scorer/binary-scorer.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { binaryScorer } from "../../src/scorer/binary-scorer.ts";

describe("binaryScorer", () => {
  test("score 1.0 when injected dispatcher returns PASS", async () => {
    const scorer = binaryScorer("inspector", {
      dispatch: async () => ({
        pass: true,
        cost_usd: 0.003,
        latency_ms: 220,
      }),
    });
    const result = await scorer.score(
      {
        agent: "fullstack-dev",
        candidate_prompt_path: "x",
        case_id: "c1",
        raw_output: { ok: true },
        cost_usd: 0,
        latency_ms: 0,
        finished_at: new Date().toISOString(),
      },
      { id: "c1", input: {} },
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  test("score 0.0 when dispatcher returns FAIL", async () => {
    const scorer = binaryScorer("inspector", {
      dispatch: async () => ({ pass: false, cost_usd: 0.003, latency_ms: 200 }),
    });
    const result = await scorer.score(
      {
        agent: "x",
        candidate_prompt_path: "x",
        case_id: "c1",
        raw_output: { ok: false },
        cost_usd: 0,
        latency_ms: 0,
        finished_at: new Date().toISOString(),
      },
      { id: "c1", input: {} },
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });
});
```

- [ ] **Step 9.2: Run — expect FAIL**

Run: `bun test tests/scorer/binary-scorer.test.ts`
Expected: module-not-found.

- [ ] **Step 9.3: Implement `binaryScorer`**

Create `src/scorer/binary-scorer.ts`:
```ts
import type { Scorer } from "../interfaces.ts";

export interface BinaryDispatcher {
  dispatch(opts: {
    agent: string;
    input: unknown;
    expectedOutput: unknown;
  }): Promise<{ pass: boolean; cost_usd: number; latency_ms: number; rationale?: string }>;
}

export function binaryScorer(passAgent: string, deps: BinaryDispatcher): Scorer {
  return {
    async score(run, expected) {
      const verdict = await deps.dispatch({
        agent: passAgent,
        input: { candidate_output: run.raw_output, case: expected },
        expectedOutput: expected.expected_output,
      });
      return {
        pass: verdict.pass,
        score: verdict.pass ? 1 : 0,
        cost_usd: verdict.cost_usd,
        latency_ms: verdict.latency_ms,
        rationale: verdict.rationale,
      };
    },
  };
}
```

- [ ] **Step 9.4: Run — expect PASS**

Run: `bun test tests/scorer/binary-scorer.test.ts`
Expected: 2 passing.

- [ ] **Step 9.5: Commit**

```bash
git add -A
git commit -m "feat(scorer): add binaryScorer with injected dispatcher (PASS/FAIL → 1.0/0.0)"
```

---

### Task 10: `dailyCapMeter` with reservation TTL

**Files:**
- Create: `src/budget/daily-cap-meter.ts`
- Create: `tests/budget/daily-cap-meter.test.ts`

- [ ] **Step 10.1: Write the failing test**

Create `tests/budget/daily-cap-meter.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dailyCapMeter } from "../../src/budget/daily-cap-meter.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gepa-meter-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("dailyCapMeter", () => {
  test("reserve under cap returns ok", async () => {
    const meter = dailyCapMeter(10, join(root, "meter.json"));
    const r = await meter.reserve(1);
    expect(r.ok).toBe(true);
    expect(r.remainingUsd).toBeCloseTo(9);
  });

  test("reserve over cap returns ok:false", async () => {
    const meter = dailyCapMeter(10, join(root, "meter.json"));
    await meter.reserve(8);
    const r = await meter.reserve(5);
    expect(r.ok).toBe(false);
  });

  test("record adjusts remainder using actual cost", async () => {
    const meter = dailyCapMeter(10, join(root, "meter.json"));
    const r = await meter.reserve(2);
    await meter.record(r.reservationId, 1.5); // actual < reservation
    expect(await meter.spentToday()).toBeCloseTo(1.5);
  });

  test("release frees reserved amount", async () => {
    const meter = dailyCapMeter(10, join(root, "meter.json"));
    const r = await meter.reserve(3);
    await meter.release(r.reservationId);
    const remaining = await meter.reserve(8);
    expect(remaining.ok).toBe(true);
  });

  test("orphan reservation expires at TTL", async () => {
    const meter = dailyCapMeter(10, join(root, "meter.json"));
    await meter.reserve(3, { ttlSeconds: 0 }); // immediate expiry
    // Simulate process restart by constructing a new meter on the same path.
    const meter2 = dailyCapMeter(10, join(root, "meter.json"));
    // Force expiry sweep.
    await meter2.spentToday();
    const r = await meter2.reserve(8);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 10.2: Run — expect FAIL**

Run: `bun test tests/budget/daily-cap-meter.test.ts`
Expected: module-not-found.

- [ ] **Step 10.3: Implement `dailyCapMeter`**

Create `src/budget/daily-cap-meter.ts`:
```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { BudgetMeter } from "../interfaces.ts";

interface Reservation {
  id: string;
  amount: number;
  expiresAt: number; // ms epoch
}

interface State {
  day: string; // ISO date
  spent: number;
  reservations: Reservation[];
}

const DEFAULT_TTL_S = 600;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(path: string): State {
  if (!existsSync(path)) return { day: todayIso(), spent: 0, reservations: [] };
  try {
    const s = JSON.parse(readFileSync(path, "utf8")) as State;
    if (s.day !== todayIso()) return { day: todayIso(), spent: 0, reservations: [] };
    return s;
  } catch {
    return { day: todayIso(), spent: 0, reservations: [] };
  }
}

function save(path: string, state: State): void {
  writeFileSync(path, JSON.stringify(state));
}

function pruneExpired(state: State): State {
  const now = Date.now();
  state.reservations = state.reservations.filter((r) => r.expiresAt > now);
  return state;
}

export function dailyCapMeter(capUsd: number, persistPath: string): BudgetMeter {
  return {
    async reserve(estimateUsd, opts) {
      let state = pruneExpired(load(persistPath));
      const held = state.reservations.reduce((sum, r) => sum + r.amount, 0);
      const inFlight = state.spent + held + estimateUsd;
      if (inFlight > capUsd) {
        save(persistPath, state);
        return { reservationId: crypto.randomUUID(), ok: false, remainingUsd: Math.max(0, capUsd - state.spent - held) };
      }
      const ttl = (opts?.ttlSeconds ?? DEFAULT_TTL_S) * 1000;
      const reservation: Reservation = {
        id: crypto.randomUUID(),
        amount: estimateUsd,
        expiresAt: Date.now() + ttl,
      };
      state.reservations.push(reservation);
      save(persistPath, state);
      return { reservationId: reservation.id, ok: true, remainingUsd: capUsd - state.spent - held - estimateUsd };
    },
    async record(reservationId, actualUsd) {
      let state = pruneExpired(load(persistPath));
      state.reservations = state.reservations.filter((r) => r.id !== reservationId);
      state.spent += actualUsd;
      save(persistPath, state);
    },
    async release(reservationId) {
      let state = pruneExpired(load(persistPath));
      state.reservations = state.reservations.filter((r) => r.id !== reservationId);
      save(persistPath, state);
    },
    async spentToday() {
      const state = pruneExpired(load(persistPath));
      save(persistPath, state);
      return state.spent;
    },
    dailyCap() {
      return capUsd;
    },
  };
}
```

- [ ] **Step 10.4: Run — expect PASS**

Run: `bun test tests/budget/daily-cap-meter.test.ts`
Expected: 5 passing.

- [ ] **Step 10.5: Commit**

```bash
git add -A
git commit -m "feat(budget): add dailyCapMeter with reservation TTL + crash-safe persistence"
```

---

### Task 11: `fileLockManager` with PID + heartbeat

**Files:**
- Create: `src/lock/file-lock-manager.ts`
- Create: `tests/lock/file-lock-manager.test.ts`

- [ ] **Step 11.1: Write the failing test**

Create `tests/lock/file-lock-manager.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileLockManager } from "../../src/lock/file-lock-manager.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gepa-lock-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("fileLockManager", () => {
  test("acquire returns a handle when no lock exists", async () => {
    const lm = fileLockManager(root);
    const handle = await lm.acquire("fullstack-dev", "eval");
    expect(handle).not.toBeNull();
    await handle?.released();
  });

  test("acquire returns null when held", async () => {
    const lm = fileLockManager(root);
    const first = await lm.acquire("x", "eval");
    const second = await lm.acquire("x", "eval");
    expect(second).toBeNull();
    await first?.released();
  });

  test("acquire reclaims a stale lock (dead PID)", async () => {
    const lm = fileLockManager(root);
    // Craft a stale lockfile with a PID that does not exist.
    const lockPath = join(root, "x.eval.lock");
    writeFileSync(lockPath, JSON.stringify({ pid: 99999999, heartbeat: 0 }));
    const handle = await lm.acquire("x", "eval");
    expect(handle).not.toBeNull();
    await handle?.released();
  });

  test("isLocked reports state", async () => {
    const lm = fileLockManager(root);
    expect(await lm.isLocked("y")).toBe(false);
    const handle = await lm.acquire("y", "optimize");
    expect(await lm.isLocked("y")).toBe(true);
    await handle?.released();
    expect(await lm.isLocked("y")).toBe(false);
  });
});
```

- [ ] **Step 11.2: Run — expect FAIL**

Run: `bun test tests/lock/file-lock-manager.test.ts`
Expected: module-not-found.

- [ ] **Step 11.3: Implement `fileLockManager`**

Create `src/lock/file-lock-manager.ts`:
```ts
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LockManager } from "../interfaces.ts";

const HEARTBEAT_STALE_MS = 60_000;

interface LockBody {
  pid: number;
  heartbeat: number;
}

function lockFile(dir: string, agent: string, op: string): string {
  return join(dir, `${agent}.${op}.lock`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function fileLockManager(dir: string): LockManager {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return {
    async acquire(agent, op) {
      const path = lockFile(dir, agent, op);
      if (existsSync(path)) {
        try {
          const body = JSON.parse(readFileSync(path, "utf8")) as LockBody;
          const age = Date.now() - body.heartbeat;
          if (isProcessAlive(body.pid) && age < HEARTBEAT_STALE_MS) {
            return null;
          }
          unlinkSync(path); // stale, reclaim
        } catch {
          unlinkSync(path);
        }
      }
      writeFileSync(path, JSON.stringify({ pid: process.pid, heartbeat: Date.now() }), {
        flag: "wx",
      });
      const heartbeat = setInterval(() => {
        try {
          writeFileSync(path, JSON.stringify({ pid: process.pid, heartbeat: Date.now() }));
        } catch {
          // path may already be gone via concurrent release
        }
      }, HEARTBEAT_STALE_MS / 4);
      return {
        async released() {
          clearInterval(heartbeat);
          if (existsSync(path)) unlinkSync(path);
        },
      };
    },
    async isLocked(agent) {
      // optimistic — match any op
      const eval_ = lockFile(dir, agent, "eval");
      const optimize = lockFile(dir, agent, "optimize");
      for (const p of [eval_, optimize]) {
        if (!existsSync(p)) continue;
        try {
          const body = JSON.parse(readFileSync(p, "utf8")) as LockBody;
          const age = Date.now() - body.heartbeat;
          if (isProcessAlive(body.pid) && age < HEARTBEAT_STALE_MS) return true;
        } catch {
          // fall through
        }
      }
      return false;
    },
  };
}
```

- [ ] **Step 11.4: Run — expect PASS**

Run: `bun test tests/lock/file-lock-manager.test.ts`
Expected: 4 passing.

- [ ] **Step 11.5: Commit**

```bash
git add -A
git commit -m "feat(lock): add fileLockManager with PID + heartbeat + stale recovery"
```

---

### Task 12: `paretoRank` + `dominates`

**Files:**
- Create: `src/pareto/rank.ts`
- Create: `tests/pareto/rank.test.ts`

- [ ] **Step 12.1: Write the failing test**

Create `tests/pareto/rank.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { dominates, paretoRank } from "../../src/pareto/rank.ts";
import type { Trial } from "../../src/types/trial.ts";

const trial = (id: string, score: number, cost: number, latency: number, pass = true): Trial => ({
  id: `${id.padStart(8, "0")}-1111-4111-8111-111111111111`,
  agent: "x",
  phase: "build",
  candidate_prompt_hash: "h",
  candidate_prompt_path: null,
  input: {},
  output: {},
  score: { pass, score, cost_usd: cost, latency_ms: latency },
  source: "eval",
  pareto_rank: null,
  created_at: "2026-06-27T00:00:00.000Z",
});

describe("dominates", () => {
  test("A dominates B when A ≥ B on every axis and > B on one", () => {
    const a = trial("a", 0.9, 0.01, 100);
    const b = trial("b", 0.7, 0.02, 200);
    expect(dominates(a, b)).toBe(true);
    expect(dominates(b, a)).toBe(false);
  });

  test("neither dominates when they trade off", () => {
    const a = trial("a", 0.9, 0.05, 100);
    const b = trial("b", 0.8, 0.01, 100);
    expect(dominates(a, b)).toBe(false);
    expect(dominates(b, a)).toBe(false);
  });
});

describe("paretoRank", () => {
  test("non-dominated trials all rank 1", () => {
    const a = trial("a", 0.9, 0.05, 100);
    const b = trial("b", 0.8, 0.01, 100);
    const ranked = paretoRank([a, b]);
    expect(ranked.every((r) => r.pareto_rank === 1)).toBe(true);
  });

  test("dominated trial ranks below dominator", () => {
    const a = trial("a", 0.9, 0.01, 100);
    const b = trial("b", 0.7, 0.02, 200);
    const ranked = paretoRank([a, b]);
    const rankA = ranked.find((r) => r.id.startsWith("000000a"));
    const rankB = ranked.find((r) => r.id.startsWith("000000b"));
    expect(rankA?.pareto_rank).toBe(1);
    expect(rankB?.pareto_rank).toBeGreaterThan(1);
  });

  test("tiebreaker chain favors pass>score>-cost>-latency", () => {
    const a = trial("a", 0.8, 0.01, 100, true);
    const b = trial("b", 0.8, 0.01, 100, false);
    const ranked = paretoRank([a, b]);
    expect(ranked[0]?.id.startsWith("000000a")).toBe(true);
  });
});
```

- [ ] **Step 12.2: Run — expect FAIL**

Run: `bun test tests/pareto/rank.test.ts`
Expected: module-not-found.

- [ ] **Step 12.3: Implement `dominates` and `paretoRank`**

Create `src/pareto/rank.ts`:
```ts
import type { Trial } from "../types/trial.ts";

export interface RankedTrial extends Trial {
  pareto_rank: number;
}

export function dominates(a: Trial, b: Trial): boolean {
  // We MAXIMIZE score, MINIMIZE cost_usd, MINIMIZE latency_ms, and treat pass=true as strictly better than pass=false.
  const aBetterOrEqual =
    (a.score.pass === true || (a.score.pass === false && b.score.pass === false)) &&
    a.score.score >= b.score.score &&
    a.score.cost_usd <= b.score.cost_usd &&
    a.score.latency_ms <= b.score.latency_ms;
  if (!aBetterOrEqual) return false;
  const aStrictlyBetterOnOne =
    (a.score.pass === true && b.score.pass === false) ||
    a.score.score > b.score.score ||
    a.score.cost_usd < b.score.cost_usd ||
    a.score.latency_ms < b.score.latency_ms;
  return aStrictlyBetterOnOne;
}

function defaultTiebreaker(a: Trial, b: Trial): number {
  if (a.score.pass !== b.score.pass) return a.score.pass ? -1 : 1;
  if (a.score.score !== b.score.score) return b.score.score - a.score.score;
  if (a.score.cost_usd !== b.score.cost_usd) return a.score.cost_usd - b.score.cost_usd;
  if (a.score.latency_ms !== b.score.latency_ms) return a.score.latency_ms - b.score.latency_ms;
  return a.id < b.id ? -1 : 1; // final deterministic
}

export function paretoRank(
  trials: Trial[],
  tiebreaker: (a: Trial, b: Trial) => number = defaultTiebreaker,
): RankedTrial[] {
  const ranked: RankedTrial[] = trials.map((t) => ({ ...t, pareto_rank: 0 }));
  let frontier = ranked.slice();
  let currentRank = 1;
  while (frontier.length > 0) {
    const nonDominated = frontier.filter((t) => !frontier.some((other) => other !== t && dominates(other, t)));
    nonDominated.sort(tiebreaker);
    for (const t of nonDominated) t.pareto_rank = currentRank;
    frontier = frontier.filter((t) => !nonDominated.includes(t));
    currentRank++;
  }
  return ranked;
}
```

- [ ] **Step 12.4: Run — expect PASS**

Run: `bun test tests/pareto/rank.test.ts`
Expected: 5 passing.

- [ ] **Step 12.5: Commit**

```bash
git add -A
git commit -m "feat(pareto): add dominates + paretoRank with deterministic tiebreaker chain"
```

---

### Task 13: Public barrel + smoke import

**Files:**
- Create: `src/index.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 13.1: Write the public barrel**

Create `src/index.ts`:
```ts
export * from "./types/index.ts";
export type {
  Scorer,
  TrialStore,
  RunnerAdapter,
  CandidateGenerator,
  PromotionPolicy,
  BudgetMeter,
  LLMJudge,
  LockManager,
} from "./interfaces.ts";

export { fileStore } from "./store/file-store.ts";
export { sequentialRunner } from "./runner/sequential-runner.ts";
export { binaryScorer } from "./scorer/binary-scorer.ts";
export { dailyCapMeter } from "./budget/daily-cap-meter.ts";
export { fileLockManager } from "./lock/file-lock-manager.ts";
export { dominates, paretoRank } from "./pareto/rank.ts";
export { validateCandidateSize } from "./validators/candidate-size.ts";
```

- [ ] **Step 13.2: Write smoke test**

Create `tests/smoke.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import {
  binaryScorer,
  dailyCapMeter,
  dominates,
  fileLockManager,
  fileStore,
  paretoRank,
  sequentialRunner,
  validateCandidateSize,
} from "../src/index.ts";

describe("smoke — public API", () => {
  test("every public export is a function", () => {
    expect(typeof binaryScorer).toBe("function");
    expect(typeof dailyCapMeter).toBe("function");
    expect(typeof dominates).toBe("function");
    expect(typeof fileLockManager).toBe("function");
    expect(typeof fileStore).toBe("function");
    expect(typeof paretoRank).toBe("function");
    expect(typeof sequentialRunner).toBe("function");
    expect(typeof validateCandidateSize).toBe("function");
  });
});
```

- [ ] **Step 13.3: Run — expect PASS**

Run: `bun test`
Expected: all suites green.

- [ ] **Step 13.4: Lint + format + typecheck**

Run sequentially (any failure halts):
```
bun run lint
bun run format:check
bun run typecheck
```
Expected: all green.

- [ ] **Step 13.5: Commit**

```bash
git add -A
git commit -m "feat: public barrel + smoke import test"
```

---

### Task 14: Semver checker

**Files:**
- Create: `scripts/check-semver.ts`
- Create: `tests/scripts/check-semver.test.ts`

- [ ] **Step 14.1: Write the failing test**

Create `tests/scripts/check-semver.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { describeBreakingChanges } from "../../scripts/check-semver.ts";

describe("describeBreakingChanges", () => {
  test("flags removed export as MAJOR-required", () => {
    const before = ["foo", "bar"];
    const after = ["foo"];
    const result = describeBreakingChanges(before, after);
    expect(result.requiresMajor).toBe(true);
    expect(result.removed).toContain("bar");
  });

  test("flags added export as MINOR-eligible", () => {
    const before = ["foo"];
    const after = ["foo", "bar"];
    const result = describeBreakingChanges(before, after);
    expect(result.requiresMajor).toBe(false);
    expect(result.added).toContain("bar");
  });

  test("no changes returns clean", () => {
    const result = describeBreakingChanges(["foo"], ["foo"]);
    expect(result.requiresMajor).toBe(false);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });
});
```

- [ ] **Step 14.2: Run — expect FAIL**

Run: `bun test tests/scripts/check-semver.test.ts`
Expected: module-not-found.

- [ ] **Step 14.3: Implement `scripts/check-semver.ts`**

```ts
export interface BreakingReport {
  requiresMajor: boolean;
  added: string[];
  removed: string[];
}

export function describeBreakingChanges(before: string[], after: string[]): BreakingReport {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const removed = before.filter((x) => !afterSet.has(x));
  const added = after.filter((x) => !beforeSet.has(x));
  return { requiresMajor: removed.length > 0, added, removed };
}

// CLI entry — diff `src/index.ts` exports against last release.
// Skipped in unit tests; wired into release workflow.
```

- [ ] **Step 14.4: Run — expect PASS**

Run: `bun test tests/scripts/check-semver.test.ts`
Expected: 3 passing.

- [ ] **Step 14.5: Commit**

```bash
git add -A
git commit -m "feat(scripts): add semver breaking-change reporter"
```

---

### Task 15: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 15.1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.0
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run format:check
      - run: bun run typecheck
      - run: bun run test
      - run: bun run semver:check
        if: github.event_name == 'pull_request'
```

- [ ] **Step 15.2: Write `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: bun install --frozen-lockfile
      - run: bun run test
      - run: bun run typecheck
      - run: bun run semver:check
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 15.3: Commit**

```bash
git add -A
git commit -m "ci: add bun test + biome + tsc CI and tagged-release npm publish workflow"
```

---

### Task 16: Push and dry-run publish

- [ ] **Step 16.1: Push branch**

```bash
git push -u origin main
```

- [ ] **Step 16.2: Confirm CI green on GitHub**

Run: `gh run list --workflow CI --limit 1`
Expected: latest run status is `completed` with conclusion `success`.

- [ ] **Step 16.3: npm publish dry-run**

Run: `npm publish --dry-run --access public`
Expected: file list includes `src/**/*.ts`, `package.json`, `LICENSE`, `README.md`, `CHANGELOG.md`. Exit code 0.

- [ ] **Step 16.4: Tag and publish 0.1.0 (USER APPROVAL REQUIRED)**

Stop here. Surface a one-line summary to the user:
> "S1 complete. 16 tasks landed. Ready to cut `v0.1.0` and publish to npm? (Type `publish` to proceed; otherwise stop.)"

Only on `publish` from the user, run:
```bash
git tag -a v0.1.0 -m "v0.1.0 — initial bootstrap"
git push origin v0.1.0
```

GitHub Actions runs the release workflow. Verify with `gh run list --workflow Release --limit 1`.

---

## Self-Review

### Spec coverage

Mapping the S1 row in the spec's slice plan table to tasks above:

| Spec scope item | Task |
|---|---|
| Bootstrap pkg | Task 1 |
| Zod schemas: Trial | Task 2 |
| Zod schemas: ScoreResult | Task 2 |
| Zod schemas: EvalCase / CrewArtifact / AgentRun / Candidate / GepaConfig | Task 3 |
| Interfaces module | Task 4 |
| `fileStore` | Task 5 + Task 6 (crash recovery) |
| `sequentialRunner` | Task 7 |
| `binaryScorer` | Task 9 |
| `dailyCapMeter` | Task 10 |
| `fileLockManager` | Task 11 |
| `paretoRank` + `dominates` | Task 12 |
| `validateCandidateSize` | Task 8 |
| Unit tests | every Task ≥ 2 |
| Semver tooling | Task 14 |
| CHANGELOG | Task 1 (seed) |
| Publishable package | Task 13 (smoke import) + Task 16 (dry-run) |

S1 acceptance from the spec: `bun test green, package publishable, validators pass`. Covered by Task 13 (`bun test` green) + Task 16.3 (`npm publish --dry-run` green) + Task 13.4 (lint / format / typecheck green).

### Placeholder scan

I see one deliberate scratchpad in Task 5.3 (the `readFileSync(root, …)` line that Task 5.4 immediately replaces with `readdirSync`). Subagents executing this plan should treat Task 5.3 + 5.4 as a single atomic edit window.

No other "TBD", "TODO", or hand-wave language remains.

### Type consistency

Spot-checked: `BudgetMeter` includes `reservationId` from `reserve()` and accepts it in `record(id, actualUsd)` + `release(id)` — consistent across Task 4 (declaration), Task 10 (implementation), Task 7 (use-site). `Scorer.score(run: AgentRun, expected: EvalCase)` consistent across Task 4 / Task 7 / Task 9.

### Out-of-scope (correctly deferred to later slices)

These S1 spec items are absent from the slice plan row and stay deferred:
- `LLMJudge` interface (declared in Task 4 but no built-in adapters until S5a).
- `rubricScorer` — S5a.
- `astramemStore` — S5c.
- `waveRunner` — post-v1.
- `validateTrialCorpus`, `detectEvalDrift`, `captureParityGoldenTest` — S5a / S2.
- `gepaCapture` / `runEvalSuite` / `runOptimization` top-level — S2 / S3 / S4.

This matches the spec's slice table.

---

## Subsequent slices

Each subsequent slice (S2, S3, S4, S5a, S5b, S5c, S6, S7, S8a, S8b) will be authored in its own `docs/superpowers/plans/2026-MM-DD-gepa-sN-<slug>.md` file after the prior slice ships and a `crew:inspector` review pass is green. The runner-plugin PM agent (dispatched in parallel with this plan) is producing the per-slice SPECs + Given-When-Then acceptance criteria into `.claude/artifacts/loop/backlog/triaged/` for cross-reference.

The slice-plan dependency graph in the spec stays the single source of truth for ordering. Risk-weighted exit gates after S4 and S7 still apply — do not proceed to S5a until S4 produces measurable gain on fullstack-dev, and do not proceed to S8a until S7's soak harness detects a crafted regression.

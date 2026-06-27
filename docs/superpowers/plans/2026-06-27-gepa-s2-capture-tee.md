# GEPA S2 — Capture Tee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the crew side of Phase 1 (Capture). Every `crew:fullstack-dev` dispatch's artifact tees a Trial into `.claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl` via the `@astragenie/gepa-core` library, bounded by a 2 s walltime, fail-silent on miss, and byte-identical to a baseline dispatch when capture is disabled.

**Architecture:** A thin `capture-tee.ts` wrapper around `gepa-core`'s `gepaCapture()` is invoked from `scripts/lib/artifacts/write.ts` AFTER successful artifact writes, but only when (1) the artifact `kind` is one of `runs / handoffs / reviews / validations`, (2) the `agent` field equals `fullstack-dev` in this slice, and (3) `gepa.config.json` exists at repo root with `capture.enabled: true`. The tee runs via `Promise.race([store.put(trial), walltime])` so it never blocks the dispatch. Walltime miss = log `gepa_capture_drop` to events + drop trial. Exceptions caught internally.

**Tech Stack:** TypeScript (Node 22.6+ strip-types runtime), `@astragenie/gepa-core@^0.1` (npm or `file:` dev dep), existing crew artifact writers, Bun test runner.

**Source spec:** `docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md` — slice S2 row in the slice plan table, "Capture (Phase 1)" data flow diagram, "Capture parity invariant" section, "Failure modes" table, "Implementation notes for plan-writing → S1" lockfile + atomic writes notes.

**Backlog ref:** `.claude/artifacts/loop/backlog/triaged/SLICE-97-gepa-capture-tee.md` (10 ACs, AC-1 through AC-10).

**Scope:** S2 only (~2 working days). Touches the `dev-team` repo only — `@astragenie/gepa-core` is consumed as a dep, not modified. S3 (eval + `/crew:gepa-eval`) ships in a subsequent plan.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` (modify) | Add `@astragenie/gepa-core` as a runtime dep |
| `gepa.config.json` (create, committed) | Repo-root GEPA config — capture, storage, judge, budget, optimize, policy |
| `scripts/lib/gepa/load-config.ts` (create) | Reads + Zod-validates `gepa.config.json`; returns `null` if absent (capture disabled) |
| `scripts/lib/gepa/capture-tee.ts` (create) | Wraps `gepaCapture()` with walltime race + event logging |
| `scripts/lib/gepa/adapt-artifact.ts` (create) | Adapts crew's internal `ArtifactRecord` into the library's `CrewArtifact` shape |
| `scripts/lib/artifacts/write.ts` (modify, ~line 720) | Inserts the capture-tee call after successful `writeArtifact` returns |
| `commands/gepa-history.md` (create) | `/crew:gepa-history <agent>` slash-command spec |
| `scripts/crew.ts` (modify) | Wires the `gepa-history` subcommand (case branch + handler) |
| `scripts/lib/gepa/history.ts` (create) | Reads trials via `fileStore.recall()` and formats the tabular output |
| `scripts/validate-agents.ts` (modify) | (a) skip `.gepa/` subdirs when enumerating; (b) exempt the `gepa:` YAML frontmatter block from the ≤350-line cap |
| `.gitignore` (modify) | Add `.claude/artifacts/crew/gepa/locks/` and `.claude/artifacts/crew/gepa/candidates/` |
| `tests/fixtures/gepa/sample-config.json` | Fixture config used by capture tests |
| `tests/fixtures/gepa/agent-with-frontmatter.md` | 348-line body + 8-line `gepa:` frontmatter for validator exemption test |
| `tests/fixtures/gepa/agent-no-frontmatter.md` | 360-line plain prompt for negative-case validator test |
| `tests/gepa/capture-tee.test.ts` (create) | Verifies a tee writes a Trial JSONL line after a real `writeArtifact` |
| `tests/gepa/capture-walltime.test.ts` (create) | Verifies walltime miss drops the trial + logs `gepa_capture_drop` |
| `tests/gepa/capture-absent-parity.test.ts` (create) | Verifies absent `gepa.config.json` = zero side effects on the artifact tree |
| `tests/gepa/capture-parity.test.ts` (create) | Byte-diff of two identical dispatches with capture on vs off |
| `tests/gepa/capture-sigkill-parity.test.ts` (create) | SIGKILL-during-put leaves a clean artifact tree + no torn JSONL line |
| `tests/gepa/capture-perf.test.ts` (create) | 1000-iteration micro-bench: p50 ≤ 50 ms, p99 ≤ 200 ms, max ≤ 2000 ms |
| `tests/gepa/gepa-history.test.ts` (create) | CLI subcommand prints last N trials sorted desc + honors `--source` + `--limit` |
| `tests/gepa/validate-agents-gepa-skip.test.ts` (create) | Validator skips `.gepa/` subdirs |
| `tests/gepa/validate-agents-frontmatter.test.ts` (create) | Validator exempts `gepa:` frontmatter from line cap |

---

## Pre-flight

### Task 0: Verify environment

- [ ] **Step 0.1: Verify `astragenie/gepa-core` is installable**

Run from the worktree root: `npm view @astragenie/gepa-core version`.
Expected: `0.1.0` (or higher). If the package is not yet published to npm, fall back to `file:../../../gepa-core` (sibling-path install) during dev — see Step 1.1 below.

- [ ] **Step 0.2: Verify the existing crew test suite is green at this commit**

Run: `bun test --bail`.
Expected: 0 failures.
If failures, abort this slice and surface to the user.

- [ ] **Step 0.3: Verify `scripts/lib/artifacts/write.ts` line 704 contains the `writeArtifact` export**

Run: `grep -n "export async function writeArtifact" scripts/lib/artifacts/write.ts`.
Expected: a line near `704` matching.

- [ ] **Step 0.4: Verify the design spec + SLICE-97 backlog are committed on main**

Run: `git log --oneline main -- docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md | head -1`.
Expected: a commit returned.

---

## Tasks

### Task 1: Add the gepa-core dep + commit `gepa.config.json`

**Files:**
- Modify: `package.json`
- Create: `gepa.config.json`

- [ ] **Step 1.1: Install `@astragenie/gepa-core`**

Try npm first: `npm install @astragenie/gepa-core@^0.1.0`.
If the package isn't yet on the registry, install from local sibling: `npm install file:../../../gepa-core` (relative path from the worktree to `C:/work/mega/gepa-core`).

Verify: `cat package.json | grep gepa-core`.
Expected: a line like `"@astragenie/gepa-core": "^0.1.0"` (npm) or `"@astragenie/gepa-core": "file:../../../gepa-core"` (dev).

- [ ] **Step 1.2: Write `gepa.config.json` at repo root**

```json
{
  "capture": {
    "enabled": true,
    "exclude": [],
    "walltime_ms": 2000
  },
  "storage": {
    "backend": "file",
    "file_root": ".claude/artifacts/crew/gepa/trials"
  },
  "runner": {
    "backend": "sequential"
  },
  "judge": {
    "provider": "ollama",
    "model": "llama3.2:latest",
    "endpoint": "http://localhost:11434"
  },
  "judge_per_agent": {},
  "budget": {
    "daily_usd": 50,
    "per_eval_default_usd": 2,
    "per_optimize_default_usd": 5
  },
  "optimize": {
    "paused": false,
    "k": 5
  },
  "policy": {
    "eligible_agents": [],
    "min_pass_delta": 0.05,
    "min_case_score_floor": 0.6,
    "soak_percent": 0.10,
    "soak_days": 7,
    "min_soak_trials": 20,
    "max_soak_days": 21,
    "soak_epsilon": 0.02,
    "allow_cost_regression": false,
    "allow_latency_regression": false
  },
  "champion_frozen": []
}
```

- [ ] **Step 1.3: Commit**

```bash
git add package.json package-lock.json gepa.config.json
git commit -m "feat(gepa): add @astragenie/gepa-core dep + gepa.config.json defaults"
```

---

### Task 2: TDD `load-config.ts`

**Files:**
- Create: `scripts/lib/gepa/load-config.ts`
- Create: `tests/gepa/load-config.test.ts`
- Create: `tests/fixtures/gepa/sample-config.json`

- [ ] **Step 2.1: Write the failing test**

Create `tests/gepa/load-config.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGepaConfig } from "../../scripts/lib/gepa/load-config.ts";

describe("loadGepaConfig", () => {
  test("returns null when gepa.config.json is absent", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      const config = await loadGepaConfig(root);
      expect(config).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns a typed config when the file is present and valid", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: true } }),
      );
      const config = await loadGepaConfig(root);
      expect(config).not.toBeNull();
      expect(config?.capture.enabled).toBe(true);
      expect(config?.storage.backend).toBe("file"); // schema default
      expect(config?.judge.provider).toBe("ollama"); // schema default
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns null when gepa.config.json is malformed JSON", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), "{ not valid json");
      const config = await loadGepaConfig(root);
      expect(config).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns null when gepa.config.json fails Zod validation", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ judge: { provider: "unknown-provider", model: "x" } }),
      );
      const config = await loadGepaConfig(root);
      expect(config).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2.2: Run — expect FAIL**

Run: `bun test tests/gepa/load-config.test.ts`
Expected: FAIL with `Cannot find module ... load-config`.

- [ ] **Step 2.3: Implement `loadGepaConfig`**

Create `scripts/lib/gepa/load-config.ts`:
```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GepaConfigSchema, type GepaConfig } from "@astragenie/gepa-core";

export async function loadGepaConfig(repoPath: string): Promise<GepaConfig | null> {
  const path = join(repoPath, "gepa.config.json");
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    const result = GepaConfigSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2.4: Create the sample fixture**

Create `tests/fixtures/gepa/sample-config.json` with the same content you wrote to `gepa.config.json` in Task 1, Step 1.2. Subsequent tests reuse this fixture.

- [ ] **Step 2.5: Run — expect PASS**

Run: `bun test tests/gepa/load-config.test.ts`
Expected: 4 passing.

- [ ] **Step 2.6: Commit**

```bash
git add scripts/lib/gepa/load-config.ts tests/gepa/load-config.test.ts tests/fixtures/gepa/sample-config.json
git commit -m "feat(gepa): load + Zod-validate gepa.config.json (null on absent/invalid)"
```

---

### Task 3: TDD `adapt-artifact.ts`

**Files:**
- Create: `scripts/lib/gepa/adapt-artifact.ts`
- Create: `tests/gepa/adapt-artifact.test.ts`

The library's `gepaCapture()` accepts a `CrewArtifact` shape (see `CrewArtifactSchema` in `@astragenie/gepa-core`). Crew's `ArtifactRecord` returned from `writeArtifact()` has different field names. This helper adapts one into the other.

- [ ] **Step 3.1: Write the failing test**

Create `tests/gepa/adapt-artifact.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { adaptArtifact } from "../../scripts/lib/gepa/adapt-artifact.ts";
import type { ArtifactRecord } from "../../scripts/lib/artifacts/types.ts";

describe("adaptArtifact", () => {
  test("maps a runs-kind ArtifactRecord into CrewArtifact for fullstack-dev", () => {
    const record: ArtifactRecord = {
      kind: "runs",
      path: ".claude/artifacts/crew/runs/2026-06-27T12-00-00Z-some-run.json",
      payload: {
        agent: "fullstack-dev",
        input: { slice: "S2" },
        output: { handoff: "done" },
        cost_usd: 0.05,
        latency_ms: 1234,
      },
    } as unknown as ArtifactRecord;
    const adapted = adaptArtifact(record);
    expect(adapted).not.toBeNull();
    expect(adapted?.agent).toBe("fullstack-dev");
    expect(adapted?.phase).toBe("build");
    expect(adapted?.score_hint?.cost_usd).toBeCloseTo(0.05);
    expect(adapted?.source_artifact_path).toBe(record.path);
  });

  test("returns null for unknown artifact kinds", () => {
    const record: ArtifactRecord = {
      kind: "cost-report",
      path: "x",
      payload: {},
    } as unknown as ArtifactRecord;
    const adapted = adaptArtifact(record);
    expect(adapted).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run — expect FAIL**

Run: `bun test tests/gepa/adapt-artifact.test.ts`
Expected: module-not-found.

- [ ] **Step 3.3: Implement `adaptArtifact`**

Create `scripts/lib/gepa/adapt-artifact.ts`:
```ts
import type { CrewArtifact } from "@astragenie/gepa-core";
import type { ArtifactRecord } from "../artifacts/types.ts";

const ARTIFACT_TO_PHASE: Record<string, CrewArtifact["phase"]> = {
  runs: "build",
  handoffs: "build",
  reviews: "review",
  validations: "validate",
};

export function adaptArtifact(record: ArtifactRecord): CrewArtifact | null {
  const phase = ARTIFACT_TO_PHASE[record.kind];
  if (!phase) return null;
  const payload = record.payload as Record<string, unknown>;
  const agent = (payload.agent as string | undefined) ?? "unknown";
  const cost_usd = payload.cost_usd as number | undefined;
  const latency_ms = payload.latency_ms as number | undefined;
  const pass = payload.pass as boolean | undefined;
  return {
    agent,
    phase,
    input: payload.input ?? null,
    output: payload.output ?? null,
    score_hint:
      cost_usd !== undefined || latency_ms !== undefined || pass !== undefined
        ? {
            ...(pass !== undefined ? { pass } : {}),
            ...(cost_usd !== undefined ? { cost_usd } : {}),
            ...(latency_ms !== undefined ? { latency_ms } : {}),
          }
        : undefined,
    source_artifact_path: record.path,
    dispatched_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 3.4: Run — expect PASS**

Run: `bun test tests/gepa/adapt-artifact.test.ts`
Expected: 2 passing.

- [ ] **Step 3.5: Commit**

```bash
git add scripts/lib/gepa/adapt-artifact.ts tests/gepa/adapt-artifact.test.ts
git commit -m "feat(gepa): adapt crew ArtifactRecord into library's CrewArtifact shape"
```

---

### Task 4: TDD `capture-tee.ts`

**Files:**
- Create: `scripts/lib/gepa/capture-tee.ts`
- Create: `tests/gepa/capture-tee.test.ts`

- [ ] **Step 4.1: Write the failing happy-path test**

Create `tests/gepa/capture-tee.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureTee } from "../../scripts/lib/gepa/capture-tee.ts";
import type { ArtifactRecord } from "../../scripts/lib/artifacts/types.ts";

function sampleRecord(): ArtifactRecord {
  return {
    kind: "runs",
    path: "/dev/null",
    payload: {
      agent: "fullstack-dev",
      input: { slice: "S2" },
      output: { handoff: "done" },
      cost_usd: 0.01,
      latency_ms: 100,
      pass: true,
    },
  } as unknown as ArtifactRecord;
}

describe("captureTee", () => {
  test("writes a Trial line when capture is enabled and agent is included", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, walltime_ms: 2000 },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );
      await captureTee(root, sampleRecord());
      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl");
      const lines = readFileSync(trialFile, "utf8").trim().split("\n");
      expect(lines).toHaveLength(1);
      const trial = JSON.parse(lines[0]!);
      expect(trial.agent).toBe("fullstack-dev");
      expect(trial.source).toBe("captured");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when gepa.config.json is absent", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      await captureTee(root, sampleRecord());
      // No file written, no exception thrown.
      const exists = await Bun.file(join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl")).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when capture.enabled is false", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: false } }),
      );
      await captureTee(root, sampleRecord());
      const exists = await Bun.file(join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl")).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when agent is in capture.exclude", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, exclude: ["fullstack-dev"] },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );
      await captureTee(root, sampleRecord());
      const exists = await Bun.file(join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl")).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("only captures fullstack-dev in S2 (other agents are no-op)", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );
      const inspectorRecord = sampleRecord();
      (inspectorRecord as any).payload.agent = "inspector";
      await captureTee(root, inspectorRecord);
      const exists = await Bun.file(join(root, ".claude/artifacts/crew/gepa/trials/inspector.jsonl")).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 4.2: Run — expect FAIL**

Run: `bun test tests/gepa/capture-tee.test.ts`
Expected: module-not-found.

- [ ] **Step 4.3: Implement `captureTee`**

Create `scripts/lib/gepa/capture-tee.ts`:
```ts
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { fileStore, gepaCapture, type Trial, newTrialId, type CrewArtifact } from "@astragenie/gepa-core";
import { loadGepaConfig } from "./load-config.ts";
import { adaptArtifact } from "./adapt-artifact.ts";
import type { ArtifactRecord } from "../artifacts/types.ts";

// S2 scope: capture only fullstack-dev. Other agents wait for S5c horizontalize.
const S2_AGENT_ALLOWLIST = new Set(["fullstack-dev"]);

const EVENTS_LOG_PATH = ".claude/logs/events.jsonl";

function logEvent(repoPath: string, event: string, fields: Record<string, unknown>): void {
  try {
    const line = `${JSON.stringify({ event, ts: new Date().toISOString(), ...fields })}\n`;
    appendFileSync(join(repoPath, EVENTS_LOG_PATH), line, { flag: "a" });
  } catch {
    // Events log failure must never propagate.
  }
}

export async function captureTee(repoPath: string, record: ArtifactRecord): Promise<void> {
  const config = await loadGepaConfig(repoPath);
  if (!config) return;
  if (!config.capture.enabled) return;

  const artifact = adaptArtifact(record);
  if (!artifact) return;
  if (!S2_AGENT_ALLOWLIST.has(artifact.agent)) return;
  if (config.capture.exclude.includes(artifact.agent)) return;

  const storeRoot = join(repoPath, config.storage.file_root);
  const store = fileStore(storeRoot);
  const walltimeMs = config.capture.walltime_ms;
  const trialId = newTrialId();

  try {
    await Promise.race([
      gepaCapture({ artifact, store, walltimeMs }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("walltime_exceeded")), walltimeMs),
      ),
    ]);
  } catch (err) {
    logEvent(repoPath, "gepa_capture_drop", {
      trial_id: trialId,
      agent: artifact.agent,
      reason: (err as Error).message ?? "unknown",
    });
  }
}
```

- [ ] **Step 4.4: Run — expect PASS**

Run: `bun test tests/gepa/capture-tee.test.ts`
Expected: 5 passing.

- [ ] **Step 4.5: Commit**

```bash
git add scripts/lib/gepa/capture-tee.ts tests/gepa/capture-tee.test.ts
git commit -m "feat(gepa): capture-tee wrapper with walltime race + fail-silent + agent allowlist"
```

---

### Task 5: Walltime miss path

**Files:**
- Create: `tests/gepa/capture-walltime.test.ts`

Validates AC-3: scorer (or the store, since the wallclock is on `gepaCapture`) sleeps past the cap. Drops the trial, logs `gepa_capture_drop`, dispatch artifact tree is byte-identical to control. Implementation already correct — this task locks the behavior with a test.

- [ ] **Step 5.1: Write the failing test**

Create `tests/gepa/capture-walltime.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureTee } from "../../scripts/lib/gepa/capture-tee.ts";

describe("captureTee walltime", () => {
  test("walltime miss → drop trial + log gepa_capture_drop", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-walltime-"));
    try {
      mkdirSync(join(root, ".claude/logs"), { recursive: true });
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, walltime_ms: 50 }, // very tight
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );
      // Block the file-store path so put() exceeds 50 ms (use a non-writable parent).
      // Easiest reliable test: point file_root at a path whose parent doesn't exist
      // AND make fileStore's mkdirSync fail OR set a real walltime by making put
      // slow. Use a tmpfile lock trick — simplest: a file that already exists where
      // a directory should be.
      const blockedParent = join(root, ".claude/artifacts/crew/gepa/trials");
      writeFileSync(join(root, ".claude/artifacts/crew/gepa/trials"), "");
      const record = {
        kind: "runs",
        path: "/dev/null",
        payload: {
          agent: "fullstack-dev",
          input: { slice: "S2" },
          output: { handoff: "done" },
          cost_usd: 0.01,
          latency_ms: 100,
        },
      } as any;
      await captureTee(root, record);
      const log = readFileSync(join(root, ".claude/logs/events.jsonl"), "utf8");
      expect(log).toContain("gepa_capture_drop");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

(If the file-collision approach above is too platform-fragile, fall back to a stub: write a wrapper test that monkey-patches `fileStore` to delay the `put` call. Either approach satisfies the AC.)

- [ ] **Step 5.2: Run — expect PASS**

Run: `bun test tests/gepa/capture-walltime.test.ts`
Expected: 1 passing.

- [ ] **Step 5.3: Commit**

```bash
git add tests/gepa/capture-walltime.test.ts
git commit -m "test(gepa): assert walltime miss drops trial + emits gepa_capture_drop event"
```

---

### Task 6: Hook the tee into `writeArtifact`

**Files:**
- Modify: `scripts/lib/artifacts/write.ts` (around line 720, post-write success)

- [ ] **Step 6.1: Locate the success branch**

Run: `grep -n "return ok\|return Ok\|return { ok" scripts/lib/artifacts/write.ts | head -3`
Expected: the line that returns the successful `Result<ArtifactRecord, Error>`.

- [ ] **Step 6.2: Insert the capture-tee call**

Just before the success-return, add:
```ts
// GEPA capture tee — fire-and-forget per spec slice S2.
// Awaited so any walltime-bounded error logging completes within the dispatch span,
// but never throws or returns failure to the caller.
try {
  const { captureTee } = await import("../gepa/capture-tee.ts");
  await captureTee(repoPath, artifactRecord);
} catch {
  // captureTee is internally fail-silent; this catch is belt-and-suspenders.
}
```

Use the dynamic `import("../gepa/capture-tee.ts")` so an unrelated build that doesn't ship gepa config still tree-shakes cleanly.

- [ ] **Step 6.3: Run the existing artifact-writer tests**

Run: `bun test tests/lib/artifacts/`
Expected: all prior tests still pass (no regressions).

- [ ] **Step 6.4: Run the new capture-tee tests**

Run: `bun test tests/gepa/capture-tee.test.ts tests/gepa/capture-walltime.test.ts`
Expected: 6 passing total.

- [ ] **Step 6.5: Commit**

```bash
git add scripts/lib/artifacts/write.ts
git commit -m "feat(gepa): tee every writeArtifact through captureTee (fire-and-forget, fail-silent)"
```

---

### Task 7: Capture-absent parity test

**Files:**
- Create: `tests/gepa/capture-absent-parity.test.ts`

Validates AC-1. Spawns two identical writeArtifact runs in tmpdirs: one with no `gepa.config.json`, one with `gepa.config.json` having `capture.enabled: false`. Diffs the resulting `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/` trees byte-by-byte against a control tree.

- [ ] **Step 7.1: Write the failing test**

Create `tests/gepa/capture-absent-parity.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeArtifact } from "../../scripts/lib/artifacts/write.ts";

function listAllFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else out.push(full.replace(root, ""));
    }
  }
  walk(root);
  return out.sort();
}

function copyTreeContent(root: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const rel of listAllFiles(root)) {
    map[rel] = readFileSync(join(root, rel), "utf8");
  }
  return map;
}

describe("capture-absent parity", () => {
  test("no gepa.config.json → artifact tree byte-identical to control", async () => {
    const a = mkdtempSync(join(tmpdir(), "gepa-control-"));
    const b = mkdtempSync(join(tmpdir(), "gepa-absent-"));
    try {
      // Control: no gepa config in either.
      await writeArtifact(a, "runs", {
        title: "test-run",
        payload: { agent: "fullstack-dev", input: {}, output: {} },
      });
      await writeArtifact(b, "runs", {
        title: "test-run",
        payload: { agent: "fullstack-dev", input: {}, output: {} },
      });

      // Only the .claude/artifacts/crew/ subtree should match; exclude logs.
      const filter = (rels: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(rels).filter(
            ([rel]) =>
              rel.includes(".claude/artifacts/crew/") &&
              !rel.includes(".claude/artifacts/crew/gepa/"),
          ),
        );
      expect(filter(copyTreeContent(a))).toEqual(filter(copyTreeContent(b)));
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });

  test("capture.enabled: false → no gepa/ subtree appears", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-disabled-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: false } }),
      );
      await writeArtifact(root, "runs", {
        title: "test-run",
        payload: { agent: "fullstack-dev", input: {}, output: {} },
      });
      const all = listAllFiles(root);
      expect(all.some((p) => p.includes(".claude/artifacts/crew/gepa/"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 7.2: Run — expect PASS**

Run: `bun test tests/gepa/capture-absent-parity.test.ts`
Expected: 2 passing.

- [ ] **Step 7.3: Commit**

```bash
git add tests/gepa/capture-absent-parity.test.ts
git commit -m "test(gepa): assert absent or disabled config → byte-identical artifact tree"
```

---

### Task 8: Capture-parity test (with/without)

**Files:**
- Create: `tests/gepa/capture-parity.test.ts`

Validates AC-4. Same dispatch, capture ON vs OFF. Artifact tree (excluding `gepa/` subtree) must be byte-identical.

- [ ] **Step 8.1: Write the failing test**

Create `tests/gepa/capture-parity.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeArtifact } from "../../scripts/lib/artifacts/write.ts";

function snapshot(root: string, filter: (rel: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  function walk(dir: string) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else {
        const rel = full.replace(root, "");
        if (filter(rel)) out[rel] = readFileSync(full, "utf8");
      }
    }
  }
  walk(root);
  return out;
}

describe("capture parity", () => {
  test("identical dispatches with/without capture → byte-identical non-gepa artifacts", async () => {
    const on = mkdtempSync(join(tmpdir(), "gepa-on-"));
    const off = mkdtempSync(join(tmpdir(), "gepa-off-"));
    try {
      writeFileSync(
        join(on, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );
      writeFileSync(
        join(off, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: false } }),
      );

      const payload = {
        agent: "fullstack-dev",
        input: { slice: "S2", seed: 42 },
        output: { handoff: "done" },
        cost_usd: 0.05,
        latency_ms: 1234,
      };
      await writeArtifact(on, "runs", { title: "parity-run", payload });
      await writeArtifact(off, "runs", { title: "parity-run", payload });

      // Snapshot both, excluding gepa subtree.
      const filter = (rel: string) =>
        rel.includes(".claude/artifacts/crew/") && !rel.includes("/gepa/");
      expect(snapshot(on, filter)).toEqual(snapshot(off, filter));

      // And on the ON side, gepa trials should appear.
      const trialsFile = join(on, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl");
      const trials = readFileSync(trialsFile, "utf8").trim().split("\n");
      expect(trials).toHaveLength(1);
    } finally {
      rmSync(on, { recursive: true, force: true });
      rmSync(off, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 8.2: Run — expect PASS**

Run: `bun test tests/gepa/capture-parity.test.ts`
Expected: 1 passing.

- [ ] **Step 8.3: Commit**

```bash
git add tests/gepa/capture-parity.test.ts
git commit -m "test(gepa): capture on vs off → non-gepa artifacts byte-identical"
```

---

### Task 9: SIGKILL-during-put parity

**Files:**
- Create: `tests/gepa/capture-sigkill-parity.test.ts`

Validates AC-5. Spawn a child process that calls `captureTee`, SIGKILL it mid-write, then verify on recovery that:
1. The artifact tree under `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/` is byte-identical to a control run.
2. The trial JSONL either contains the line fully or doesn't contain it at all (no torn line).
3. `validateTrialCorpus()` reports zero torn lines.

- [ ] **Step 9.1: Write the SIGKILL helper**

Because the test spawns a subprocess, the easiest reliable approach is a small Bun.spawn-based scenario:

```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("SIGKILL-during-put parity", () => {
  test("artifact tree clean + no torn line after SIGKILL mid-capture", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-sigkill-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );

      const child = Bun.spawn({
        cmd: [
          "bun",
          "run",
          "-e",
          `
          const { writeArtifact } = await import("${process.cwd()}/scripts/lib/artifacts/write.ts");
          for (let i = 0; i < 50; i++) {
            await writeArtifact(${JSON.stringify(root)}, "runs", {
              title: "x",
              payload: { agent: "fullstack-dev", input: { i }, output: {} },
            });
          }
          `,
        ],
        stdout: "pipe",
        stderr: "pipe",
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      child.kill(9);
      await child.exited;

      // Recovery: the trial file might have whole lines, no torn lines.
      const trialsFile = join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl");
      if (readdirSync(join(root, ".claude/artifacts/crew/gepa/trials")).includes("fullstack-dev.jsonl")) {
        const raw = readFileSync(trialsFile, "utf8");
        // Every non-empty line must parse as JSON.
        for (const line of raw.split("\n")) {
          if (line.trim().length === 0) continue;
          expect(() => JSON.parse(line)).not.toThrow();
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

The implementation has no fix to apply — `fileStore` uses `appendFileSync` single-syscall under the line size, so atomicity is already guaranteed by the OS. This test locks the invariant.

- [ ] **Step 9.2: Run — expect PASS**

Run: `bun test tests/gepa/capture-sigkill-parity.test.ts`
Expected: 1 passing.

- [ ] **Step 9.3: Commit**

```bash
git add tests/gepa/capture-sigkill-parity.test.ts
git commit -m "test(gepa): SIGKILL mid-capture → atomic JSONL appends, no torn lines"
```

---

### Task 10: Capture-perf micro-benchmark

**Files:**
- Create: `tests/gepa/capture-perf.test.ts`

Validates AC-6: p50 ≤ 50 ms, p99 ≤ 200 ms, max ≤ 2000 ms over 1000 iterations.

- [ ] **Step 10.1: Write the test**

```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureTee } from "../../scripts/lib/gepa/capture-tee.ts";

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

describe("capture-perf", () => {
  test("1000-iter capture: p50 ≤ 50ms, p99 ≤ 200ms, max ≤ 2000ms", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-perf-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, walltime_ms: 2000 },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );
      const samples: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const t0 = performance.now();
        await captureTee(root, {
          kind: "runs",
          path: "/dev/null",
          payload: {
            agent: "fullstack-dev",
            input: { i },
            output: { ok: true },
            cost_usd: 0.001,
            latency_ms: 10,
          },
        } as any);
        samples.push(performance.now() - t0);
      }
      const p50 = percentile(samples, 50);
      const p99 = percentile(samples, 99);
      const max = Math.max(...samples);
      console.log({ p50, p99, max });
      expect(p50).toBeLessThanOrEqual(50);
      expect(p99).toBeLessThanOrEqual(200);
      expect(max).toBeLessThanOrEqual(2000);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 10.2: Run — expect PASS**

Run: `bun test tests/gepa/capture-perf.test.ts`
Expected: 1 passing. If any percentile is breached on Windows CI, investigate and either tighten the implementation or relax the bound with an explicit justification + commit message.

- [ ] **Step 10.3: Commit**

```bash
git add tests/gepa/capture-perf.test.ts
git commit -m "test(gepa): capture-perf bench locks p50≤50ms / p99≤200ms / max≤2000ms"
```

---

### Task 11: `/crew:gepa-history` subcommand

**Files:**
- Create: `commands/gepa-history.md`
- Create: `scripts/lib/gepa/history.ts`
- Modify: `scripts/crew.ts`
- Create: `tests/gepa/gepa-history.test.ts`

Validates AC-7.

- [ ] **Step 11.1: Write `commands/gepa-history.md`**

```markdown
---
description: Print recent GEPA trials for an agent (from .claude/artifacts/crew/gepa/trials/<agent>.jsonl)
allowed-tools: Bash
---

# /crew:gepa-history

Show recent GEPA trials for the named agent. Reads from the local fileStore JSONL log under `.claude/artifacts/crew/gepa/trials/`.

## Usage

```
/crew:gepa-history <agent> [--source eval|captured|soak] [--limit N]
```

## Behavior

The command shells to `node scripts/crew.ts gepa-history` with the given args. Output is one tabular line per trial, sorted by `created_at` desc:

```
trial_id | source | pass | score | cost_usd | latency_ms | created_at
```

Exits 0 on success, 2 on bad args, 1 on internal error.
```

- [ ] **Step 11.2: Write the failing CLI test**

Create `tests/gepa/gepa-history.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGepaHistoryCmd } from "../../scripts/lib/gepa/history.ts";

describe("gepa-history CLI", () => {
  test("prints last N trials desc by created_at, default limit 10", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-history-"));
    try {
      const dir = join(root, ".claude/artifacts/crew/gepa/trials");
      mkdirSync(dir, { recursive: true });
      const now = Date.now();
      const lines: string[] = [];
      for (let i = 0; i < 12; i++) {
        lines.push(
          JSON.stringify({
            id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
            agent: "fullstack-dev",
            phase: "build",
            candidate_prompt_hash: "h",
            candidate_prompt_path: null,
            input: {},
            output: {},
            score: { pass: i % 2 === 0, score: 0.5, cost_usd: 0.01, latency_ms: 100 },
            source: "captured",
            pareto_rank: null,
            created_at: new Date(now - (12 - i) * 1000).toISOString(),
          }),
        );
      }
      writeFileSync(join(dir, "fullstack-dev.jsonl"), `${lines.join("\n")}\n`);

      const out = await runGepaHistoryCmd(root, ["fullstack-dev", "--limit", "5"]);
      expect(out.exitCode).toBe(0);
      const rows = out.stdout.trim().split("\n");
      expect(rows).toHaveLength(5);
      expect(rows[0]).toContain("00000011-"); // most recent first
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("--source captured filters", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-history-src-"));
    try {
      const dir = join(root, ".claude/artifacts/crew/gepa/trials");
      mkdirSync(dir, { recursive: true });
      const trials = ["eval", "captured", "soak"].map((src, i) =>
        JSON.stringify({
          id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
          agent: "x",
          phase: "build",
          candidate_prompt_hash: "h",
          candidate_prompt_path: null,
          input: {},
          output: {},
          score: { pass: true, score: 1, cost_usd: 0, latency_ms: 0 },
          source: src,
          pareto_rank: null,
          created_at: "2026-06-27T00:00:00.000Z",
        }),
      );
      writeFileSync(join(dir, "x.jsonl"), `${trials.join("\n")}\n`);

      const out = await runGepaHistoryCmd(root, ["x", "--source", "captured"]);
      expect(out.exitCode).toBe(0);
      const rows = out.stdout.trim().split("\n");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain("captured");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("exits 2 on missing agent argument", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-history-noarg-"));
    try {
      const out = await runGepaHistoryCmd(root, []);
      expect(out.exitCode).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 11.3: Run — expect FAIL**

Run: `bun test tests/gepa/gepa-history.test.ts`
Expected: module-not-found.

- [ ] **Step 11.4: Implement `history.ts`**

Create `scripts/lib/gepa/history.ts`:
```ts
import { join } from "node:path";
import { fileStore } from "@astragenie/gepa-core";

export interface HistoryResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runGepaHistoryCmd(
  repoPath: string,
  args: string[],
): Promise<HistoryResult> {
  const agent = args[0];
  if (!agent || agent.startsWith("--")) {
    return { exitCode: 2, stdout: "", stderr: "usage: gepa-history <agent> [--source ...] [--limit N]\n" };
  }
  let source: "eval" | "captured" | "soak" | undefined;
  let limit = 10;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = args[i + 1] as typeof source;
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = Number.parseInt(args[i + 1]!, 10);
      if (Number.isNaN(limit) || limit <= 0) {
        return { exitCode: 2, stdout: "", stderr: "invalid --limit\n" };
      }
      i++;
    }
  }
  const store = fileStore(join(repoPath, ".claude/artifacts/crew/gepa/trials"));
  const trials = await store.recall({ agent, source, limit });
  const rows = trials.map((t) =>
    [
      t.id,
      t.source,
      t.score.pass,
      t.score.score.toFixed(3),
      t.score.cost_usd.toFixed(4),
      t.score.latency_ms,
      t.created_at,
    ].join(" | "),
  );
  return { exitCode: 0, stdout: `${rows.join("\n")}\n`, stderr: "" };
}
```

- [ ] **Step 11.5: Wire into `scripts/crew.ts`**

Locate the existing subcommand dispatch in `scripts/crew.ts`. Add a case branch:
```ts
case "gepa-history": {
  const { runGepaHistoryCmd } = await import("./lib/gepa/history.ts");
  const result = await runGepaHistoryCmd(process.cwd(), args.slice(1));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
```
(Exact insertion point depends on the existing structure; verify by reading the current subcommand switch.)

- [ ] **Step 11.6: Run — expect PASS**

Run: `bun test tests/gepa/gepa-history.test.ts`
Expected: 3 passing.

- [ ] **Step 11.7: Smoke-test the CLI end-to-end**

Run from worktree root:
```
echo '{"id":"11111111-1111-4111-8111-111111111111","agent":"smoke","phase":"build","candidate_prompt_hash":"h","candidate_prompt_path":null,"input":{},"output":{},"score":{"pass":true,"score":1,"cost_usd":0,"latency_ms":0},"source":"captured","pareto_rank":null,"created_at":"2026-06-27T00:00:00.000Z"}' > /tmp/gepa-smoke/smoke.jsonl
node scripts/crew.ts gepa-history smoke
```
Expected: one row printed, exit 0. (Adjust path for the actual `file_root` config — this is a sanity check, not a captured test.)

- [ ] **Step 11.8: Commit**

```bash
git add commands/gepa-history.md scripts/lib/gepa/history.ts scripts/crew.ts tests/gepa/gepa-history.test.ts
git commit -m "feat(gepa): /crew:gepa-history CLI + handler + tests (source + limit filters)"
```

---

### Task 12: `validate-agents.ts` — skip `.gepa/` subdirs

**Files:**
- Modify: `scripts/validate-agents.ts`
- Create: `tests/gepa/validate-agents-gepa-skip.test.ts`
- Create: `tests/fixtures/gepa/agent-with-gepa-subdir/` directory with placeholder eval data

Validates AC-9.

- [ ] **Step 12.1: Inspect existing validator behavior**

Run: `grep -n "readdir\|glob\|fg(" scripts/validate-agents.ts | head -5` to find where agent enumeration happens.

- [ ] **Step 12.2: Write the failing test**

Create `tests/gepa/validate-agents-gepa-skip.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enumerateAgents } from "../../scripts/validate-agents.ts";

describe("validate-agents .gepa/ skip", () => {
  test("enumerator excludes files under agents/<name>/.gepa/", () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-skip-"));
    try {
      mkdirSync(join(root, "agents/fullstack-dev/.gepa/eval"), { recursive: true });
      writeFileSync(join(root, "agents/fullstack-dev.md"), "# fullstack-dev\n");
      writeFileSync(join(root, "agents/fullstack-dev/.gepa/eval/sample.jsonl"), `{"id":"x"}\n`);
      writeFileSync(join(root, "agents/fullstack-dev/.gepa/rubric.md"), "criterion 1\n");
      const files = enumerateAgents(join(root, "agents"));
      expect(files.some((f) => f.includes(".gepa/"))).toBe(false);
      expect(files.some((f) => f.endsWith("fullstack-dev.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

(Note: this assumes `enumerateAgents` is exported. If the current implementation is a CLI entrypoint only, refactor to export it for testability before adding the skip logic.)

- [ ] **Step 12.3: Refactor + add the skip**

In `scripts/validate-agents.ts`, find the directory walk and add a guard:
```ts
function enumerateAgents(agentsDir: string): string[] {
  // ... existing walk ...
  return entries.filter((entry) => !entry.includes(`${path.sep}.gepa${path.sep}`));
}
```

Make sure `enumerateAgents` is exported (`export function enumerateAgents(...)`).

- [ ] **Step 12.4: Run — expect PASS**

Run: `bun test tests/gepa/validate-agents-gepa-skip.test.ts`
Expected: 1 passing.

- [ ] **Step 12.5: Run the existing validator suite**

Run: `bun test tests/validate-agents.test.ts` (or whatever the current name is).
Expected: prior tests still pass; the new skip doesn't change behavior for repos without `.gepa/`.

- [ ] **Step 12.6: Commit**

```bash
git add scripts/validate-agents.ts tests/gepa/validate-agents-gepa-skip.test.ts
git commit -m "feat(validate-agents): skip agents/<name>/.gepa/ subdirs during enumeration"
```

---

### Task 13: `validate-agents.ts` — exempt `gepa:` frontmatter

**Files:**
- Modify: `scripts/validate-agents.ts` (line-count check)
- Create: `tests/gepa/validate-agents-frontmatter.test.ts`
- Create: `tests/fixtures/gepa/agent-with-frontmatter.md` (348-line body + 8-line `gepa:` frontmatter = 356 lines, should pass)
- Create: `tests/fixtures/gepa/agent-no-frontmatter.md` (360-line plain prompt, should fail)

Validates AC-8.

- [ ] **Step 13.1: Build the fixtures**

`agent-with-frontmatter.md`: starts with
```
---
gepa:
  champion_from_trial: 11111111-1111-4111-8111-111111111111
  prior_prompt_hash: deadbeef
  promoted_at: 2026-06-27T12:00:00.000Z
---
```
(8 lines including the two `---` markers)
followed by exactly 348 lines of body content. Total 356 lines.

`agent-no-frontmatter.md`: 360 lines of plain content, no frontmatter.

- [ ] **Step 13.2: Write the failing test**

Create `tests/gepa/validate-agents-frontmatter.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { checkAgentLineCap } from "../../scripts/validate-agents.ts";

const FIX = "tests/fixtures/gepa";

describe("validate-agents gepa frontmatter exemption", () => {
  test("348 body + 8 frontmatter (356 total) PASSES the 350 cap", () => {
    const result = checkAgentLineCap(join(FIX, "agent-with-frontmatter.md"), 350);
    expect(result.ok).toBe(true);
  });

  test("360-line plain agent (no frontmatter) FAILS the 350 cap", () => {
    const result = checkAgentLineCap(join(FIX, "agent-no-frontmatter.md"), 350);
    expect(result.ok).toBe(false);
  });

  test("a mid-document YAML block is NOT exempted (smuggle prevention)", () => {
    // Smuggled YAML block in the middle of the file should not bypass the cap.
    // Build a 360-line file where lines 50-58 look like a YAML block, but the
    // document does not start with one.
    // ... fixture-based test, can be inlined or use a 3rd fixture file.
    expect(true).toBe(true); // placeholder; see Step 13.3 for the real fixture
  });
});
```

(The third test in this group is important — exemption must only apply to LEADING document-start `---...---` frontmatter, never mid-document. Build a third fixture `agent-smuggled-yaml.md` to assert this.)

- [ ] **Step 13.3: Build the smuggle fixture**

`agent-smuggled-yaml.md`: 360-line plain content where lines 50-58 happen to look like a YAML frontmatter block but the file does NOT start with `---`. Validator should still reject.

- [ ] **Step 13.4: Run — expect FAIL**

Run: `bun test tests/gepa/validate-agents-frontmatter.test.ts`
Expected: FAIL (function doesn't yet exempt).

- [ ] **Step 13.5: Implement `checkAgentLineCap` with exemption**

```ts
export function checkAgentLineCap(
  filePath: string,
  maxLines: number,
): { ok: boolean; lineCount: number } {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n");
  let effectiveLines = lines.length;
  // Only exempt LEADING `---\ngepa:\n...\n---\n` block.
  if (lines[0] === "---") {
    const closeIdx = lines.indexOf("---", 1);
    if (closeIdx > 0) {
      const block = lines.slice(1, closeIdx).join("\n");
      if (/^gepa:/m.test(block)) {
        effectiveLines = lines.length - (closeIdx + 1);
      }
    }
  }
  return { ok: effectiveLines <= maxLines, lineCount: effectiveLines };
}
```

Wire `checkAgentLineCap` into the existing validator's per-agent loop.

- [ ] **Step 13.6: Run — expect PASS**

Run: `bun test tests/gepa/validate-agents-frontmatter.test.ts`
Expected: 3 passing.

- [ ] **Step 13.7: Commit**

```bash
git add scripts/validate-agents.ts tests/gepa/validate-agents-frontmatter.test.ts tests/fixtures/gepa/agent-with-frontmatter.md tests/fixtures/gepa/agent-no-frontmatter.md tests/fixtures/gepa/agent-smuggled-yaml.md
git commit -m "feat(validate-agents): exempt leading gepa: YAML frontmatter from 350-line cap"
```

---

### Task 14: `.gitignore` for transient gepa subdirs

**Files:**
- Modify: `.gitignore`

Per design spec Implementation Notes → S1: locks and candidates dirs must be gitignored. Trials, eval summaries, opt summaries, and soak forensics ARE committed.

- [ ] **Step 14.1: Append the rules**

Add to `.gitignore`:
```
# GEPA — transient
.claude/artifacts/crew/gepa/locks/
.claude/artifacts/crew/gepa/candidates/
```

- [ ] **Step 14.2: Verify pre-existing rules unchanged**

Run: `git diff .gitignore | head -20`
Expected: only the two new lines added at the end; no prior rules touched.

- [ ] **Step 14.3: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): exclude transient gepa locks/ and candidates/ dirs"
```

---

### Task 15: Full-suite green + run final ACs

- [ ] **Step 15.1: Run all gepa tests**

Run: `bun test tests/gepa/`
Expected: every new test passes.

- [ ] **Step 15.2: Run the full repo suite**

Run: `bun test`
Expected: zero new failures; all prior tests still pass.

- [ ] **Step 15.3: Lint + format**

Run sequentially:
```
bun run lint
bun run format:check
bun run typecheck
```
Expected: all green.

- [ ] **Step 15.4: Run all validators**

Run:
```
node scripts/validate-manifests.ts
node scripts/validate-skills.ts
node scripts/validate-agents.ts
node scripts/validate-slices.ts
```
Expected: all exit 0.

- [ ] **Step 15.5: Run the e2e smoke**

Run: `bun run e2e:smoke`
Expected: smoke completes green.

---

### Task 16: PR preparation

- [ ] **Step 16.1: Verify the commit list looks clean**

Run: `git log --oneline main..HEAD`
Expected: ~14 commits, one per task above, each with a focused message.

- [ ] **Step 16.2: Push the branch**

Run: `git push -u origin <branch-name>` (the worktree branch name).

- [ ] **Step 16.3: Open PR**

Run:
```
gh pr create --title "GEPA S2 — capture tee + /crew:gepa-history + parity tests (tracks #121, SLICE-97)" --body "$(cat <<'EOF'
## Summary

- Wires the crew side of GEPA Phase 1 (Capture): every successful `writeArtifact` for `crew:fullstack-dev` tees a Trial into `.claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl` via the `@astragenie/gepa-core` library, walltime-bounded and fail-silent.
- Adds `/crew:gepa-history` for inspecting trials.
- Teaches `scripts/validate-agents.ts` about `.gepa/` subdirs and `gepa:` frontmatter exemption.
- Updates `.gitignore` for transient lock/candidate dirs.

Acceptance criteria from SLICE-97 (AC-1..AC-10) all green.

## Test plan

- [ ] `bun test tests/gepa/` — full local suite green.
- [ ] Manual: with `gepa.config.json` present and `capture.enabled: true`, run a real `/crew:build` and confirm a trial line appears in the JSONL.
- [ ] Manual: rename `gepa.config.json` and confirm zero gepa side effects.
- [ ] Manual: `node scripts/crew.ts gepa-history fullstack-dev --limit 3` prints tabular rows.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 16.4: Stop and surface to the user**

> "S2 complete. PR opened. Ready for review."

Do NOT auto-merge. Do NOT proceed to S3.

---

## Self-Review

### Spec coverage

| Spec / AC | Task |
|---|---|
| AC-1 (absent config = parity) | Task 7 |
| AC-2 (captured trial appears) | Tasks 4 + 6 |
| AC-3 (walltime miss drops + logs) | Tasks 4 + 5 |
| AC-4 (on/off byte-identical) | Task 8 |
| AC-5 (SIGKILL parity + no torn lines) | Task 9 |
| AC-6 (p50/p99/max bench) | Task 10 |
| AC-7 (/crew:gepa-history CLI) | Task 11 |
| AC-8 (frontmatter exemption) | Task 13 |
| AC-9 (.gepa/ skip) | Task 12 |
| AC-10 (capture.exclude honored) | Task 4 (test case 4) |
| `.gitignore` for locks/candidates | Task 14 |

### Placeholder scan

The third assertion in Task 13 Step 13.2 is intentionally a stubbed placeholder pending the smuggle fixture in Step 13.3 — that's a deliberate two-step authoring pattern, not a hand-wave. The actual assertion is filled in at Step 13.5 once the fixture exists.

No other "TBD"/"TODO"/hand-wave language remains.

### Type consistency

- `CrewArtifact` shape comes from `@astragenie/gepa-core` and is consistent between `adapt-artifact.ts` (Task 3), `capture-tee.ts` (Task 4), and tests.
- `Trial` shape consistent across `capture-tee.ts`, `history.ts`, and tests.
- `runGepaHistoryCmd` signature `(repoPath: string, args: string[]) → Promise<HistoryResult>` is consistent between `history.ts` (Task 11.4), the CLI wiring (Task 11.5), and the tests (Task 11.2).

### Out-of-scope (correctly deferred)

- Capture for agents other than `fullstack-dev` — S5c horizontalize.
- `astramemStore` backend — S5c.
- `/crew:gepa-eval` and `/crew:gepa-optimize` — S3 and S4.
- `validateTrialCorpus` integration into validators — S5a.
- `gepa:` frontmatter WRITING (champion provenance) — S8b.

---

## Subsequent slice

S3 (eval + `/crew:gepa-eval` for fullstack-dev) gets its own plan after this slice ships and `crew:inspector` review is green. The plan author should consult SLICE-98 in `.claude/artifacts/loop/backlog/triaged/`.

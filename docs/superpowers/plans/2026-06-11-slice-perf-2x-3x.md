# Slice Perf 2-3x Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut per-slice wall-clock 2-3x by wiring per-dispatch telemetry first (Phase 1, 3 FEATs), then applying 6 data-justified cuts (Phase 2) targeting the top tolls measured in SLICE-67 cost report: Read re-reads, Edit thrash, Bash overhead, TaskUpdate cache-prime anomaly, compactions.

**Architecture:** Telemetry layer (`scripts/lib/dispatch-timing.ts`, `scripts/lib/bash-gate-timer.ts`) feeds the existing `scripts/crew.ts write-cost-report` writer via new aggregator code. Phase 2 levers each touch a narrow surface — parallel-gates helper, render-universals build step, agent prompt rules, and hook extensions in `hooks/lib/`. No cross-lever coupling; each FEAT lands in own commit/slice.

**Tech Stack:** Bun 1.3+ test runner (Node 22.6 fallback), TypeScript with strip-types, ESM modules, agent prompts under `agents/*.md` (max 350 lines per `scripts/validate-agents.ts`), JSONL telemetry logs under `.claude/logs/` (gitignored).

**Spec:** [docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md](../specs/2026-06-11-slice-perf-2x-3x-design.md)

---

## File Structure

**New files (Phase 1):**
- `scripts/lib/dispatch-timing.ts` — per-dispatch JSONL writer
- `scripts/lib/bash-gate-timer.ts` — Bash tool PreToolUse/PostToolUse timer
- `scripts/lib/dispatch-timing-reader.ts` — aggregator for cost-report consumption
- `tests/dispatch-timing.test.ts`
- `tests/bash-gate-timer.test.ts`
- `tests/dispatch-timing-reader.test.ts`

**New files (Phase 2):**
- `scripts/lib/parallel-gates.ts` — emits parallel bash gate block
- `scripts/render-universal-skills.ts` — CI-gated build step
- `hooks/lib/check-task-update-burst.ts` — burst-detector hook core
- `hooks/check-task-update-burst.ts` — thin entry shim
- `tests/parallel-gates.test.ts`
- `tests/render-universal-skills.test.ts`
- `tests/check-task-update-burst.test.ts`
- `tests/check-redundant-read.test.ts` (extended with Edit-dedup cases)

**Modified files (Phase 1):**
- `scripts/crew.ts` — add per-dispatch breakdown section to `write-cost-report`
- `hooks/lib/check-subagent-return.ts` — add `recordDispatchEnd()` tap

**Modified files (Phase 2):**
- `agents/validator.md`, `agents/reviewer.md`, `agents/reviewer-validator.md` — parallel-gates wiring + bash hard caps
- All agent prompts (`agents/*.md`) — skill cap=3, pre-loaded universals section, TaskUpdate batching rule, Bash coalescing rule
- `hooks/lib/check-redundant-read.ts` — Edit verify-loop dedup extension
- `scripts/validate-agents.ts` — lint for batching + coalescing rules + universals hash drift

**Phase gate (between phases):**
- `.claude/artifacts/loop/baselines/phase-1-perf-baseline.md` — 3-slice baseline aggregate written manually after FEAT-149/150/151 collect 3 slices of data

---

## Phase 1 — Telemetry baseline

### Task 1: Dispatch-timing wrapper + JSONL writer (FEAT-149)

**Files:**
- Create: `scripts/lib/dispatch-timing.ts`
- Create: `tests/dispatch-timing.test.ts`
- Modify: `hooks/lib/check-subagent-return.ts` (add `recordDispatchEnd()` call)

- [ ] **Step 1.1: Write failing test for `recordDispatchStart` / `recordDispatchEnd` JSONL row shape**

```typescript
// tests/dispatch-timing.test.ts
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { recordDispatchStart, recordDispatchEnd } from "../scripts/lib/dispatch-timing.ts";

test("records start + end as single JSONL row with wallMs", async () => {
  const tmp = await fs.mkdtemp("/tmp/dispatch-timing-");
  const logPath = path.join(tmp, "dispatch-timing.jsonl");
  process.env.CREW_DISPATCH_TIMING_LOG = logPath;
  try {
    const handle = recordDispatchStart({
      runId: "run-1",
      sliceId: "SLICE-99",
      agent: "crew:builder",
      model: "claude-sonnet-4-6",
    });
    await new Promise(r => setTimeout(r, 25));
    recordDispatchEnd(handle, {
      toolCalls: { Read: 3, Edit: 1, Bash: 2 },
      bashDurationMs: 800,
      skillLoadCount: 1,
      tokenIn: 12000,
      tokenOut: 3500,
    });
    const raw = await fs.readFile(logPath, "utf-8");
    const rows = raw.trim().split("\n").map((l) => JSON.parse(l));
    expect(rows).toHaveLength(1);
    expect(rows[0].agent).toBe("crew:builder");
    expect(rows[0].wallMs).toBeGreaterThanOrEqual(25);
    expect(rows[0].toolCalls).toEqual({ Read: 3, Edit: 1, Bash: 2 });
  } finally {
    delete process.env.CREW_DISPATCH_TIMING_LOG;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
```

- [ ] **Step 1.2: Run test, verify FAIL**

Run: `bun test tests/dispatch-timing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement `scripts/lib/dispatch-timing.ts`**

```typescript
import { promises as fs } from "node:fs";
import path from "node:path";

export type DispatchStartMeta = {
  runId: string;
  sliceId: string;
  agent: string;
  model: string;
};

export type DispatchEndMeta = {
  toolCalls: Record<string, number>;
  bashDurationMs: number;
  skillLoadCount: number;
  tokenIn: number;
  tokenOut: number;
};

export type DispatchHandle = DispatchStartMeta & { startMs: number };

export function recordDispatchStart(meta: DispatchStartMeta): DispatchHandle {
  return { ...meta, startMs: Date.now() };
}

export function recordDispatchEnd(handle: DispatchHandle, end: DispatchEndMeta): void {
  const row = {
    runId: handle.runId,
    sliceId: handle.sliceId,
    agent: handle.agent,
    model: handle.model,
    startMs: handle.startMs,
    wallMs: Date.now() - handle.startMs,
    ...end,
  };
  const logPath = process.env.CREW_DISPATCH_TIMING_LOG
    || path.join(process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd(), ".claude", "logs", "dispatch-timing.jsonl");
  void fs.mkdir(path.dirname(logPath), { recursive: true })
    .then(() => fs.appendFile(logPath, JSON.stringify(row) + "\n", "utf-8"))
    .catch(() => undefined);
}
```

- [ ] **Step 1.4: Run test, verify PASS**

Run: `bun test tests/dispatch-timing.test.ts`
Expected: PASS.

- [ ] **Step 1.5: Tap `hooks/lib/check-subagent-return.ts`**

Add fire-and-forget `recordDispatchEnd` call when the hook handles a subagent return event. Read existing file first, locate the export, append a non-blocking tap. Keep the byte-identical contract: the spawn smoke for this hook must still pass.

- [ ] **Step 1.6: Run hook tests + full suite**

Run: `bun test tests/check-subagent-return.test.ts && bun test --parallel`
Expected: green.

- [ ] **Step 1.7: Commit**

```bash
git add scripts/lib/dispatch-timing.ts tests/dispatch-timing.test.ts hooks/lib/check-subagent-return.ts
git commit -m "feat(telemetry): FEAT-149 — dispatch-timing JSONL writer + hook tap"
```

---

### Task 2: Bash gate timer helper (FEAT-150)

**Files:**
- Create: `scripts/lib/bash-gate-timer.ts`
- Create: `tests/bash-gate-timer.test.ts`
- Modify: PreToolUse hook to call `startGateTimer`; PostToolUse hook to call `endGateTimer`

- [ ] **Step 2.1: Write failing test**

```typescript
// tests/bash-gate-timer.test.ts
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { startGateTimer, endGateTimer, classifyBashGate } from "../scripts/lib/bash-gate-timer.ts";

test("logs gate row for known patterns; ignores unknown bash", async () => {
  const tmp = await fs.mkdtemp("/tmp/bash-gate-timer-");
  process.env.CREW_BASH_GATE_LOG = path.join(tmp, "bash-gates.jsonl");
  try {
    expect(classifyBashGate("bun run typecheck")).toBe("typecheck");
    expect(classifyBashGate("ls -la")).toBeNull();
    const h = startGateTimer("bun run lint");
    await new Promise(r => setTimeout(r, 15));
    endGateTimer(h!, 0);
    const raw = await fs.readFile(process.env.CREW_BASH_GATE_LOG!, "utf-8");
    const row = JSON.parse(raw.trim());
    expect(row.gate).toBe("lint");
    expect(row.exitCode).toBe(0);
    expect(row.durationMs).toBeGreaterThanOrEqual(15);
  } finally {
    delete process.env.CREW_BASH_GATE_LOG;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2.2: Run test, verify FAIL**

Run: `bun test tests/bash-gate-timer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement `scripts/lib/bash-gate-timer.ts`**

```typescript
import { promises as fs } from "node:fs";
import path from "node:path";

const PATTERNS: Array<[RegExp, string]> = [
  [/\bbun (?:run )?lint\b/, "lint"],
  [/\bbun (?:run )?format:check\b/, "format:check"],
  [/\bbun (?:run )?typecheck\b/, "typecheck"],
  [/\bbun (?:run )?test\b/, "test"],
  [/\bbun audit\b/, "audit"],
  [/\bbun (?:run )?validate:all\b/, "validate:all"],
  [/\bnpm ci\b/, "npm-ci"],
];

export function classifyBashGate(cmd: string): string | null {
  for (const [re, gate] of PATTERNS) if (re.test(cmd)) return gate;
  return null;
}

export type GateHandle = { gate: string; startMs: number };

export function startGateTimer(cmd: string): GateHandle | null {
  const gate = classifyBashGate(cmd);
  if (!gate) return null;
  return { gate, startMs: Date.now() };
}

export function endGateTimer(handle: GateHandle, exitCode: number): void {
  const row = { gate: handle.gate, durationMs: Date.now() - handle.startMs, exitCode };
  const logPath = process.env.CREW_BASH_GATE_LOG
    || path.join(process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd(), ".claude", "logs", "bash-gates.jsonl");
  void fs.mkdir(path.dirname(logPath), { recursive: true })
    .then(() => fs.appendFile(logPath, JSON.stringify(row) + "\n", "utf-8"))
    .catch(() => undefined);
}
```

- [ ] **Step 2.4: Run test, verify PASS**

Run: `bun test tests/bash-gate-timer.test.ts`
Expected: PASS.

- [ ] **Step 2.5: Wire into PreToolUse + PostToolUse Bash hooks**

Locate existing PreToolUse/PostToolUse hook entries (check `hooks/` directory layout, follow SLICE-67 hook-core extraction pattern). Call `startGateTimer(cmd)` in PreToolUse, stash handle in a module-level Map keyed by event-id, call `endGateTimer(handle, exitCode)` in PostToolUse. Fire-and-forget; no blocking.

- [ ] **Step 2.6: Smoke test + commit**

```bash
bun test --parallel
git add scripts/lib/bash-gate-timer.ts tests/bash-gate-timer.test.ts hooks/
git commit -m "feat(telemetry): FEAT-150 — bash gate timer + PreToolUse/PostToolUse taps"
```

---

### Task 3: Cost-report per-dispatch breakdown section (FEAT-151)

**Files:**
- Create: `scripts/lib/dispatch-timing-reader.ts`
- Create: `tests/dispatch-timing-reader.test.ts`
- Modify: `scripts/crew.ts` (`write-cost-report` command)

- [ ] **Step 3.1: Write failing test for aggregator**

```typescript
// tests/dispatch-timing-reader.test.ts
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { aggregateDispatchTiming } from "../scripts/lib/dispatch-timing-reader.ts";

test("aggregates top-3 slowest + top-3 token-heaviest per runId", async () => {
  const tmp = await fs.mkdtemp("/tmp/agg-");
  const log = path.join(tmp, "dispatch-timing.jsonl");
  const rows = [
    { runId: "r1", agent: "crew:builder", wallMs: 5000, tokenIn: 10000, tokenOut: 2000, toolCalls: { Read: 3 }, bashDurationMs: 0, skillLoadCount: 0 },
    { runId: "r1", agent: "crew:reviewer", wallMs: 8000, tokenIn: 8000, tokenOut: 1500, toolCalls: {}, bashDurationMs: 1000, skillLoadCount: 1 },
    { runId: "r2", agent: "crew:lead", wallMs: 12000, tokenIn: 20000, tokenOut: 5000, toolCalls: {}, bashDurationMs: 0, skillLoadCount: 0 },
  ];
  await fs.writeFile(log, rows.map((r) => JSON.stringify(r)).join("\n"), "utf-8");
  const agg = await aggregateDispatchTiming(log, "r1");
  expect(agg.totalWallMs).toBe(13000);
  expect(agg.topSlow[0].agent).toBe("crew:reviewer");
  expect(agg.topTokens[0].agent).toBe("crew:builder");
  await fs.rm(tmp, { recursive: true, force: true });
});
```

- [ ] **Step 3.2: Run test, verify FAIL**

Run: `bun test tests/dispatch-timing-reader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement aggregator**

```typescript
// scripts/lib/dispatch-timing-reader.ts
import { promises as fs } from "node:fs";

export type DispatchRow = {
  runId: string;
  sliceId?: string;
  agent: string;
  model?: string;
  wallMs: number;
  tokenIn: number;
  tokenOut: number;
  toolCalls: Record<string, number>;
  bashDurationMs: number;
  skillLoadCount: number;
};

export type DispatchAggregate = {
  rowCount: number;
  totalWallMs: number;
  topSlow: DispatchRow[];
  topTokens: Array<DispatchRow & { totalTokens: number }>;
};

export async function aggregateDispatchTiming(logPath: string, runId: string): Promise<DispatchAggregate> {
  let raw = "";
  try { raw = await fs.readFile(logPath, "utf-8"); }
  catch { return { rowCount: 0, totalWallMs: 0, topSlow: [], topTokens: [] }; }
  const rows: DispatchRow[] = raw
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r: DispatchRow) => r.runId === runId);
  const totalWallMs = rows.reduce((s, r) => s + r.wallMs, 0);
  const topSlow = [...rows].sort((a, b) => b.wallMs - a.wallMs).slice(0, 3);
  const topTokens = rows
    .map((r) => ({ ...r, totalTokens: r.tokenIn + r.tokenOut }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 3);
  return { rowCount: rows.length, totalWallMs, topSlow, topTokens };
}
```

- [ ] **Step 3.4: Run test, verify PASS**

Run: `bun test tests/dispatch-timing-reader.test.ts`
Expected: PASS.

- [ ] **Step 3.5: Extend `scripts/crew.ts write-cost-report`**

Locate the `write-cost-report` command in `scripts/crew.ts`. Append a new section to the rendered Markdown when `process.env.CREW_COST_REPORT_DISPATCH_DETAIL !== "0"`:

```markdown
## Per-dispatch breakdown

- Total wall-clock: {totalWallMs/1000}s ({rowCount} dispatches)

### Top-3 slowest dispatches

| Agent | Model | wallMs | Read | Edit | Bash |
|-------|-------|--------|------|------|------|
| {agent} | {model} | {wallMs} | {Read} | {Edit} | {Bash} |

### Top-3 token-heaviest dispatches

| Agent | tokenIn | tokenOut | total |
|-------|---------|----------|-------|
| {agent} | {tokenIn} | {tokenOut} | {totalTokens} |

### Bash gate breakdown

| Gate | Duration (ms) | Exit |
|------|---------------|------|
| lint | ... | 0 |
```

Read from `.claude/logs/dispatch-timing.jsonl` + `.claude/logs/bash-gates.jsonl` for current runId.

- [ ] **Step 3.6: Add CLI test for cost-report section appearance**

Extend existing `tests/cli-synthesis-cost.test.ts` (or add a new test file) covering the new section.

- [ ] **Step 3.7: Run full suite + commit**

```bash
bun test --parallel
git add scripts/lib/dispatch-timing-reader.ts scripts/crew.ts tests/dispatch-timing-reader.test.ts tests/cli-synthesis-cost.test.ts
git commit -m "feat(cost-report): FEAT-151 — per-dispatch breakdown section"
```

---

## Phase gate — 3-slice baseline

After FEAT-149/150/151 land, run 3 normal slices, then write the baseline aggregate:

- [ ] **Step 4.1: Collect 3 slices of telemetry**

Run business-as-usual slice work for 3 slices. Confirm `dispatch-timing.jsonl` and `bash-gates.jsonl` have rows after each slice.

- [ ] **Step 4.2: Write baseline aggregate manually**

File: `.claude/artifacts/loop/baselines/phase-1-perf-baseline.md`

Aggregate median + p95 per agent role + bash gate. Include 7-dimension grade averages from those 3 slices for the quality regression detector.

- [ ] **Step 4.3: Phase 2 promotion check**

Confirm: top-3 slowest dispatches + total bash gate time ≥ 50% of slice wall-clock. If yes, promote Phase 2 FEATs from `triaged/` to `in-progress/` one by one. If no, re-design before Phase 2 work.

---

## Phase 2 — Cuts (gated)

### Task 5: Parallel bash gates (FEAT-152)

**Files:**
- Create: `scripts/lib/parallel-gates.ts`
- Create: `tests/parallel-gates.test.ts`
- Modify: `agents/validator.md`, `agents/reviewer.md`, `agents/reviewer-validator.md`

- [ ] **Step 5.1: Write failing test for parallel-gates helper emits correct block**

```typescript
// tests/parallel-gates.test.ts
import { test, expect } from "bun:test";
import { emitParallelGatesBlock, aggregateGateExitCodes } from "../scripts/lib/parallel-gates.ts";

test("emits parallel bash block with timeout + per-gate logs", () => {
  const block = emitParallelGatesBlock(["lint", "format:check", "typecheck"], { timeoutS: 60 });
  expect(block).toContain("( timeout 60 bun run lint");
  expect(block).toContain("wait");
  expect(block).toContain("mktemp");
});

test("aggregator OR's exit codes", () => {
  expect(aggregateGateExitCodes([0, 0, 0])).toBe(0);
  expect(aggregateGateExitCodes([0, 1, 0])).toBe(1);
});
```

- [ ] **Step 5.2: Run test, verify FAIL**

Run: `bun test tests/parallel-gates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement `scripts/lib/parallel-gates.ts`**

```typescript
const GATE_CMDS: Record<string, string> = {
  "lint": "bun run lint",
  "format:check": "bun run format:check",
  "typecheck": "bun run typecheck",
  "audit": "bun audit",
  "validate:all": "bun run validate:all",
};

export type GateOptions = { timeoutS?: number };

export function emitParallelGatesBlock(gates: string[], opts: GateOptions = {}): string {
  const timeoutS = opts.timeoutS ?? Number(process.env.CREW_BASH_GATE_TIMEOUT_S ?? "60");
  const lines: string[] = [
    "GATE_TMP=$(mktemp -d)",
    "declare -A GATE_LOG GATE_PID",
  ];
  for (const g of gates) {
    const cmd = GATE_CMDS[g];
    if (!cmd) throw new Error(`Unknown gate: ${g}`);
    lines.push(
      `GATE_LOG[${g}]="$GATE_TMP/${g.replace(/[^a-zA-Z0-9]/g, "_")}.log"`,
      `( timeout ${timeoutS} ${cmd} > "$\{GATE_LOG[${g}]}" 2>&1 ) &`,
      `GATE_PID[${g}]=$!`,
    );
  }
  lines.push(
    "GATE_EXIT=0",
    "for g in \"${!GATE_PID[@]}\"; do",
    "  wait \"${GATE_PID[$g]}\" || GATE_EXIT=$?",
    "  if [ $? -ne 0 ]; then",
    "    echo \"--- $g failed ---\"; tail -50 \"${GATE_LOG[$g]}\"",
    "  fi",
    "done",
    "rm -rf \"$GATE_TMP\"",
    "exit $GATE_EXIT",
  );
  return lines.join("\n");
}

export function aggregateGateExitCodes(codes: number[]): number {
  return codes.reduce((acc, c) => acc | c, 0);
}
```

- [ ] **Step 5.4: Run test, verify PASS**

Run: `bun test tests/parallel-gates.test.ts`
Expected: PASS.

- [ ] **Step 5.5: Wire into validator/reviewer agent prompts**

In `agents/validator.md`, locate the "Mandatory final gate" section. Replace the inline serial bash block with a callout: "Generate the parallel gate block via `bun run scripts/lib/parallel-gates.ts --emit lint,format:check,typecheck,audit,validate:all`, then execute the emitted block in a single Bash call." Repeat for `reviewer.md` (audit step) and `reviewer-validator.md`.

- [ ] **Step 5.6: Add CLI `--emit` arg to parallel-gates.ts so agent can call it as script**

```typescript
if (import.meta.main || (typeof process !== "undefined" && process.argv[1]?.endsWith("parallel-gates.ts"))) {
  const i = process.argv.indexOf("--emit");
  if (i >= 0) {
    const gates = (process.argv[i + 1] ?? "").split(",").filter(Boolean);
    process.stdout.write(emitParallelGatesBlock(gates));
  }
}
```

- [ ] **Step 5.7: Validate agent prompts + commit**

```bash
bun run scripts/validate-agents.ts && bun test --parallel
git add scripts/lib/parallel-gates.ts tests/parallel-gates.test.ts agents/validator.md agents/reviewer.md agents/reviewer-validator.md
git commit -m "feat(perf): FEAT-152 — parallel bash gates helper + validator/reviewer wiring"
```

---

### Task 6: Skill cap=3 + pre-rendered universals (FEAT-153)

**Files:**
- Create: `scripts/render-universal-skills.ts`
- Create: `tests/render-universal-skills.test.ts`
- Modify: all `agents/*.md` — inject `## Pre-loaded universals` section, drop skill cap from 4 → 3
- Modify: `scripts/validate-agents.ts` — hash-drift CI gate

- [ ] **Step 6.1: Write failing test for render script**

```typescript
// tests/render-universal-skills.test.ts
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { renderUniversals, checkUniversalsHash } from "../scripts/render-universal-skills.ts";

test("renderUniversals produces deterministic block under 35 lines", async () => {
  const out = await renderUniversals();
  expect(out.body.split("\n").length).toBeLessThanOrEqual(35);
  expect(out.hash).toMatch(/^[a-f0-9]{64}$/);
});

test("checkUniversalsHash detects drift", async () => {
  const tmp = await fs.mkdtemp("/tmp/agents-");
  const agentPath = path.join(tmp, "fake.md");
  await fs.writeFile(agentPath, "---\nname: fake\n---\n## Pre-loaded universals\n<!-- hash: deadbeef -->\nstale body\n", "utf-8");
  const result = await checkUniversalsHash(agentPath);
  expect(result.drift).toBe(true);
  await fs.rm(tmp, { recursive: true, force: true });
});
```

- [ ] **Step 6.2: Run test, verify FAIL**

Run: `bun test tests/render-universal-skills.test.ts`
Expected: FAIL.

- [ ] **Step 6.3: Implement render script**

Locate skill source paths (likely via `node_modules/.claude/plugins/...` or local `skills/`). Read three skills: `superpowers:using-superpowers`, `superpowers:verification-before-completion`, `loop:loop-discipline`. Compress each to its essential rules (≤10 lines each). Concatenate. Hash via SHA-256.

```typescript
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";

const UNIVERSAL_SKILLS: Array<{ name: string; locate: string[] }> = [
  { name: "using-superpowers", locate: ["skills/superpowers/using-superpowers.md"] },
  { name: "verification-before-completion", locate: ["skills/superpowers/verification-before-completion.md"] },
  { name: "loop-discipline", locate: ["skills/loop/loop-discipline.md"] },
];

export async function renderUniversals(): Promise<{ body: string; hash: string }> {
  const parts: string[] = ["## Pre-loaded universals", ""];
  for (const skill of UNIVERSAL_SKILLS) {
    parts.push(`### ${skill.name}`);
    // Compressed essentials — manually authored per skill. Keep ≤10 lines each.
    parts.push(...essentialsFor(skill.name));
    parts.push("");
  }
  const body = parts.join("\n");
  const hash = createHash("sha256").update(body).digest("hex");
  return { body: `${body}\n<!-- hash: ${hash} -->`, hash };
}

function essentialsFor(name: string): string[] {
  // Author per-skill essentials inline. Keep terse.
  switch (name) {
    case "using-superpowers": return [
      "- Invoke Skill tool for any skill that might apply (1% rule).",
      "- Process skills (brainstorming, debugging) first; implementation skills second.",
    ];
    case "verification-before-completion": return [
      "- Run verification command before claiming work passes.",
      "- Quote evidence; never assert without it.",
    ];
    case "loop-discipline": return [
      "- Slice ceremony non-negotiable: start → work → complete → grade.",
      "- Dispatch discipline: loop is orchestrator; hand work to crew:build subagent.",
    ];
    default: return [];
  }
}

export async function checkUniversalsHash(agentPath: string): Promise<{ drift: boolean; expected: string; found: string | null }> {
  const text = await fs.readFile(agentPath, "utf-8");
  const m = text.match(/<!-- hash: ([a-f0-9]{64}) -->/);
  const { hash } = await renderUniversals();
  return { drift: m?.[1] !== hash, expected: hash, found: m?.[1] ?? null };
}
```

- [ ] **Step 6.4: Run test, verify PASS**

Run: `bun test tests/render-universal-skills.test.ts`
Expected: PASS.

- [ ] **Step 6.5: Run render against all agents, inject Pre-loaded universals section**

```bash
bun run scripts/render-universal-skills.ts --inject agents/
```

Add the `--inject` flag to write the rendered block under a marker comment in each agent. Make idempotent.

- [ ] **Step 6.6: Drop skill cap to 3 in agent prompts**

In each agent prompt with a skill table (builder, reviewer, validator, architect, lead, etc.), change "max 4 per slice" / "4-skill cap" → "max 3 per slice" / "3-skill cap". Update the "5th skill = slice too wide" callout to "4th skill = slice too wide".

- [ ] **Step 6.7: Add CI hash-drift gate to validate-agents.ts**

```typescript
// In scripts/validate-agents.ts main loop
import { checkUniversalsHash } from "./render-universal-skills.ts";
for (const agentPath of agentFiles) {
  const { drift, expected, found } = await checkUniversalsHash(agentPath);
  if (drift) {
    errors.push(`${agentPath}: universals hash drift (found ${found ?? "none"}, expected ${expected}). Run: bun run scripts/render-universal-skills.ts --inject agents/`);
  }
}
```

- [ ] **Step 6.8: Run validate + full suite + commit**

```bash
bun run scripts/validate-agents.ts && bun test --parallel
git add scripts/render-universal-skills.ts tests/render-universal-skills.test.ts agents/*.md scripts/validate-agents.ts
git commit -m "feat(perf): FEAT-153 — skill cap=3 + pre-rendered universals + hash-drift CI gate"
```

---

### Task 7: Bash hard caps everywhere (FEAT-154)

**Files:**
- Modify: `agents/reviewer.md`, `agents/reviewer-validator.md`

- [ ] **Step 7.1: Read existing cap pattern from builder.md**

Run: `grep -B1 -A1 "timeout 60" agents/builder.md`
Expected: see the pattern as referenced in commit 765c53c.

- [ ] **Step 7.2: Apply same pattern to reviewer.md**

In every bash block that runs lint/typecheck/test/audit, wrap with `timeout ${CREW_BASH_GATE_TIMEOUT_S:-60} <cmd> || echo "TIMEOUT"`.

- [ ] **Step 7.3: Apply same pattern to reviewer-validator.md**

Same as above.

- [ ] **Step 7.4: Validate + commit**

```bash
bun run scripts/validate-agents.ts
git add agents/reviewer.md agents/reviewer-validator.md
git commit -m "feat(perf): FEAT-154 — bash hard caps in reviewer + reviewer-validator"
```

---

### Task 8: TaskUpdate batching + burst-detector hook (FEAT-155)

**Files:**
- Create: `hooks/lib/check-task-update-burst.ts`
- Create: `hooks/check-task-update-burst.ts` (entry shim)
- Create: `tests/check-task-update-burst.test.ts`
- Modify: `agents/builder.md`, `agents/lead.md`, `agents/reviewer.md`, `agents/validator.md`, `agents/architect.md`, plus doc-writer if present
- Modify: `scripts/validate-agents.ts` — lint for batching rule presence

- [ ] **Step 8.1: Write failing test for burst-detector hook core**

```typescript
// tests/check-task-update-burst.test.ts
import { test, expect } from "bun:test";
import { runCheckTaskUpdateBurst } from "../hooks/lib/check-task-update-burst.ts";

test("logs warning when ≥3 TaskUpdate calls in single turn without intervening tools", async () => {
  const events = [
    { tool: "TaskUpdate", ts: 1 },
    { tool: "TaskUpdate", ts: 2 },
    { tool: "TaskUpdate", ts: 3 },
  ];
  const result = await runCheckTaskUpdateBurst(JSON.stringify({ events }), { CREW_TASK_UPDATE_BURST_LOG: "/tmp/burst.jsonl" });
  expect(result).toContain("burst");
});

test("no warning when TaskUpdates are interleaved with other tools", async () => {
  const events = [
    { tool: "TaskUpdate", ts: 1 },
    { tool: "Bash", ts: 2 },
    { tool: "TaskUpdate", ts: 3 },
  ];
  const result = await runCheckTaskUpdateBurst(JSON.stringify({ events }), {});
  expect(result).toBeNull();
});
```

- [ ] **Step 8.2: Run test, verify FAIL; implement hook core; verify PASS**

```typescript
// hooks/lib/check-task-update-burst.ts
import { promises as fs } from "node:fs";

export async function runCheckTaskUpdateBurst(raw: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  const { events } = JSON.parse(raw) as { events: Array<{ tool: string; ts: number }> };
  let streak = 0;
  for (const e of events) streak = e.tool === "TaskUpdate" ? streak + 1 : 0;
  if (streak >= 3) {
    const logPath = env.CREW_TASK_UPDATE_BURST_LOG || ".claude/logs/task-update-bursts.jsonl";
    await fs.mkdir(logPath.split("/").slice(0, -1).join("/"), { recursive: true }).catch(() => undefined);
    await fs.appendFile(logPath, JSON.stringify({ ts: Date.now(), streak }) + "\n", "utf-8").catch(() => undefined);
    return `warning: TaskUpdate burst detected (${streak} consecutive). Batch completed markers; keep in_progress immediate.`;
  }
  return null;
}
```

Entry shim:
```typescript
// hooks/check-task-update-burst.ts
import { runCheckTaskUpdateBurst } from "./lib/check-task-update-burst.ts";
let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (c) => { raw += c; });
process.stdin.on("end", async () => {
  const out = await runCheckTaskUpdateBurst(raw, process.env);
  if (out) process.stdout.write(out);
});
```

Run: `bun test tests/check-task-update-burst.test.ts`
Expected: PASS.

- [ ] **Step 8.3: Add batching rule to agent prompts**

In each affected agent prompt, add a `### TaskUpdate batching` row under the Conventions or Tool usage section:

> Batch `TaskUpdate` calls. Send `in_progress` for the current task immediately. Coalesce `completed` markers at logical sequence boundaries — don't fire one per task in a tight loop. Never run ≥3 TaskUpdate calls back-to-back without intervening work.

- [ ] **Step 8.4: Add lint to validate-agents.ts**

Lint flags any primary agent prompt missing the phrase "Batch `TaskUpdate`" or equivalent.

- [ ] **Step 8.5: Full suite + commit**

```bash
bun run scripts/validate-agents.ts && bun test --parallel
git add hooks/lib/check-task-update-burst.ts hooks/check-task-update-burst.ts tests/check-task-update-burst.test.ts agents/*.md scripts/validate-agents.ts
git commit -m "feat(perf): FEAT-155 — TaskUpdate batching rule + burst-detector hook"
```

---

### Task 9: Edit verify-loop dedup hook extension (FEAT-156)

**Files:**
- Modify: `hooks/lib/check-redundant-read.ts`
- Modify: `tests/check-redundant-read.test.ts` (add Edit-dedup cases)

- [ ] **Step 9.1: Write failing test cases**

```typescript
// In tests/check-redundant-read.test.ts (extend existing)
test("blocks re-Read of file within 5 tool calls of successful Edit (no mtime change)", async () => {
  const tmp = await fs.mkdtemp("/tmp/edit-dedup-");
  const f = path.join(tmp, "x.ts");
  await fs.writeFile(f, "v1", "utf-8");
  const events = [
    { tool: "Edit", file: f, success: true, ts: 1000 },
    { tool: "Bash", ts: 1100 },
    { tool: "Read", file: f, ts: 1200 },
  ];
  const result = await runCheckRedundantRead(JSON.stringify({ events, currentRead: { file: f, ts: 1200 } }), {});
  expect(result).toContain("deny");
  expect(result).toContain("just Edit");
  await fs.rm(tmp, { recursive: true, force: true });
});

test("allows re-Read when mtime > Edit timestamp (external modification)", async () => {
  const tmp = await fs.mkdtemp("/tmp/edit-dedup-mtime-");
  const f = path.join(tmp, "x.ts");
  await fs.writeFile(f, "v1", "utf-8");
  const editTs = Date.now() - 5000;
  await fs.utimes(f, new Date(), new Date(Date.now())); // touch
  const events = [
    { tool: "Edit", file: f, success: true, ts: editTs },
    { tool: "Read", file: f, ts: Date.now() },
  ];
  const result = await runCheckRedundantRead(JSON.stringify({ events, currentRead: { file: f, ts: Date.now() } }), {});
  expect(result).toBeNull();
  await fs.rm(tmp, { recursive: true, force: true });
});

test("allows re-Read when force:true flag set", async () => {
  const result = await runCheckRedundantRead(JSON.stringify({
    events: [{ tool: "Edit", file: "/x", success: true, ts: 1000 }],
    currentRead: { file: "/x", ts: 1050, force: true },
  }), {});
  expect(result).toBeNull();
});
```

- [ ] **Step 9.2: Run tests, verify FAIL**

Run: `bun test tests/check-redundant-read.test.ts`
Expected: 3 new FAILs.

- [ ] **Step 9.3: Extend hook core**

Add Edit/Write event tracking + mtime check + force escape in `hooks/lib/check-redundant-read.ts`. Per-file last-successful-Edit timestamp + tool-call count distance. Block window = 5 tool calls.

- [ ] **Step 9.4: Run tests, verify PASS + full suite + commit**

```bash
bun test --parallel
git add hooks/lib/check-redundant-read.ts tests/check-redundant-read.test.ts
git commit -m "feat(perf): FEAT-156 — Edit verify-loop dedup hook (mtime + force escape)"
```

---

### Task 10: Bash call coalescing rule + lint (FEAT-157)

**Files:**
- Modify: all primary agent prompts (builder, builder-be, builder-fe, lead, reviewer, validator, architect, deployer, integrator, researcher)
- Modify: `scripts/validate-agents.ts`

- [ ] **Step 10.1: Add coalescing rule to agent prompts**

Under the Conventions section in each primary agent prompt, add:

> **Coalesce Bash calls.** Prefer chained commands (`cmd1 && cmd2 && cmd3`) over separate sequential Bash invocations when commands are related and don't need intermediate model reasoning. Example: combine `git status && git diff --stat && git log --oneline -5` into one Bash call, not three. **Carve-out:** use separate Bash calls when each result drives the next decision; chain only when commands are pure data collection or all-or-nothing.

- [ ] **Step 10.2: Add lint to validate-agents.ts**

Lint flags any primary agent prompt missing the phrase "Coalesce Bash" or equivalent. Test the lint against a doctored agent file in a temp directory.

- [ ] **Step 10.3: Validate + commit**

```bash
bun run scripts/validate-agents.ts && bun test --parallel
git add agents/*.md scripts/validate-agents.ts
git commit -m "feat(perf): FEAT-157 — Bash call coalescing rule + lint"
```

---

## Quality regression gate (run after Phase 2 complete)

- [ ] **Step 11.1: Compare 3 post-Phase-2 grades vs Phase 1 baseline**

Read 3 most recent `.claude/artifacts/loop/grades/*.md`. For each of 7 dimensions, compute mean. Compare to baseline mean from `phase-1-perf-baseline.md`. Any dimension dropping >0.05 → write `escalated_to_lead` workflow badge with affected lever id; halt further Phase 2 work.

- [ ] **Step 11.2: Confirm wall-clock 2-3x improvement**

Read 3 most recent cost reports. Confirm total slice wall-clock ≥2x faster than Phase 1 baseline median.

- [ ] **Step 11.3: Confirm hang frequency drop**

```bash
grep -c '"TIMEOUT"' .claude/logs/bash-gates.jsonl
```
Expected: ≤ 0.5 × Phase 1 baseline TIMEOUT count.

---

## Self-Review

- **Spec coverage:** All 9 FEATs from the spec FEAT decomposition table have a corresponding Task. Phase gate explicit. Quality regression detector covered.
- **Placeholders:** none — all code blocks complete, all commands explicit.
- **Type consistency:** `DispatchHandle`, `DispatchRow`, `GateHandle` defined where used. `recordDispatchStart` / `recordDispatchEnd` signatures consistent across Task 1 and Task 3.
- **No skipped TDD:** every implementation task has explicit FAIL → implement → PASS sequence.

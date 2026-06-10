# Test/CI Wall-Clock + Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the 577-test suite from ~113s to ≤60s and reduce maintenance burden (spawn-heavy hook tests, duplicated cost fixtures, over-cap agent prompts) with zero net coverage loss.

**Architecture:** Four independent work packages. WP1 splits the cli.test.ts monolith so Node's file-level parallelism can bite. WP2 extracts each hook's flow into an importable core function (`hooks/lib/`) so tests run in-process instead of spawning `node --experimental-strip-types` per test; thin entry shims keep the runtime contract byte-identical. WP3 extracts shared cost-test fixtures. WP4 relocates agent-prompt specifics into skills to get under the 300-line governance cap.

**Tech Stack:** Node 22.6+ `node:test` runner, `--experimental-strip-types` TS, ESM with explicit `.ts` import specifiers. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-10-test-ci-wallclock-maintenance-design.md`

**Conservative rule (binding):** No assertion deleted unless a kept assertion provably covers it; every merge/removal listed in the WP handoff. `hook-feature-gating.test.ts` stays fully spawn-based as the runtime-contract proof.

**Verification gates after every task:** `npm test` green, `npm run lint` zero warnings, `npm run format:check`, `npm run typecheck`. Commit only when all pass.

---

## WP1 — Measure, then parallelize

### Task 1: Capture baseline timings

**Files:**
- Create: `.claude/artifacts/crew/validations/2026-06-10-wp1-baseline-timings.md` (scratch evidence; committed)

- [ ] **Step 1: Run the suite with per-file timing**

Run (PowerShell):
```powershell
npm test -- --test-reporter=spec 2>&1 | Tee-Object -FilePath wp1-baseline.txt | Select-Object -Last 12
```
Expected: 577 pass, 0 fail, `duration_ms` ≈ 113000.

- [ ] **Step 2: Extract the top-10 slowest files**

Run:
```powershell
Select-String -Path wp1-baseline.txt -Pattern '^\S+\.test\.ts.*\(\d+(\.\d+)?ms\)' | Sort-Object { [double]($_.Matches[0].Value -replace '.*\((\d+\.?\d*)ms\).*','$1') } -Descending | Select-Object -First 10
```
If the spec reporter doesn't emit per-file totals on this Node version, instead time each file individually:
```powershell
Get-ChildItem tests/*.test.ts | ForEach-Object { $t = Measure-Command { node --test --experimental-strip-types $_.FullName *> $null }; "{0}`t{1:n1}s" -f $_.Name, $t.TotalSeconds } | Sort-Object { [double]($_ -split "`t")[1].TrimEnd('s') } -Descending
```

- [ ] **Step 3: Record results**

Write the total duration + top-10 table into `.claude/artifacts/crew/validations/2026-06-10-wp1-baseline-timings.md`. Note machine context (Windows, core count from `[Environment]::ProcessorCount`). Delete `wp1-baseline.txt` (do not commit it).

- [ ] **Step 4: Commit**

```bash
git add .claude/artifacts/crew/validations/2026-06-10-wp1-baseline-timings.md
git commit -m "chore(wp1): baseline test-suite timings before parallelization"
```

### Task 2: Extract shared CLI test fixtures

`tests/cli.test.ts` (1,697 lines, 33 tests, 129 `execFile` calls) is the slowest file; Node parallelizes across *files*, so one monolith serializes ~30-60s of subprocess work. First extract its shared helpers so the split files can import them.

**Files:**
- Create: `tests/helpers/cli-fixtures.ts`
- Modify: `tests/cli.test.ts:1-16,1141`

- [ ] **Step 1: Create the helper module**

Move (verbatim) the header helpers from `tests/cli.test.ts` into `tests/helpers/cli-fixtures.ts`:

```ts
// tests/helpers/cli-fixtures.ts — shared fixtures for the split CLI test files.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const execFile = promisify(execFileCallback);
export const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const cliPath = path.join(repoRoot, "scripts", "crew.ts");

export async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Run the crew CLI with --experimental-strip-types; returns { stdout, stderr }. */
export function runCrew(args: string[], opts: { cwd?: string } = {}) {
  return execFile("node", ["--experimental-strip-types", cliPath, ...args], opts);
}
```

NOTE the extra `path.dirname` — the helper lives one level deeper (`tests/helpers/`) than `tests/`, so `repoRoot` needs three dirname hops, not two. Also move `loadState` (currently `tests/cli.test.ts:1141`) into the helper and export it verbatim.

- [ ] **Step 2: Point cli.test.ts at the helper**

In `tests/cli.test.ts` delete the moved definitions and replace the header with:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile, cliPath, makeTempDir, loadState } from "./helpers/cli-fixtures.ts";
```

Keep `os`/`url`/`promisify` imports only if still referenced (they should not be).

- [ ] **Step 3: Verify**

Run: `node --test --experimental-strip-types tests/cli.test.ts`
Expected: 33 pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/cli-fixtures.ts tests/cli.test.ts
git commit -m "refactor(wp1): extract shared CLI test fixtures to tests/helpers"
```

### Task 3: Split cli.test.ts into four files

Pure mechanical move — every `test(...)` block moves verbatim; each new file gets the Task 2 import header. Seams (line numbers from the pre-Task-2 file; adjust after Task 2's deletions):

| New file | Tests moved (by name prefix / original lines) |
|---|---|
| `tests/cli-init-claims.test.ts` | init (18), bootstrap (39), claim/release (60), approvals (118), subcommand help (1095), install-global (1107) |
| `tests/cli-artifacts.test.ts` | artifact writers (177), write-* frontmatter (1373), cost-advise (1434), cost-slice (1479), write-handoff ±repo-context (1505, 1528), write-review-result ×3 (1548, 1581, 1607), write-validation-result (1637), write-deployment-check (1667) |
| `tests/cli-briefing.test.ts` | wake-up brief (368), brief-me ×3 (537, 637, 655), brief-me blocked badges (1273), routingTableStale ×2 (1313, 1345) |
| `tests/cli-workflow.test.ts` | workflow state gates (703), missing write-backs (854), missing run briefs (907), blocks final synthesis (947), external-deltas ×2 (1019, 1051), mark-badge ×2 (1149, 1182), final-synthesis escalated/--force (1215) |

**Files:**
- Create: `tests/cli-init-claims.test.ts`, `tests/cli-artifacts.test.ts`, `tests/cli-briefing.test.ts`, `tests/cli-workflow.test.ts`
- Delete: `tests/cli.test.ts`

- [ ] **Step 1: Create the four files** — each starts with the Task 2 Step 2 import header; paste test blocks verbatim per the table. `loadState` import only where used (workflow file).

- [ ] **Step 2: Delete `tests/cli.test.ts`** once all 33 tests are relocated. Verify none lost:

Run: `grep -c "^test(" tests/cli-init-claims.test.ts tests/cli-artifacts.test.ts tests/cli-briefing.test.ts tests/cli-workflow.test.ts`
Expected: counts summing to 33.

- [ ] **Step 3: Run the four files**

Run: `node --test --experimental-strip-types tests/cli-init-claims.test.ts tests/cli-artifacts.test.ts tests/cli-briefing.test.ts tests/cli-workflow.test.ts`
Expected: 33 pass, 0 fail.

- [ ] **Step 4: Full gates** — `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`. All green.

- [ ] **Step 5: Commit**

```bash
git add tests/cli-*.test.ts
git rm tests/cli.test.ts
git commit -m "refactor(wp1): split cli.test.ts into 4 files along command-group seams"
```

### Task 4: Tune concurrency and re-measure

- [ ] **Step 1: Check default parallelism is active** — Node runs test files concurrently at `availableParallelism() - 1` by default. Make it explicit and pin it in `package.json`:

```json
"test": "node --test --experimental-strip-types --test-concurrency=6",
```

Pick `min(6, cores - 2)` based on the Task 1 core count. Rationale comment not needed in JSON; record the choice in the WP1 handoff.

- [ ] **Step 2: Safety audit** — confirm the four new cli files and the other subprocess-heavy files share no cwd/temp state: every fixture uses `mkdtemp` with a unique prefix (Task 1 evidence file lists any exceptions; if a test writes to the repo root or a shared path, mark that file `--test-concurrency` hostile and leave a note — do NOT enable in-file concurrency for it).

- [ ] **Step 3: Re-measure**

Run: `npm test 2>&1 | Select-Object -Last 12`
Expected: 577 pass; `duration_ms` materially below baseline (target ≤80s after WP1 alone).

- [ ] **Step 4: Append before/after to the Task 1 evidence file, commit**

```bash
git add package.json .claude/artifacts/crew/validations/2026-06-10-wp1-baseline-timings.md
git commit -m "perf(wp1): explicit test concurrency + post-split timings"
```

---

## WP2 — Hook-logic extraction

All 4 hooks already delegate domain logic to `scripts/lib/*` (cost-hygiene, preflight/checks, subagent-return/check). What remains hook-local — stdin parsing, env gating, config gating, flow — is only testable today by spawning a Node process (~120 spawn-based tests, ~0.3-0.6s each on Windows). Extract each hook's flow into a core function with one unified signature:

```ts
export async function run<Name>Hook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null>
```

`raw` is the stdin JSON; the return value is the exact stdout payload (or `null` for no output). All fs side effects (event logs, session state) stay real — tests pass a `mkdtemp` dir as `cwd` inside the payload. Entry shims keep stdout hygiene and exit semantics byte-identical. No `process.exit` in lib code (repo rule 6).

### Task 5: Extract preflight-shell core

**Files:**
- Create: `hooks/lib/preflight-shell.ts`
- Modify: `hooks/preflight-shell.ts` (becomes shim)
- Test: `tests/preflight-shell.test.ts`

- [ ] **Step 1: Write a failing in-process test** — add at the top of `tests/preflight-shell.test.ts` (keep the existing spawn helper for now):

```ts
import { runPreflightShellHook } from "../hooks/lib/preflight-shell.ts";

test("in-process: Bash with $env:HOME returns approve+warn payload", async () => {
  const out = await runPreflightShellHook(
    makeStdin("Bash", "echo $env:HOME", process.cwd()),
    { ...process.env, CREW_TOOL_PREFLIGHT: "" }
  );
  assert.notEqual(out, null);
  const parsed = JSON.parse(out as string);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /\$env:/);
});
```

Run: `node --test --experimental-strip-types tests/preflight-shell.test.ts`
Expected: FAIL — `Cannot find module '../hooks/lib/preflight-shell.ts'`.

- [ ] **Step 2: Create the core** — `hooks/lib/preflight-shell.ts`. `logEvent` and `parseInput` move verbatim from the current hook (imports adjusted to `../../scripts/...`):

```ts
// Core flow for the preflight-shell hook. No stdin/stdout/process.exit — the
// hooks/preflight-shell.ts shim owns process I/O.
import fs from "node:fs/promises";
import path from "node:path";
import { runChecks } from "../../scripts/lib/preflight/checks.ts";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";

async function logEvent(repoPath: string, code: string, sessionId: string, detail: string): Promise<void> {
  /* moved verbatim from hooks/preflight-shell.ts:9-23 */
}

function parseInput(raw: string): { session_id: string; tool_name: string; command: string; cwd: string } | null {
  /* moved verbatim from hooks/preflight-shell.ts:25-49 */
}

export async function runPreflightShellHook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.CREW_TOOL_PREFLIGHT === "0") return null;
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, tool_name, command, cwd } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("shell-preflight", config)) return null;
  let warnings: string[];
  try {
    const result = await runChecks({ toolName: tool_name, command, cwd });
    warnings = result.warnings;
  } catch (err) {
    await logEvent(cwd, "check-error", session_id, String(err));
    return null;
  }
  if (warnings.length > 0) {
    return JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") });
  }
  return null;
}
```

(The `/* moved verbatim */` bodies are literal copies of the cited line ranges — copy them, do not retype.)

- [ ] **Step 3: Reduce the hook to a shim** — replace `hooks/preflight-shell.ts` entirely with:

```ts
#!/usr/bin/env node
// PreToolUse hook on Bash and PowerShell. Env-var gated (default ON). Always exits 0.
import { runPreflightShellHook } from "./lib/preflight-shell.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_TOOL_PREFLIGHT === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const out = await runPreflightShellHook(raw, process.env);
  if (out !== null) process.stdout.write(out);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "preflight-shell", err);
  process.exit(0);
});
```

- [ ] **Step 4: Run** `node --test --experimental-strip-types tests/preflight-shell.test.ts` — in-process test passes AND all existing spawn tests still pass (shim contract intact).

- [ ] **Step 5: Convert the spawn tests in-place** — replace the file's `runHook` helper body so every existing assertion runs in-process unchanged:

```ts
async function runHook(
  stdin: string,
  env: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const out = await runPreflightShellHook(stdin, { ...process.env, ...env });
  return { exitCode: 0, stdout: out ?? "", stderr: "" };
}
```

Keep exactly two spawn-based tests in this file, retitled `smoke: shim …` — AC-6b (truly-unset env, which needs a real process env) and one warn-path test (AC-7a duplicated as a spawn smoke, proving stdin→stdout wiring). All other tests now call the core.

- [ ] **Step 6: Full gates, then commit**

```bash
git add hooks/lib/preflight-shell.ts hooks/preflight-shell.ts tests/preflight-shell.test.ts
git commit -m "perf(wp2): extract preflight-shell core; in-process tests + spawn smokes"
```

### Task 6: Extract check-subagent-return core

Same shape as Task 5. **Files:** Create `hooks/lib/check-subagent-return.ts`; Modify `hooks/check-subagent-return.ts`; Test `tests/subagent-return.test.ts` (40 tests — biggest single win).

- [ ] **Step 1: Failing in-process test** — body returning an oversized return without an artifact path must yield a warn payload; mirror an existing assertion from `tests/subagent-return.test.ts` against `runCheckSubagentReturnHook(raw, env)`. Run the file; expected FAIL (module not found).

- [ ] **Step 2: Core** — `hooks/lib/check-subagent-return.ts`: move `logEvent` (hook lines 11-25), `extractBody` (27-44), `parseInput` (46-71) verbatim; export:

```ts
export async function runCheckSubagentReturnHook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.CREW_SUBAGENT_INLINE_THRESHOLD === "0") return null;
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, body } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("subagent-inline-warn", config)) return null;
  const threshold = parseThreshold(env.CREW_SUBAGENT_INLINE_THRESHOLD);
  const { warnings } = checkSubagentReturn({ body, threshold });
  if (warnings.length > 0) {
    await logEvent(cwd, "inline-return-warn", session_id, warnings[0] ?? "");
    return JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") });
  }
  return null;
}
```

Imports: `parseThreshold`, `checkSubagentReturn` from `../../scripts/lib/subagent-return/check.ts`; `isEnabled`, `readCrewConfig` from `../../scripts/lib/features-service.ts`.

- [ ] **Step 3: Shim** — `hooks/check-subagent-return.ts` mirrors the Task 5 Step 3 shim: env gate `CREW_SUBAGENT_INLINE_THRESHOLD === "0"` → `stdin.resume()`; else read stdin → `runCheckSubagentReturnHook` → write non-null output; same `main().catch(logHookError(..., "check-subagent-return"))` tail.

- [ ] **Step 4: Convert `tests/subagent-return.test.ts`** — same in-place `runHook` helper swap as Task 5 Step 5. Keep two spawn smokes (one gated-off, one warn-path).

- [ ] **Step 5: Full gates, commit** — `git commit -m "perf(wp2): extract check-subagent-return core; in-process tests"`

### Task 7: Extract check-redundant-read core

**Files:** Create `hooks/lib/check-redundant-read.ts`; Modify `hooks/check-redundant-read.ts`; Test `tests/cost-hygiene-hook.test.ts`.

- [ ] **Step 1: Failing in-process test** mirroring an existing warn-path assertion against `runCheckRedundantReadHook(raw, env)`; FAIL (module not found).

- [ ] **Step 2: Core** — move `logEvent` (16-30), `parseInput` (32-54), `readFileStat` (62-69), `loadState` (71-82), `persistState` (84-95) verbatim; export:

```ts
export async function runCheckRedundantReadHook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.CREW_COST_HYGIENE === "0") return null;
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, file_path, cwd } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("redundant-read-stop", config)) return null;
  const absPath = path.resolve(cwd, file_path);
  const fileStat = await readFileStat(absPath);
  if (fileStat === null) return null;
  const { mtimeIso, size } = fileStat;
  const state = await loadState(cwd, session_id, (msg) => logEvent(cwd, "state-load-fail", session_id, msg));
  if (state === null) return null;
  const stored = state.entries[absPath] ?? null;
  const result = decide({ path: absPath, storedEntry: stored, currentMtime: mtimeIso, currentSize: size, now: new Date().toISOString() });
  const out = result.action === "warn" && result.message !== null
    ? JSON.stringify({ decision: "approve", systemMessage: result.message })
    : null;
  const updated = evictLRU(recordRead(state, absPath, mtimeIso, size, new Date().toISOString()), absPath);
  await persistState(updated, cwd, session_id, (msg) => logEvent(cwd, "state-write-fail", session_id, msg));
  return out;
}
```

NOTE the ordering nuance: the current hook writes stdout *before* persisting state; the core computes `out` at the same point but returns after persist — observable behavior identical because the shim writes only after the promise resolves anyway, and state-persist happens in both orders. Imports: state fns from `../../scripts/lib/cost-hygiene/state.ts`, `decide` from `../../scripts/lib/cost-hygiene/decide.ts`, features-service as above.

- [ ] **Step 3: Shim** — env gate `CREW_COST_HYGIENE === "0"` → `stdin.resume()`; tail catch logs `"check-redundant-read"` and (matching current behavior) calls `process.stdin.resume()` before `logHookError`, no `process.exit`.

- [ ] **Step 4: Convert `tests/cost-hygiene-hook.test.ts`** in-place runHook swap; keep two spawn smokes.

- [ ] **Step 5: Full gates, commit** — `git commit -m "perf(wp2): extract check-redundant-read core; in-process tests"`

### Task 8: Extract record-read-content core

**Files:** Create `hooks/lib/record-read-content.ts`; Modify `hooks/record-read-content.ts`; Test: the record-read assertions live in `tests/cost-hygiene-state.test.ts` / `tests/cost-hygiene-hook.test.ts` — locate with `grep -l "record-read-content" tests/`.

- [ ] **Step 1: Failing in-process test** asserting state file updated after `runRecordReadContentHook(raw, env)` with a temp cwd; FAIL (module not found).

- [ ] **Step 2: Core** — move `logEvent` (14-28), `parseInput` (30-56), `loadState` (64-75) verbatim; export:

```ts
export async function runRecordReadContentHook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.CREW_COST_HYGIENE === "0") return null;
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, file_path, content, cwd } = input;
  const absPath = path.resolve(cwd, file_path);
  const state = await loadState(cwd, session_id, (msg) => logEvent(cwd, "state-load-fail", session_id, msg));
  if (state === null) return null;
  const updated = evictLRU(recordReadContent(state, absPath, content), absPath);
  try {
    await saveSession(cwd, session_id, updated);
  } catch (err) {
    await logEvent(cwd, "state-write-fail", session_id, String(err));
  }
  return null;
}
```

This replaces the current mid-flow `process.exit(0)` calls with returns — same observable contract (exit 0, no stdout), now repo-rule-6 compliant.

- [ ] **Step 3: Shim** — same shape; gate `CREW_COST_HYGIENE === "0"` exits via plain `return` after `stdin.resume()`; catch tail logs `"record-read-content"` then `process.exit(0)` (entry-level exit is allowed).

- [ ] **Step 4: Convert affected tests; keep one spawn smoke** (this hook has no stdout — smoke asserts exit 0 + state file written).

- [ ] **Step 5: Full gates, commit** — `git commit -m "perf(wp2): extract record-read-content core; in-process tests"`

### Task 9: WP2 re-measure + handoff

- [ ] **Step 1:** `npm test 2>&1 | Select-Object -Last 12` — expected: same test count ±new in-process additions, 0 fail, duration target ≤60s.
- [ ] **Step 2:** Confirm `tests/hook-feature-gating.test.ts` untouched (`git diff --stat main -- tests/hook-feature-gating.test.ts` → empty).
- [ ] **Step 3:** Append WP2 before/after timings + list of retained spawn smokes (file + test name) to the Task 1 evidence file; commit `chore(wp2): record post-extraction timings`.

---

## WP3 — Cost-test consolidation

### Task 10: Extract shared cost fixtures

**Files:**
- Create: `tests/helpers/cost-fixtures.ts`
- Modify: `tests/briefing-cost-health.test.ts`

- [ ] **Step 1: Create the helper** — move verbatim from `tests/briefing-cost-health.test.ts` and export: `makeTempRepo` (lines 17-38), `makeCostReportText` (39-…), `makeSliceVariantText` (300-…), `makeAggregateVariantText` (345-…), `makeTempRepoWithVariants` (392-…). Add the `node:fs/promises`, `node:os`, `node:path` imports they need. No logic changes — this is a cut-paste-export.

- [ ] **Step 2: Point `briefing-cost-health.test.ts` at the helper** — delete the moved definitions, add `import { makeTempRepo, makeCostReportText, makeSliceVariantText, makeAggregateVariantText, makeTempRepoWithVariants } from "./helpers/cost-fixtures.ts";`

- [ ] **Step 3:** Run `node --test --experimental-strip-types tests/briefing-cost-health.test.ts` — 17 pass.

- [ ] **Step 4: Commit** — `git commit -m "refactor(wp3): extract shared cost-test fixtures"`

### Task 11: Migrate the remaining cost files + dupe audit

The 9 cost files: `briefing-cost-health`, `briefing-cost-rollup-dedupe`, `collect-model-compliance`, `cost-advisor-grade`, `cost-advisor-trends`, `cost-hygiene-hook`, `cost-hygiene-state`, `cost-report-emission`, `cost-report-role-breakdown`.

- [ ] **Step 1: Find local fixture clones**

Run: `grep -n "mkdtemp\|function make" tests/briefing-cost-rollup-dedupe.test.ts tests/collect-model-compliance.test.ts tests/cost-advisor-grade.test.ts tests/cost-advisor-trends.test.ts tests/cost-hygiene-state.test.ts tests/cost-report-emission.test.ts tests/cost-report-role-breakdown.test.ts`

- [ ] **Step 2: Replace clones with helper imports** — only where the local function is signature-identical or a trivial parameterization of the helper (e.g. a `makeTempRepo` that only differs in tmpdir prefix → add an optional `prefix` param to the helper instead). Where a local fixture genuinely differs (e.g. `cost-report-emission`'s `makeSingleSourceCost`/`makeMultiSourceCost` build `CostBreakdown` objects, not report text), leave it — it is not a dupe.

- [ ] **Step 3: Duplicate-test audit** — for each pair of files covering the same module (`grep -n "^import.*scripts/lib" tests/cost-*.test.ts tests/briefing-cost-*.test.ts` and compare), list any test asserting the identical behavior on identical inputs. Merge ONLY provable duplicates (same module function, same input shape, same assertion); record each merged pair as `kept-test ← removed-test` in the WP3 handoff section of the evidence file. Expected outcome per the audit: few or zero merges — the 9 files mostly cover distinct modules; the win is fixture dedup, not test deletion.

- [ ] **Step 4: Full gates** — test count must equal pre-WP3 count minus documented merges. Commit:

```bash
git commit -m "refactor(wp3): migrate cost tests to shared fixtures; merge documented dupes"
```

---

## WP4 — Agent prompt trim

Skills constraints (enforced by `validate-skills.ts`): frontmatter `name` + `description` + `tier` (enum), body ≤200 lines.

### Task 12: Trim lead.md under 300 lines

**Files:**
- Create: `skills/meta/lead-efficiency/SKILL.md`
- Modify: `agents/lead.md` (333 lines → ≤300)
- Check: `tests/agent-prompt-content.test.ts`

- [ ] **Step 1: Check which prompt tests assert on the sections being moved**

Run: `grep -n "Delegation thresholds\|Context efficiency" tests/agent-prompt-content.test.ts tests/*.test.ts`

- [ ] **Step 2: Create the skill** — `skills/meta/lead-efficiency/SKILL.md`:

```markdown
---
name: lead-efficiency
description: Lead-only operating specifics — delegation cost thresholds and context-efficiency rules. Invoked by the lead agent at dispatch-decision time.
tier: meta
---

<entire "## Delegation thresholds (cost discipline)" section moved verbatim from agents/lead.md:273-294>

<entire "## Context efficiency" section moved verbatim from agents/lead.md:295-323>
```

- [ ] **Step 3: Replace the two sections in `agents/lead.md`** with:

```markdown
## Delegation thresholds + context efficiency

Cost-discipline thresholds and context-efficiency rules live in the
`lead-efficiency` skill (skills/meta/lead-efficiency/). Invoke it before
any dispatch decision that trades cost against delegation.
```

Net: 333 − 51 + 5 ≈ 287 lines.

- [ ] **Step 4: Update any prompt-content tests found in Step 1** — change assertions that the sections exist in `lead.md` to assert the pointer text exists in `lead.md` AND the moved headings exist in the skill file.

- [ ] **Step 5: Verify caps** — `npm run validate:agents && npm run validate:skills`
Expected: both pass; lead.md ≤300, skill ≤200 lines.

- [ ] **Step 6: Routing-table row** — add a row to `docs/routing-table.md` mapping "Lead dispatch-cost decision" → `lead-efficiency` (advisory gate `validate:routing-table` should stay green).

- [ ] **Step 7: Full gates, commit** — `git commit -m "refactor(wp4): move lead cost/context specifics to lead-efficiency skill (333→<300 lines)"`

### Task 13: Trim reviewer.md under 300 lines

**Files:**
- Create: `skills/workflow/split-build-review/SKILL.md`
- Modify: `agents/reviewer.md` (314 lines → ≤300)

- [ ] **Step 1:** `grep -n "SPLIT_BUILD" tests/*.test.ts` — find assertions on the section being moved.

- [ ] **Step 2: Create the skill** — `skills/workflow/split-build-review/SKILL.md` with frontmatter (`name: split-build-review`, `tier: workflow`, description: "Reviewer conformance checklist for SPLIT_BUILD slices — FE/BE handoff cross-checks. Invoked by the reviewer when the slice used builder-fe + builder-be.") and the entire `## SPLIT_BUILD conformance sections` block moved verbatim from `agents/reviewer.md:292-314`.

- [ ] **Step 3: Replace the section in `agents/reviewer.md`** with:

```markdown
## SPLIT_BUILD conformance

For SPLIT_BUILD slices, invoke the `split-build-review` skill
(skills/workflow/split-build-review/) and apply its conformance sections.
```

Net: 314 − 23 + 5 ≈ 296 lines.

- [ ] **Step 4:** Update prompt-content tests per Step 1 findings (same pattern as Task 12 Step 4). Add routing-table row ("SPLIT_BUILD slice review" → `split-build-review`).

- [ ] **Step 5: Verify + full gates** — `npm run validate:agents && npm run validate:skills && npm test && npm run lint && npm run format:check && npm run typecheck`

- [ ] **Step 6: Commit** — `git commit -m "refactor(wp4): move reviewer SPLIT_BUILD conformance to skill (314→<300 lines)"`

---

## Final verification

### Task 14: Full gate run + evidence

- [ ] **Step 1:** Full CI-equivalent locally: `npm ci`-clean not required; run `node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts && npm run lint && npm run format:check && npm run typecheck && npm test && node ./scripts/e2e-smoke.mjs` — all green.
- [ ] **Step 2:** Final before/after table in the evidence file: baseline duration, post-WP1, post-WP2 durations; test counts (577 → N with merges listed); spawn-test count before/after; agent line counts (333/314 → final).
- [ ] **Step 3:** Success criteria check against the spec: suite ≤60s (stretch ≤45s); zero undocumented coverage loss; all agents ≤300 lines; CI green.
- [ ] **Step 4:** Commit evidence: `git commit -m "chore: WP1-WP4 final timing + coverage evidence"`

## Execution notes

- Tasks 1-4 (WP1), 5-9 (WP2), 10-11 (WP3), 12-13 (WP4) are independent groups — any group can be reverted without touching the others. Within a group, tasks are ordered.
- Windows dev machine: subprocess spawn ≈ 0.3-0.6s with `--experimental-strip-types`; this is why in-process conversion (WP2) is the largest single win.
- Do NOT touch: `tests/hook-feature-gating.test.ts` (runtime-contract proof), `tests/regression.test.ts` (May-2026 regression net), validator-script tests, `tests/session-cost-scanner-compute.test.ts` (out of WP2 scope — not one of the 4 per-tool hooks; candidate for a future pass).



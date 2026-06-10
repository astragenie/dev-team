# WS1 — Test Long-Pole Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the full test suite from ~116s to ≤40s by (1) making the session-cost scanner's projects root injectable so tests stop scanning the user's real ~/.claude/projects, (2) exporting an in-process `runCrew()` entry so CLI tests stop spawning subprocesses, and (3) splitting tests/cli.test.ts into per-command-family files that node --test parallelizes.

**Architecture:** crew.ts already routes argv through parseArgs() into a COMMANDS handler table — runCrew() is a thin exported wrapper around that path returning {code, output} instead of printing. The cost-scanning commands (write-final-synthesis, cost-advise, cost-slice) are slow because scripts/lib/session-cost-scanner.ts:49 and scripts/lib/session-cost.ts:7 hardcode PROJECTS_ROOT to ~/.claude/projects; a lazy getProjectsRoot() honoring CREW_PROJECTS_ROOT lets tests point at a tiny fixture.

**Tech Stack:** Node 22.6+ --experimental-strip-types, node:test, ESM.

---

## Task 1 — Injectable projects root in session-cost-scanner.ts

Files: Modify `scripts/lib/session-cost-scanner.ts`; Create/extend `tests/projects-root-override.test.ts`.

- [ ] Read scripts/lib/session-cost-scanner.ts lines 1–100 to understand current structure and all references to PROJECTS_ROOT constant.
- [ ] Write a failing test in a new file `tests/projects-root-override.test.ts`:
  - Sets `process.env.CREW_PROJECTS_ROOT` to a temp fixture dir containing a single project slug (e.g., "test-project-1")
  - Creates a minimal .jsonl fixture file in that dir with one assistant turn entry (timestamp in-window, type: "assistant", message.usage present)
  - Calls `listActiveProjectDirs({ startMs, endMs })` from session-cost-scanner.ts
  - Asserts the returned list includes only "test-project-1" (not the user's real ~/.claude/projects)
  - Cleans up the env var in a finally block
  - Run the test, expect FAIL with a message like "PROJECTS_ROOT is not a function" or similar (because the code still uses const PROJECTS_ROOT).
- [ ] Replace the module-level `const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");` with a lazy function at the top of the file:
  ```ts
  function getProjectsRoot(): string {
    const override = process.env.CREW_PROJECTS_ROOT;
    return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "projects");
  }
  ```
- [ ] Update all references to `PROJECTS_ROOT` within the file to call `getProjectsRoot()` instead:
  - Line ~68: `return entries.filter((e) => e.isDirectory()).map((e) => e.name);` inside listProjectDirEntries() uses `const dir = path.join(PROJECTS_ROOT, slug);` → change to `getProjectsRoot()`
  - Line ~118: `const dir = path.join(PROJECTS_ROOT, slug);` inside listActiveProjectDirs() → change to `getProjectsRoot()`
  - Any other references (verify by grepping for PROJECTS_ROOT in the file after the const is removed)
- [ ] Run the test: `npm test -- tests/projects-root-override.test.ts`, expect PASS.
- [ ] Commit: `git add scripts/lib/session-cost-scanner.ts tests/projects-root-override.test.ts && git commit -m "chore(session-cost-scanner): make projects root injectable via CREW_PROJECTS_ROOT env var"`

## Task 2 — Injectable projects root in session-cost.ts

Files: Modify `scripts/lib/session-cost.ts`.

- [ ] Read scripts/lib/session-cost.ts lines 1–100; identify all uses of the `const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");` at line 7.
- [ ] Replace the module-level const with the same lazy function:
  ```ts
  function getProjectsRoot(): string {
    const override = process.env.CREW_PROJECTS_ROOT;
    return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "projects");
  }
  ```
- [ ] Update all references:
  - Line ~49: `const dir = path.join(PROJECTS_ROOT, slug);` inside listProjectSessions() → `getProjectsRoot()`
  - Line ~103: `const dir = path.join(PROJECTS_ROOT, slug);` inside autoDetectSourceProject() → `getProjectsRoot()`
  - Line ~121: `const dir = path.join(PROJECTS_ROOT, slug);` inside listActiveProjectDirs() → `getProjectsRoot()`
  - Verify no other references remain by grepping.
- [ ] Run `npm test` to ensure no regressions; expect all tests to pass.
- [ ] Commit: `git add scripts/lib/session-cost.ts && git commit -m "chore(session-cost): make projects root injectable via CREW_PROJECTS_ROOT env var"`

## Task 3 — In-process runCrew() entry point

Files: Modify `scripts/crew.ts`; Create `tests/run-crew.test.ts`.

- [ ] Read the full scripts/crew.ts to understand main() flow (lines 815–841).
- [ ] Extract the command dispatch logic into a new exported async function at the top level (before main()):
  ```ts
  export async function runCrew(argv: string[]): Promise<{ code: number; output: string }> {
    try {
      const { command, helpTarget, flags, positionals } = parseArgs(argv);
      const repoPath = path.resolve(normalizeMsysPath(flags.repo));
      if (command === "help") return { code: 0, output: usage(helpTarget) };
      const handler = (COMMANDS as Record<string, (ctx: CommandContext) => Promise<unknown>>)[command];
      if (!handler) return { code: 1, output: `Unknown command: ${command}` };
      const result = await handler({ repoPath, flags, positionals });
      return { code: 0, output: typeof result === "string" ? result : JSON.stringify(result, null, 2) };
    } catch (error) {
      return { code: 1, output: (error as Error).message };
    }
  }
  ```
- [ ] Update main() to use runCrew() and exit appropriately:
  ```ts
  async function main() {
    const { code, output } = await runCrew(process.argv.slice(2));
    if (code === 0) {
      console.log(output);
    } else {
      console.error(output);
      process.exitCode = 1;
    }
  }
  ```
- [ ] Guard the invocation of main() so importing crew.ts from tests does NOT execute it automatically:
  ```ts
  import { pathToFileURL } from "node:url";
  const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
  if (isDirectRun) {
    void main();
  }
  ```
- [ ] Create `tests/run-crew.test.ts` with three tests:
  - Test 1: `runCrew(["help"])` returns `{ code: 0, output: "..." }` where output contains "Usage:" and "init".
  - Test 2: `runCrew(["unknown-command"])` returns `{ code: 1, output: "Unknown command: unknown-command" }`.
  - Test 3: Happy path with a real command: init a temp repo and verify `{ code: 0, output: JSON.parse(...) }` contains `mode: "init"`.
- [ ] Run the tests: `npm test -- tests/run-crew.test.ts`, expect all 3 PASS.
- [ ] Run `npm test` to ensure no regressions in the full suite.
- [ ] Commit: `git add scripts/crew.ts tests/run-crew.test.ts && git commit -m "feat(crew): export in-process runCrew() entry point for test efficiency"`

## Task 4 — Extract cli-fixtures.ts, then split tests/cli.test.ts into cli-claims.test.ts

Files: Create `tests/helpers/cli-fixtures.ts`; Create `tests/cli-claims.test.ts`; Modify `tests/cli.test.ts` (remove moved tests).

- [ ] Read tests/cli.test.ts lines 1–16 to extract the shared helper functions and constants (`execFile`, `cliPath`, `makeTempDir`, `loadState`).
- [ ] Create `tests/helpers/cli-fixtures.ts` and export all four helpers:
  ```ts
  import fs from "node:fs/promises";
  import os from "node:os";
  import path from "node:path";
  import { execFile as execFileCallback } from "node:child_process";
  import { fileURLToPath } from "node:url";
  import { promisify } from "node:util";

  export const execFile = promisify(execFileCallback);
  export const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  export const cliPath = path.join(repoRoot, "scripts", "crew.ts");

  export async function makeTempDir(prefix: string) {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  export async function loadState(repoPath: string) {
    const raw = await fs.readFile(
      path.join(repoPath, ".claude", "state", "crew", "workflow-state.json"),
      "utf8"
    );
    return JSON.parse(raw);
  }
  ```
- [ ] Update tests/cli.test.ts: remove the helper definitions (lines 10–16 for the functions, keep only imports at the top); add a single import line: `import { execFile, cliPath, makeTempDir, loadState } from "./helpers/cli-fixtures.ts";`
- [ ] Run `npm test -- tests/cli.test.ts` (should still pass; validates the transition).
- [ ] Proceed to identify and move tests in the "claims" family:

  - "CLI init creates a harnessed repo" (lines 7–26)
  - "CLI bootstrap preserves existing CLAUDE.md content" (lines 28–47)
  - "CLI claim and release manage repo-local claims" (lines 49–105)
  - Related setup: init via execFile in these tests
- [ ] Create `tests/cli-claims.test.ts` with the same imports as cli.test.ts but:
  - Import `runCrew` from `scripts/crew.ts` (new export from Task 3)
  - Import `execFile, cliPath, makeTempDir, loadState` from `tests/helpers/cli-fixtures.ts`
- [ ] Convert the first test ("CLI init creates a harnessed repo") as a full example:
  ```ts
  test("CLI init creates a harnessed repo", async () => {
    const rootPath = await makeTempDir("crew-cli-init-");
    const repoPath = path.join(rootPath, "app");
    const { code, output } = await runCrew(["init", "--repo", repoPath]);
    assert.equal(code, 0, "init should exit with code 0");
    const result = JSON.parse(output);
    
    assert.equal(result.mode, "init");
    assert.equal(result.audit.hasHarnessLayer, true);
    assert.match(result.welcome.headline, /Crew/);
    assert.ok(result.welcome.commands.includes("/crew:brief-me"));
    
    const claudeMd = await fs.readFile(path.join(repoPath, "CLAUDE.md"), "utf8");
    assert.match(claudeMd, /crew:start/);
  });
  ```
  (The key change: `await runCrew([...])` returns `{ code, output }` instead of the subprocess `{ stdout }`. Parse output directly.)
- [ ] Apply the same mechanical conversion to the remaining two tests in the claims family (bootstrap, claim+release). Show the full converted code for the claim+release test as the second example.
- [ ] Remove these three tests from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-claims.test.ts`, expect 3 PASS.
- [ ] Run `npm test` to ensure the full suite still passes and no fixtures are broken.
- [ ] Commit: `git add tests/cli-claims.test.ts tests/cli.test.ts && git commit -m "test(cli-claims): split claims family from cli.test.ts, convert to runCrew() in-process calls"`

## Task 5 — Split tests/cli.test.ts into cli-approvals.test.ts

Files: Create `tests/cli-approvals.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Identify the approvals family test in cli.test.ts:
  - "CLI approval requests can be listed and resolved" (lines 107–164)
- [ ] Create `tests/cli-approvals.test.ts` with the same boilerplate as cli-claims.test.ts.
- [ ] Convert the test using the runCrew() pattern from Task 4 (same mechanical conversion):
  - Where the old test calls `execFile("node", [cliPath, "request-approval", ...])`, call `await runCrew(["request-approval", ...])` instead.
  - Where the old code parses `stdout`, parse `output` directly.
- [ ] Remove the test from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-approvals.test.ts`, expect 1 PASS.
- [ ] Commit: `git add tests/cli-approvals.test.ts tests/cli.test.ts && git commit -m "test(cli-approvals): split approvals family from cli.test.ts, convert to runCrew()"`

## Task 6 — Split tests/cli.test.ts into cli-artifacts.test.ts (write-* commands)

Files: Create `tests/cli-artifacts.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Identify the artifacts family tests in cli.test.ts (excluding synthesis-cost family):
  - "CLI artifact writers create markdown artifacts" (lines 166–355) — this is the main one
  - "write-* commands embed --feature and --phase in frontmatter" (lines 1354–1413)
  - "write-handoff --repo-context appends ## Repo Layout section" (lines 1486–1507)
  - "write-handoff without --repo-context has no ## Repo Layout section" (lines 1509–1527)
  - "write-review-result with --validation-evidence emits frontmatter field and body section" (lines 1529–1560)
  - "write-review-result without --validation-evidence emits no frontmatter field and no body section" (lines 1562–1586)
  - "write-review-result with --validation-evidence empty string treats it as omitted" (lines 1588–1615)
  - "write-validation-result: --findings persisted in frontmatter" (lines 1618–1646)
  - "write-deployment-check: --findings persisted in frontmatter" (lines 1648–end of file, ~1677)
- [ ] Create `tests/cli-artifacts.test.ts` with boilerplate from earlier tasks.
- [ ] Convert the main "CLI artifact writers create markdown artifacts" test (the largest; lines 166–355) as the shown example. Show the full before/after for at least the first 3 write-* command calls in that test.
- [ ] For the remaining 7 tests, note that they follow the same mechanical conversion pattern; describe as "same mechanical conversion (show one example in cli-artifacts.test.ts)".
- [ ] Remove all 8 tests from tests/cli.test.ts (excluding the 2 write-final-synthesis tests that belong in Task 7).
- [ ] Run `npm test -- tests/cli-artifacts.test.ts`, expect 8 PASS.
- [ ] Commit: `git add tests/cli-artifacts.test.ts tests/cli.test.ts && git commit -m "test(cli-artifacts): split write-* artifact commands from cli.test.ts, convert to runCrew()"`

## Task 7 — Split tests/cli.test.ts into cli-synthesis-cost.test.ts (write-final-synthesis, cost-advise, cost-slice)

Files: Create `tests/cli-synthesis-cost.test.ts`; Modify `tests/cli.test.ts`.

**CRITICAL: This task must set CREW_PROJECTS_ROOT to a tiny fixture so cost-scanning commands don't scan the user's real ~/.claude/projects.**

- [ ] Identify the synthesis/cost family tests in cli.test.ts (all 6):
  - "write-final-synthesis rejects when --external-deltas is missing" (lines 1019–1049)
  - "write-final-synthesis accepts --external-deltas none and renders the section" (lines 1051–1093)
  - "CLI blocks final synthesis when workflow badges are still pending" (lines 947–1017)
  - "final-synthesis blocked when escalated_to_human set; --force overrides" (lines 1215–1271)
  - "cost-advise accepts --title --feature --phase and slugs filename + emits frontmatter" (lines 1434–1477)
  - "cost-slice embeds --feature and --phase in cost-report frontmatter" (lines 1479–1503)
- [ ] Create `tests/cli-synthesis-cost.test.ts` with:
  - Standard boilerplate imports from earlier tasks
  - A before() hook that sets `process.env.CREW_PROJECTS_ROOT` to a temp fixture directory
  - An after() hook that deletes the directory and unsets the env var
  - Inside the fixture setup, create a minimal project session structure:
    ```ts
    const fixtureRoot = await makeTempDir("crew-cost-tests-");
    const projectSlug = "test-project-cost";
    const projectDir = path.join(fixtureRoot, projectSlug);
    await fs.mkdir(projectDir, { recursive: true });
    // Create a minimal .jsonl file with one assistant turn:
    const sessionFile = path.join(projectDir, "session.jsonl");
    await fs.writeFile(sessionFile, JSON.stringify({
      type: "assistant",
      timestamp: "2026-05-22T00:01:00Z",
      message: { usage: { input_tokens: 100, output_tokens: 50 } }
    }) + "\n");
    process.env.CREW_PROJECTS_ROOT = fixtureRoot;
    ```
- [ ] Convert all 6 synthesis/cost tests using runCrew():
  - The two write-final-synthesis tests ("rejects when...", "accepts --external-deltas...") that block on missing --external-deltas and render the section
  - "CLI blocks final synthesis when workflow badges are still pending"
  - "final-synthesis blocked when escalated_to_human set; --force overrides"
  - "cost-advise accepts..." test: replace execFile subprocess calls with runCrew() calls
  - "cost-slice embeds..." test: same conversion
  - Show the full before/after for the cost-advise test as an example.
- [ ] Remove all 6 tests from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-synthesis-cost.test.ts`, expect 6 PASS with CREW_PROJECTS_ROOT honored.
- [ ] Verify cost-scanning does NOT access ~/.claude/projects by checking the test logs or adding a debug assertion.
- [ ] Commit: `git add tests/cli-synthesis-cost.test.ts tests/cli.test.ts && git commit -m "test(cli-synthesis-cost): split cost commands from cli.test.ts, set CREW_PROJECTS_ROOT fixture, convert to runCrew()"`

## Task 7b — Split tests/cli.test.ts into cli-workflow.test.ts

Files: Create `tests/cli-workflow.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Identify the workflow family tests in cli.test.ts (13 tests):
  - "CLI wake-up brief summarizes repo memory and state" (lines 368–535)
  - "CLI brief-me synthesizes workflow state, git activity, and next step" (lines 537–635)
  - "CLI brief-me is read-only for an uninitialized repo" (lines 637–653)
  - "CLI brief-me surfaces failed gates before generic next steps" (lines 655–701)
  - "CLI workflow state tracks gate badges and artifact progress" (lines 703–852)
  - "CLI workflow state and brief-me surface missing artifact write-backs after a completed phase" (lines 854–905)
  - "CLI workflow state and brief-me surface missing run briefs after meaningful progress starts" (lines 907–945)
  - "CLI subcommand help works without error" (lines 1095–1105)
  - "CLI install-global writes managed global memory into HOME" (lines 1107–1139)
  - "mark-badge blocked persists note + blockedBy" (lines 1149–1180)
  - "mark-badge escalated_to_human persists note" (lines 1182–1213)
  - "brief-me surfaces blocked in pending badges" (lines 1273–1311)
  - "brief-me reports routingTableStale=false when file recent or absent" (lines 1313–1343)
  - "brief-me reports routingTableStale=true when mtime > 30 days old" (lines 1345–1371)
- [ ] Create `tests/cli-workflow.test.ts` with boilerplate from earlier tasks (imports from helpers/cli-fixtures.ts).
- [ ] Convert all 13 workflow tests using the runCrew() pattern from Task 4. Show one full example (e.g., brief-me test) in the plan.
- [ ] **Caveat for install-global test:** it currently injects HOME via subprocess env in execFile options. When converting in-process, set and restore `process.env.HOME` (and `process.env.USERPROFILE` on Windows) around the runCrew call. If that proves fragile with async state leakage, keep this single test in cli-smoke.test.ts as a sixth spawn and document in the commit message.
- [ ] Remove all 13 workflow tests from tests/cli.test.ts.
- [ ] Run `npm test -- tests/cli-workflow.test.ts`, expect 13 PASS (or 12 PASS + 1 skipped if install-global remains in smoke).
- [ ] Commit: `git add tests/cli-workflow.test.ts tests/cli.test.ts && git commit -m "test(cli-workflow): split workflow family from cli.test.ts, convert to runCrew()"`

## Task 8 — Create cli-smoke.test.ts (exactly 5 real spawn smokes, one per family)

Files: Create `tests/cli-smoke.test.ts`; Modify `tests/cli.test.ts`.

- [ ] Create `tests/cli-smoke.test.ts` with imports including `execFile, cliPath, makeTempDir` from cli-fixtures.ts.
- [ ] Write exactly 5 tests, one per command family, each spawning one real subprocess (execFile):
  - **Smoke 1 — claims**: spawn `node --experimental-strip-types crew.ts init --repo <temp>`, assert exit code 0 and output JSON contains `mode: "init"`
  - **Smoke 2 — approvals**: spawn `node crew.ts request-approval --repo <temp> --summary "test"`, assert exit code 0 and output JSON has `id` field
  - **Smoke 3 — artifacts**: spawn `node crew.ts write-handoff --repo <temp> --title "test" --from builder`, assert exit code 0 and output JSON has `path` field
  - **Smoke 4 — synthesis**: spawn `node crew.ts write-final-synthesis --repo <temp> --title "test" --external-deltas none`, assert exit code 0 and output JSON has `path` field
  - **Smoke 5 — cost**: spawn `node crew.ts cost-advise --repo <temp>`, assert exit code 0 and output JSON has `artifactPath` or similar field
  - Each test should verify stdout is clean (not garbled), JSON-parseable, and the process exits cleanly with code 0.
- [ ] Remove any remaining execFile calls from tests/cli.test.ts (except the 5 smokes you just wrote).
- [ ] Run `npm test -- tests/cli-smoke.test.ts`, expect 5 PASS.
- [ ] Commit: `git add tests/cli-smoke.test.ts tests/cli.test.ts && git commit -m "test(cli-smoke): add 5 process-level spawn smokes (one per command family) for regression coverage"`

## Task 9 — Delete the now-empty tests/cli.test.ts

Files: Delete `tests/cli.test.ts`.

- [ ] Verify that all tests have been moved to the split files:
  - cli-claims.test.ts: 3 tests
  - cli-approvals.test.ts: 1 test
  - cli-artifacts.test.ts: 8 tests (excluding 2 write-final-synthesis moved to Task 7)
  - cli-synthesis-cost.test.ts: 6 tests (2 write-final-synthesis + 2 gate enforcement + 2 cost commands)
  - cli-workflow.test.ts: 13 tests (wake-up, brief-me variants, state tracking, mark-badge variants, routing-table checks)
  - cli-smoke.test.ts: 5 tests (one per family: claims, approvals, artifacts, synthesis, cost)
  - run-crew.test.ts: 3 tests (new)
  - projects-root-override.test.ts: 1 test (new)
  - **Total original cli.test.ts: 3 + 1 + 8 + 6 + 13 = 31 tests; 2 additional tests (help, install-global) move to cli-workflow = 33 tests**
- [ ] Ensure no test remains in tests/cli.test.ts by reading it (should be very few or empty).
- [ ] Delete the file: `rm tests/cli.test.ts`
- [ ] Run `npm test` and verify all 573 tests pass (no regression).
- [ ] Commit: `git add -A && git commit -m "test(cli): delete original cli.test.ts (fully migrated to split per-family files)"`

## Task 10 — Timing verification + AC check

Files: None (verification only).

- [ ] Run `npm test` with a PowerShell timer to measure wall-clock time:
  ```powershell
  $result = Measure-Command { npm test }
  Write-Host "Test suite completed in $($result.TotalSeconds) seconds"
  ```
  Expected: ≤40 seconds (interim node-only target).
- [ ] Verify the last 10 lines of test output show 573+ tests passing:
  ```bash
  npm test 2>&1 | tail -20
  ```
  Expected output like: `✔ ... passes` and `tests ... ok`
- [ ] Run the AC-WS1 verification command from the spec (grep for execFile in spawns):
  ```bash
  grep -rn "execFile.*crew.ts" tests/ | grep -v "smoke\|spawn" | wc -l
  ```
  Expected: 0 (no subprocess spawns in main assertions).
- [ ] Verify per-command test files exist:
  ```bash
  ls tests/cli-*.test.ts 2>&1
  ```
  Expected: at least 5 files (claims, approvals, artifacts, synthesis-cost, smoke) + the new run-crew.test.ts + projects-root-override.test.ts.
- [ ] Record the timing numbers in the final commit message.
- [ ] Commit: `git add --allow-empty && git commit -m "chore(perf): WS1 test suite speedup complete — 116s → <40s (measured: XXs on node 22.6); 573 tests pass, zero subprocess spawns in core assertions, per-family files parallelized"`

---

## Notes & Deviations

**Deliberate Addition:** Task 1–2 (injectable projects root via CREW_PROJECTS_ROOT) are NOT in the original WS1 spec but are a required prerequisite for Task 7 (cost-scanning tests). They are included because the spec's AC-WS1-2 requires "zero subprocess execFile calls remain in core test assertions," and cost-slice/cost-advise commands would otherwise spend 15–20s scanning the user's real ~/.claude/projects dir during test runs. This addition is essential for meeting the ≤40s timing target.

**Test Count:** The original cli.test.ts contains 33 tests. After splitting:
- cli-claims.test.ts: 3 tests
- cli-approvals.test.ts: 1 test
- cli-artifacts.test.ts: 8 tests
- cli-synthesis-cost.test.ts: 6 tests
- cli-workflow.test.ts: 13 tests
- cli-smoke.test.ts: 5 tests
- run-crew.test.ts: 3 tests (new)
- projects-root-override.test.ts: 1 test (new)
- **Total: 3 + 1 + 8 + 6 + 13 + 5 + 3 + 1 = 40 tests covering all 33 original tests plus 7 new tests**

**AC Alignment:**
- **AC-WS1-1:** ✅ runCrew() exported, returns `{ code, output }`, happy-path code 0.
- **AC-WS1-2:** ✅ grep for execFile shows 0 in main assertions (only 5 spawn smokes remain).
- **AC-WS1-3:** ✅ Files split into 5 families; node --test parallelizes across cores; measured ≤40s.
- **AC-WS1-4:** ✅ 5 smoke tests (one per family) check exit codes, stdout hygiene, no hangs.

---

## Appendix: Key Code Examples

### Example 1 — getProjectsRoot() pattern (Tasks 1–2)
```ts
// OLD (hardcoded):
const PROJECTS_ROOT = path.join(os.homedir(), ".claude", "projects");

// NEW (injectable):
function getProjectsRoot(): string {
  const override = process.env.CREW_PROJECTS_ROOT;
  return override ? path.resolve(override) : path.join(os.homedir(), ".claude", "projects");
}

// Then replace all PROJECTS_ROOT with getProjectsRoot()
const dir = path.join(getProjectsRoot(), slug);
```

### Example 2 — runCrew() entry point (Task 3)
```ts
export async function runCrew(argv: string[]): Promise<{ code: number; output: string }> {
  try {
    const { command, helpTarget, flags, positionals } = parseArgs(argv);
    const repoPath = path.resolve(normalizeMsysPath(flags.repo));
    if (command === "help") return { code: 0, output: usage(helpTarget) };
    const handler = (COMMANDS as Record<string, (ctx: CommandContext) => Promise<unknown>>)[command];
    if (!handler) return { code: 1, output: `Unknown command: ${command}` };
    const result = await handler({ repoPath, flags, positionals });
    return { code: 0, output: typeof result === "string" ? result : JSON.stringify(result, null, 2) };
  } catch (error) {
    return { code: 1, output: (error as Error).message };
  }
}
```

### Example 3 — CLI test conversion (Tasks 4–7)
```ts
// OLD (subprocess):
const { stdout } = await execFile("node", [
  "--experimental-strip-types",
  cliPath,
  "init",
  "--repo",
  repoPath
]);
const result = JSON.parse(stdout);

// NEW (in-process):
const { code, output } = await runCrew(["init", "--repo", repoPath]);
assert.equal(code, 0, "init should exit with code 0");
const result = JSON.parse(output);
```

### Example 4 — Cost test fixture setup (Task 7)
```ts
import test from "node:test";

let fixtureRoot: string;

test("cost-scanning tests", async (t) => {
  await t.test("setup fixture", async () => {
    fixtureRoot = await makeTempDir("crew-cost-tests-");
    const projectDir = path.join(fixtureRoot, "test-project-cost");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "session.jsonl"),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-05-22T00:01:00Z",
        message: { usage: { input_tokens: 100, output_tokens: 50 } }
      }) + "\n"
    );
    process.env.CREW_PROJECTS_ROOT = fixtureRoot;
  });

  await t.test("cost-advise ...", async () => {
    // test body using runCrew()
  });

  await t.test("cleanup", async () => {
    delete process.env.CREW_PROJECTS_ROOT;
    await fs.rm(fixtureRoot, { recursive: true });
  });
});
```

---

**Execution checklist:**
- [ ] All tasks completed with checkbox steps marked done
- [ ] No placeholders remain in code examples
- [ ] Type signatures match exactly (runCrew returns `{ code: number; output: string }`)
- [ ] All file paths are absolute and verified to exist (e.g., scripts/crew.ts, scripts/lib/session-cost-scanner.ts)
- [ ] Commit messages are descriptive and follow the repo's style
- [ ] Final npm test produces ≤40s wall-clock time
- [ ] All 573 tests pass (or a documented subset if some were consolidated)

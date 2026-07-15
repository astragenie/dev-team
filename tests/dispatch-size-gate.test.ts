// tests/dispatch-size-gate.test.ts
// A3 — the dispatch size gate (8 agent deaths, all from oversized dispatches).
// Unit tests on hooks/lib/dispatch-size-estimate.ts's pure functions and the
// runDispatchSizeGateHook(raw) orchestration (in-process, mkdtemp-repo shape
// mirrors tests/check-builder-terminal-state.test.ts), plus a handful of
// shim-level subprocess tests (mirroring tests/hook-feature-gating.test.ts's
// runHook helper) for the env kill-switch and non-Agent/malformed pass-through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import {
  baseTokensForTier,
  fileMentionCount,
  hasWideScopeMarker,
  estimateDispatchSize,
  parseAgentDispatchSizeInput,
  decideDispatchSizeAction,
  buildDispatchSizeOutput,
  runDispatchSizeGateHook,
  DISPATCH_SIZE_THRESHOLD
} from "../hooks/lib/dispatch-size-estimate.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SHIM_PATH = path.join(__dirname, "..", "hooks", "pre-tool-use-dispatch-size.ts");

async function makeRepo(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-size-gate-test-"));
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

function agentPayload(opts: { cwd: string; subagentType: string; prompt: string }): string {
  return JSON.stringify({
    session_id: "s1",
    tool_name: "Agent",
    tool_input: { subagent_type: opts.subagentType, prompt: opts.prompt },
    cwd: opts.cwd
  });
}

async function writeCrewConfig(repo: string, enabled: boolean): Promise<void> {
  const crewDir = path.join(repo, ".claude");
  await fs.mkdir(crewDir, { recursive: true });
  await fs.writeFile(
    path.join(crewDir, "crew.json"),
    JSON.stringify({ features: { "dispatch-size-gate": { enabled } } }),
    "utf8"
  );
}

async function readEvents(repo: string): Promise<Record<string, unknown>[]> {
  const file = path.join(repo, ".claude", "logs", "events.jsonl");
  try {
    const raw = await fs.readFile(file, "utf8");
    return raw
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch {
    return [];
  }
}

function runHook(
  stdin: string,
  env: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", SHIM_PATH], {
      env: { ...process.env, ...env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

// A prompt shaped like the incident's two early-death dispatches: a
// wide-scope review marker plus dozens of distinct file mentions (unbounded
// read fan-out). Deliberately over DISPATCH_SIZE_THRESHOLD even though the
// real deaths clocked ~60k actual tokens — the estimator is a coarse proxy,
// tuned to over-trigger on this shape rather than approximate it precisely.
function deathModePrompt(): string {
  const files = Array.from({ length: 40 }, (_, i) => `path/to/module${i}.ts`).join(", ");
  return `Review all files in the repo for correctness issues: ${files}`;
}

// ── pure estimator ──────────────────────────────────────────────────────

test("baseTokensForTier: light tier (investigator/dev-lite/reviewer-lite) → 15000", () => {
  assert.equal(baseTokensForTier("crew:investigator"), 15_000);
  assert.equal(baseTokensForTier("dev-lite"), 15_000);
  assert.equal(baseTokensForTier("crew:reviewer-lite"), 15_000);
});

test("baseTokensForTier: mid tier (researcher/reviewer/architect) → 30000", () => {
  assert.equal(baseTokensForTier("crew:researcher"), 30_000);
  assert.equal(baseTokensForTier("crew:reviewer"), 30_000);
  assert.equal(baseTokensForTier("architect"), 30_000);
});

test("baseTokensForTier: builder tier → 35000", () => {
  assert.equal(baseTokensForTier("crew:fullstack-dev"), 35_000);
  assert.equal(baseTokensForTier("crew:aiplugin-dev"), 35_000);
});

test("baseTokensForTier: unknown subagent_type → 25000 default", () => {
  assert.equal(baseTokensForTier("crew:some-new-agent"), 25_000);
});

test("fileMentionCount: counts file-path-like tokens and bare dir mentions (additively, no de-dup)", () => {
  assert.equal(fileMentionCount("no files here"), 0);
  // Each "<dir>/<file>.<ext>" mention fires BOTH regexes (a file-path match
  // and a bare-dir match) by design — the formula sums them rather than
  // de-duplicating overlaps, matching the architect's spec literally
  // (2026-07-12-reviewchannel-and-dispatch-gate.md Blocker 2): "hooks/hooks.json"
  // = 1 file match + 1 dir match, same for "agents/reviewer.md" → 4 total.
  assert.equal(fileMentionCount("edit hooks/hooks.json and agents/reviewer.md"), 4);
  assert.equal(fileMentionCount("scan commands/ and skills/ directories"), 2);
});

test("hasWideScopeMarker: matches the incident's over-broad review shape", () => {
  assert.equal(hasWideScopeMarker("review all files in the repo"), true);
  assert.equal(hasWideScopeMarker("review every file in the codebase"), true);
  assert.equal(hasWideScopeMarker("read the entire whole repo directories"), true);
  assert.equal(hasWideScopeMarker("fix the bug in hooks/foo.ts"), false);
});

test("estimateDispatchSize: under-cap, light tier, no mentions → well under threshold", () => {
  const est = estimateDispatchSize({
    subagentType: "crew:investigator",
    prompt: "Find where parseAgentDispatchSizeInput is defined."
  });
  assert.equal(est.estimatedTokens, 15_000);
  assert.equal(est.overThreshold, false);
});

test("estimateDispatchSize: death-mode prompt (wide-scope + 40 file mentions) → over threshold", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  assert.equal(est.wideScope, true);
  assert.ok(est.fileMentions >= 27, `expected >=27 file mentions, got ${est.fileMentions}`);
  assert.ok(
    est.estimatedTokens > DISPATCH_SIZE_THRESHOLD,
    `expected >${DISPATCH_SIZE_THRESHOLD}, got ${est.estimatedTokens}`
  );
  assert.equal(est.overThreshold, true);
});

// ── parse ────────────────────────────────────────────────────────────────

test("parseAgentDispatchSizeInput: valid Agent payload → parsed", () => {
  const result = parseAgentDispatchSizeInput(
    agentPayload({ cwd: "/repo", subagentType: "crew:fullstack-dev", prompt: "do the thing" })
  );
  assert.ok(result !== null);
  assert.equal(result.subagentType, "crew:fullstack-dev");
  assert.equal(result.prompt, "do the thing");
  assert.equal(result.cwd, "/repo");
});

test("parseAgentDispatchSizeInput: non-Agent tool_name → null (untouched)", () => {
  const raw = JSON.stringify({
    session_id: "s1",
    tool_name: "Bash",
    tool_input: { command: "ls" },
    cwd: "/repo"
  });
  assert.equal(parseAgentDispatchSizeInput(raw), null);
});

test("parseAgentDispatchSizeInput: malformed JSON → null, no throw", () => {
  assert.equal(parseAgentDispatchSizeInput("not json at all"), null);
  assert.equal(parseAgentDispatchSizeInput("{broken:"), null);
  assert.equal(parseAgentDispatchSizeInput(""), null);
});

test("parseAgentDispatchSizeInput: missing subagent_type → null", () => {
  const raw = JSON.stringify({ tool_name: "Agent", tool_input: { prompt: "x" }, cwd: "/repo" });
  assert.equal(parseAgentDispatchSizeInput(raw), null);
});

// ── decide + build output ───────────────────────────────────────────────

test("decideDispatchSizeAction: under threshold → none regardless of mode", () => {
  const est = estimateDispatchSize({ subagentType: "crew:investigator", prompt: "small task" });
  assert.equal(decideDispatchSizeAction(est, false).action, "none");
  assert.equal(decideDispatchSizeAction(est, true).action, "none");
});

test("decideDispatchSizeAction: over threshold + warn mode (flag off) → warn", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  assert.equal(decideDispatchSizeAction(est, false).action, "warn");
});

test("decideDispatchSizeAction: over threshold + block mode (flag on) → block", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  assert.equal(decideDispatchSizeAction(est, true).action, "block");
});

test("buildDispatchSizeOutput: none → null", () => {
  const est = estimateDispatchSize({ subagentType: "crew:investigator", prompt: "small" });
  assert.equal(buildDispatchSizeOutput(decideDispatchSizeAction(est, false)), null);
});

test("buildDispatchSizeOutput: warn → allow + systemMessage nudging a split", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  const out = buildDispatchSizeOutput(decideDispatchSizeAction(est, false));
  assert.ok(out !== null);
  const parsed = JSON.parse(out as string);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
  assert.match(parsed.systemMessage, /split/i);
  assert.match(parsed.systemMessage, /dispatch-size-gate/);
});

test("buildDispatchSizeOutput: block → {decision:'block'} with an actionable split message", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  const out = buildDispatchSizeOutput(decideDispatchSizeAction(est, true));
  assert.ok(out !== null);
  const parsed = JSON.parse(out as string);
  assert.equal(parsed.decision, "block");
  assert.match(parsed.reason, /split/i);
  assert.match(parsed.reason, /8 agents have died/);
});

// ── runDispatchSizeGateHook (full orchestration, in-process) ──────────────

test("runDispatchSizeGateHook: under-cap dispatch → pass (null)", async () => {
  const repo = await makeRepo();
  try {
    const raw = agentPayload({
      cwd: repo,
      subagentType: "crew:investigator",
      prompt: "Find where X is defined."
    });
    assert.equal(await runDispatchSizeGateHook(raw), null);
  } finally {
    await cleanup(repo);
  }
});

test("runDispatchSizeGateHook: over-cap + no crew.json (default warn) → warn output", async () => {
  const repo = await makeRepo();
  try {
    const raw = agentPayload({
      cwd: repo,
      subagentType: "crew:reviewer",
      prompt: deathModePrompt()
    });
    const out = await runDispatchSizeGateHook(raw);
    assert.ok(out !== null);
    const parsed = JSON.parse(out as string);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
    assert.ok(parsed.systemMessage);
  } finally {
    await cleanup(repo);
  }
});

test("runDispatchSizeGateHook: over-cap + dispatch-size-gate enabled → block output", async () => {
  const repo = await makeRepo();
  try {
    await writeCrewConfig(repo, true);
    const raw = agentPayload({
      cwd: repo,
      subagentType: "crew:reviewer",
      prompt: deathModePrompt()
    });
    const out = await runDispatchSizeGateHook(raw);
    assert.ok(out !== null);
    const parsed = JSON.parse(out as string);
    assert.equal(parsed.decision, "block");
  } finally {
    await cleanup(repo);
  }
});

test("runDispatchSizeGateHook: dispatch-size-gate explicitly disabled → still warn, never silenced (guardrail)", async () => {
  const repo = await makeRepo();
  try {
    await writeCrewConfig(repo, false);
    const raw = agentPayload({
      cwd: repo,
      subagentType: "crew:reviewer",
      prompt: deathModePrompt()
    });
    const out = await runDispatchSizeGateHook(raw);
    assert.ok(out !== null);
    const parsed = JSON.parse(out as string);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
  } finally {
    await cleanup(repo);
  }
});

test("runDispatchSizeGateHook: non-Agent tool → untouched (null)", async () => {
  const repo = await makeRepo();
  try {
    const raw = JSON.stringify({
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      cwd: repo
    });
    assert.equal(await runDispatchSizeGateHook(raw), null);
  } finally {
    await cleanup(repo);
  }
});

test("runDispatchSizeGateHook: malformed payload → pass (null), no throw", async () => {
  assert.equal(await runDispatchSizeGateHook("not json at all"), null);
  assert.equal(await runDispatchSizeGateHook("{broken:"), null);
});

test("runDispatchSizeGateHook: every valid dispatch is logged to events.jsonl for calibration", async () => {
  const repo = await makeRepo();
  try {
    const raw = agentPayload({
      cwd: repo,
      subagentType: "crew:investigator",
      prompt: "small task, under threshold"
    });
    await runDispatchSizeGateHook(raw);
    const events = await readEvents(repo);
    const row = events.find((e) => e.event === "dispatch-size-gate");
    assert.ok(row, "expected a dispatch-size-gate calibration row");
    assert.equal(row?.action, "none");
    assert.equal(row?.subagentType, "crew:investigator");
    assert.equal(typeof row?.estimatedTokens, "number");
  } finally {
    await cleanup(repo);
  }
});

// ── shim-level subprocess tests ────────────────────────────────────────

test("shim: CREW_DISPATCH_SIZE_GATE=0 → pass unconditionally, even over-cap", async () => {
  const repo = await makeRepo();
  try {
    const raw = agentPayload({
      cwd: repo,
      subagentType: "crew:reviewer",
      prompt: deathModePrompt()
    });
    const result = await runHook(raw, { CREW_DISPATCH_SIZE_GATE: "0" });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("shim: malformed stdin → exit 0, no crash, no stdout", async () => {
  const result = await runHook("not json at all");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("shim: non-Agent tool event → untouched, exit 0, no stdout", async () => {
  const repo = await makeRepo();
  try {
    const raw = JSON.stringify({
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      cwd: repo
    });
    const result = await runHook(raw);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("shim: over-cap dispatch via subprocess → warn JSON on stdout, exit 0", async () => {
  const repo = await makeRepo();
  try {
    const raw = agentPayload({
      cwd: repo,
      subagentType: "crew:reviewer",
      prompt: deathModePrompt()
    });
    const result = await runHook(raw);
    assert.equal(result.exitCode, 0);
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
  } finally {
    await cleanup(repo);
  }
});

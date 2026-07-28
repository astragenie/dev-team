import { test, expect } from "bun:test";
// tests/dispatch-size-gate.test.ts
// A3 — the dispatch size gate (8 agent deaths, all from oversized dispatches).
// Unit tests on hooks/lib/dispatch-size-estimate.ts's pure functions and the
// runDispatchSizeGateHook(raw) orchestration (in-process, mkdtemp-repo shape
// mirrors tests/check-builder-terminal-state.test.ts), plus a handful of
// shim-level subprocess tests (mirroring tests/hook-feature-gating.test.ts's
// runHook helper) for the env kill-switch and non-Agent/malformed pass-through.
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
  expect(baseTokensForTier("crew:investigator")).toBe(15_000);
  expect(baseTokensForTier("dev-lite")).toBe(15_000);
  expect(baseTokensForTier("crew:reviewer-lite")).toBe(15_000);
});

test("baseTokensForTier: mid tier (researcher/reviewer/architect) → 30000", () => {
  expect(baseTokensForTier("crew:researcher")).toBe(30_000);
  expect(baseTokensForTier("crew:reviewer")).toBe(30_000);
  expect(baseTokensForTier("architect")).toBe(30_000);
});

test("baseTokensForTier: builder tier → 35000", () => {
  expect(baseTokensForTier("crew:fullstack-dev")).toBe(35_000);
  expect(baseTokensForTier("crew:aiplugin-dev")).toBe(35_000);
});

test("baseTokensForTier: unknown subagent_type → 25000 default", () => {
  expect(baseTokensForTier("crew:some-new-agent")).toBe(25_000);
});

test("fileMentionCount: counts file-path-like tokens and bare dir mentions (additively, no de-dup)", () => {
  expect(fileMentionCount("no files here")).toBe(0);
  // Each "<dir>/<file>.<ext>" mention fires BOTH regexes (a file-path match
  // and a bare-dir match) by design — the formula sums them rather than
  // de-duplicating overlaps, matching the architect's spec literally
  // (2026-07-12-reviewchannel-and-dispatch-gate.md Blocker 2): "hooks/hooks.json"
  // = 1 file match + 1 dir match, same for "agents/reviewer.md" → 4 total.
  expect(fileMentionCount("edit hooks/hooks.json and agents/reviewer.md")).toBe(4);
  expect(fileMentionCount("scan commands/ and skills/ directories")).toBe(2);
});

test("hasWideScopeMarker: matches the incident's over-broad review shape", () => {
  expect(hasWideScopeMarker("review all files in the repo")).toBe(true);
  expect(hasWideScopeMarker("review every file in the codebase")).toBe(true);
  expect(hasWideScopeMarker("read the entire whole repo directories")).toBe(true);
  expect(hasWideScopeMarker("fix the bug in hooks/foo.ts")).toBe(false);
});

test("estimateDispatchSize: under-cap, light tier, no mentions → well under threshold", () => {
  const est = estimateDispatchSize({
    subagentType: "crew:investigator",
    prompt: "Find where parseAgentDispatchSizeInput is defined."
  });
  expect(est.estimatedTokens).toBe(15_000);
  expect(est.overThreshold).toBe(false);
});

test("estimateDispatchSize: death-mode prompt (wide-scope + 40 file mentions) → over threshold", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  expect(est.wideScope).toBe(true);
  expect(
    est.fileMentions >= 27,
    `expected >=27 file mentions, got ${est.fileMentions}`
  ).toBeTruthy();
  expect(
    est.estimatedTokens > DISPATCH_SIZE_THRESHOLD,
    `expected >${DISPATCH_SIZE_THRESHOLD}, got ${est.estimatedTokens}`
  ).toBeTruthy();
  expect(est.overThreshold).toBe(true);
});

// ── parse ────────────────────────────────────────────────────────────────

test("parseAgentDispatchSizeInput: valid Agent payload → parsed", () => {
  const result = parseAgentDispatchSizeInput(
    agentPayload({ cwd: "/repo", subagentType: "crew:fullstack-dev", prompt: "do the thing" })
  );
  expect(result !== null).toBeTruthy();
  expect(result!.subagentType).toBe("crew:fullstack-dev");
  expect(result!.prompt).toBe("do the thing");
  expect(result!.cwd).toBe("/repo");
});

test("parseAgentDispatchSizeInput: non-Agent tool_name → null (untouched)", () => {
  const raw = JSON.stringify({
    session_id: "s1",
    tool_name: "Bash",
    tool_input: { command: "ls" },
    cwd: "/repo"
  });
  expect(parseAgentDispatchSizeInput(raw)).toBe(null);
});

test("parseAgentDispatchSizeInput: malformed JSON → null, no throw", () => {
  expect(parseAgentDispatchSizeInput("not json at all")).toBe(null);
  expect(parseAgentDispatchSizeInput("{broken:")).toBe(null);
  expect(parseAgentDispatchSizeInput("")).toBe(null);
});

test("parseAgentDispatchSizeInput: missing subagent_type → null", () => {
  const raw = JSON.stringify({ tool_name: "Agent", tool_input: { prompt: "x" }, cwd: "/repo" });
  expect(parseAgentDispatchSizeInput(raw)).toBe(null);
});

// ── decide + build output ───────────────────────────────────────────────

test("decideDispatchSizeAction: under threshold → none regardless of mode", () => {
  const est = estimateDispatchSize({ subagentType: "crew:investigator", prompt: "small task" });
  expect(decideDispatchSizeAction(est, false).action).toBe("none");
  expect(decideDispatchSizeAction(est, true).action).toBe("none");
});

test("decideDispatchSizeAction: over threshold + warn mode (flag off) → warn", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  expect(decideDispatchSizeAction(est, false).action).toBe("warn");
});

test("decideDispatchSizeAction: over threshold + block mode (flag on) → block", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  expect(decideDispatchSizeAction(est, true).action).toBe("block");
});

test("buildDispatchSizeOutput: none → null", () => {
  const est = estimateDispatchSize({ subagentType: "crew:investigator", prompt: "small" });
  expect(buildDispatchSizeOutput(decideDispatchSizeAction(est, false))).toBe(null);
});

test("buildDispatchSizeOutput: warn → allow + systemMessage nudging a split", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  const out = buildDispatchSizeOutput(decideDispatchSizeAction(est, false));
  expect(out !== null).toBeTruthy();
  const parsed = JSON.parse(out as string);
  expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
  expect(parsed.systemMessage).toMatch(/split/i);
  expect(parsed.systemMessage).toMatch(/dispatch-size-gate/);
});

test("buildDispatchSizeOutput: block → {decision:'block'} with an actionable split message", () => {
  const est = estimateDispatchSize({ subagentType: "crew:reviewer", prompt: deathModePrompt() });
  const out = buildDispatchSizeOutput(decideDispatchSizeAction(est, true));
  expect(out !== null).toBeTruthy();
  const parsed = JSON.parse(out as string);
  expect(parsed.decision).toBe("block");
  expect(parsed.reason).toMatch(/split/i);
  expect(parsed.reason).toMatch(/8 agents have died/);
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
    expect(await runDispatchSizeGateHook(raw)).toBe(null);
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
    expect(out !== null).toBeTruthy();
    const parsed = JSON.parse(out as string);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
    expect(parsed.systemMessage).toBeTruthy();
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
    expect(out !== null).toBeTruthy();
    const parsed = JSON.parse(out as string);
    expect(parsed.decision).toBe("block");
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
    expect(out !== null).toBeTruthy();
    const parsed = JSON.parse(out as string);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
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
    expect(await runDispatchSizeGateHook(raw)).toBe(null);
  } finally {
    await cleanup(repo);
  }
});

test("runDispatchSizeGateHook: malformed payload → pass (null), no throw", async () => {
  expect(await runDispatchSizeGateHook("not json at all")).toBe(null);
  expect(await runDispatchSizeGateHook("{broken:")).toBe(null);
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
    expect(row, "expected a dispatch-size-gate calibration row").toBeTruthy();
    expect(row?.action).toBe("none");
    expect(row?.subagentType).toBe("crew:investigator");
    expect(typeof row?.estimatedTokens).toBe("number");
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
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  } finally {
    await cleanup(repo);
  }
});

test("shim: malformed stdin → exit 0, no crash, no stdout", async () => {
  const result = await runHook("not json at all");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
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
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
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
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
  } finally {
    await cleanup(repo);
  }
});

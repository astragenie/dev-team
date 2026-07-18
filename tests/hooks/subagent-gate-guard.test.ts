import { test, expect } from "bun:test";
// tests/hooks/subagent-gate-guard.test.ts
// dev-team#257 piece 1 — SubagentStop gate-guard. mkdtemp-repo shape mirrors
// tests/check-builder-terminal-state.test.ts; uses bun:test (not node:test)
// to avoid https://github.com/oven-sh/bun/issues/5090 (node:test's
// "test() inside another test()" false positive when multiple node:test
// files execute concurrently in the same Bun worker — reproduced locally
// running the full `tests/` suite with these files under node:test).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  runSubagentGateGuardHook,
  hasHonestNotDoneMarker,
  detectRedGate
} from "../../hooks/lib/subagent-gate-guard.ts";

async function makeRepo(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "gate-guard-test-"));
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

function makeGateEntry(status: string) {
  return { status, updatedAt: new Date().toISOString() };
}

function makeRun(reviewStatus: string | null, validationStatus: string | null = null) {
  return {
    title: "Test Run",
    goal: "",
    mode: "single-session",
    status: "active",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    next: "",
    gates: {
      review: reviewStatus === null ? null : makeGateEntry(reviewStatus),
      validation: validationStatus === null ? null : makeGateEntry(validationStatus),
      deployment: { dev: null, prod: null },
      blocked: null,
      escalation: null,
      incident: null,
      help: null
    },
    artifacts: {
      runBrief: null,
      handoffs: [],
      reviewResult: null,
      validationPlan: null,
      validationResult: null,
      deploymentChecks: { dev: null, prod: null },
      finalSynthesis: null
    }
  };
}

async function writeWorkflowState(repo: string, run: unknown): Promise<void> {
  const dir = path.join(repo, ".claude", "state", "crew");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "workflow-state.json"),
    JSON.stringify({
      version: "1.0",
      updatedAt: new Date().toISOString(),
      currentRun: run,
      recentRuns: []
    }),
    "utf8"
  );
}

function payload(opts: {
  session_id?: string;
  cwd: string;
  agent_name?: string | null;
  last_assistant_message?: string | null;
  stop_hook_active?: boolean;
}): string {
  const obj: Record<string, unknown> = {
    session_id: opts.session_id ?? "sess-1",
    cwd: opts.cwd
  };
  if (opts.agent_name !== undefined && opts.agent_name !== null) obj.agent_name = opts.agent_name;
  if (opts.last_assistant_message !== undefined && opts.last_assistant_message !== null) {
    obj.last_assistant_message = opts.last_assistant_message;
  }
  if (opts.stop_hook_active !== undefined) obj.stop_hook_active = opts.stop_hook_active;
  return JSON.stringify(obj);
}

// (a) red review gate + DONE-shaped message + builder-tier agent → warn (default mode)
test("red review gate + DONE-shaped message → warn (default warn-only mode)", async () => {
  const repo = await makeRepo();
  try {
    await writeWorkflowState(repo, makeRun("failed"));
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "DONE: shipped the feature."
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out as string);
    expect(parsed.decision).toBeUndefined();
    expect(parsed.systemMessage).toMatch(/review gate/);
  } finally {
    await cleanup(repo);
  }
});

// (b) red review gate + block mode enabled → decision:"block"
test("red review gate + gate-guard feature enabled → block", async () => {
  const repo = await makeRepo();
  try {
    await writeWorkflowState(repo, makeRun("failed"));
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "gate-guard": { enabled: true } } }),
      "utf8"
    );
    const raw = payload({
      cwd: repo,
      agent_name: "crew:backend-dev",
      last_assistant_message: "DONE: shipped the feature."
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out as string);
    expect(parsed.decision).toBe("block");
    expect(parsed.reason).toMatch(/review gate/);
  } finally {
    await cleanup(repo);
  }
});

// (c) red validation gate + honest BLOCKED: report → pass (never block an honest report)
test("red validation gate + BLOCKED: report → pass (honest report is never blocked)", async () => {
  const repo = await makeRepo();
  try {
    await writeWorkflowState(repo, makeRun(null, "failed"));
    const raw = payload({
      cwd: repo,
      agent_name: "crew:frontend-dev",
      last_assistant_message: "BLOCKED: validation gate flagged a failing test I can't fix alone."
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (d) green gates (passed) + DONE message → pass
test("passed gates + DONE message → pass", async () => {
  const repo = await makeRepo();
  try {
    await writeWorkflowState(repo, makeRun("passed", "passed"));
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "DONE: shipped the feature."
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (e) no workflow-state.json at all → pass (fail-open, no run to check)
test("no workflow-state.json → pass (fail-open)", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "DONE: shipped the feature."
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (f) malformed workflow-state.json → pass (fail-open, never throw)
test("malformed workflow-state.json → pass, no throw", async () => {
  const repo = await makeRepo();
  try {
    const dir = path.join(repo, ".claude", "state", "crew");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "workflow-state.json"), "{ not json", "utf8");
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "DONE: shipped the feature."
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (g) non-builder-tier agent → pass, untouched
test("non-builder-tier agent (reviewer) → pass, untouched", async () => {
  const repo = await makeRepo();
  try {
    await writeWorkflowState(repo, makeRun("failed"));
    const raw = payload({
      cwd: repo,
      agent_name: "crew:reviewer",
      last_assistant_message: "DONE: shipped the feature."
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (h) stop_hook_active true → pass regardless
test("stop_hook_active true → pass regardless of gate state", async () => {
  const repo = await makeRepo();
  try {
    await writeWorkflowState(repo, makeRun("failed"));
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "DONE: shipped the feature.",
      stop_hook_active: true
    });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (i) missing last_assistant_message + red gate → pass (residual gap, never guess)
test("missing last_assistant_message + red gate → pass (never guess)", async () => {
  const repo = await makeRepo();
  try {
    await writeWorkflowState(repo, makeRun("failed"));
    const raw = payload({ cwd: repo, agent_name: "crew:fullstack-dev" });
    const out = await runSubagentGateGuardHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (j) malformed JSON input → pass, no throw
test("malformed JSON input → pass, no throw", async () => {
  const out = await runSubagentGateGuardHook("not json");
  expect(out).toBeNull();
});

// Pure-function unit coverage
test("hasHonestNotDoneMarker recognizes BLOCKED/HELP/HELP-REQUEST, not DONE", () => {
  expect(hasHonestNotDoneMarker("BLOCKED: waiting on creds.")).toBe(true);
  expect(hasHonestNotDoneMarker("HELP: need a human.")).toBe(true);
  expect(hasHonestNotDoneMarker("HELP-REQUEST: escalating.")).toBe(true);
  expect(hasHonestNotDoneMarker("DONE: shipped it.")).toBe(false);
  expect(hasHonestNotDoneMarker("Now let's open the PR.")).toBe(false);
});

test("detectRedGate prefers review over validation and reports status", () => {
  expect(detectRedGate(null as never)).toEqual({ red: false, gate: null, status: null });
  expect(detectRedGate(makeRun("failed") as never)).toEqual({
    red: true,
    gate: "review",
    status: "failed"
  });
  expect(detectRedGate(makeRun(null, "failed") as never)).toEqual({
    red: true,
    gate: "validation",
    status: "failed"
  });
  expect(detectRedGate(makeRun("passed", "passed") as never)).toEqual({
    red: false,
    gate: null,
    status: null
  });
});

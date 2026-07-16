import { test, expect } from "bun:test";
// tests/subagent-return.test.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";
import fs from "node:fs/promises";
import os from "node:os";
import {
  parseThreshold,
  hasArtifactPath,
  checkSubagentReturn
} from "../scripts/lib/subagent-return/check.ts";
import {
  runCheckSubagentReturnHook,
  parseUsageMetrics
} from "../hooks/lib/check-subagent-return.ts";
import {
  runCheckReviewerDecisionHook,
  hasDecisionLine,
  hasDeliveredDecision,
  isReviewerTierAgent
} from "../hooks/lib/check-reviewer-decision.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(__dirname, "..", "hooks", "check-subagent-return.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * In-process hook runner: import core, call directly, return { exitCode: 0, stdout, stderr: "" }
 */
async function runHook(
  stdin: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const out = await runCheckSubagentReturnHook(stdin);
  return { exitCode: 0, stdout: out ?? "", stderr: "" };
}

/**
 * Spawn-based smoke runner: validates stdin/stdout wiring.
 */
function runHookSpawn(
  stdin: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", HOOK_PATH], {
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

/** Helper: write a temp crew.json with a feature config + payload pointing cwd → that repo. */
async function makeRepoWithCrewJson(featuresJson: Record<string, unknown>): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "subagent-return-test-"));
  await fs.mkdir(path.join(repo, ".claude"), { recursive: true });
  await fs.writeFile(
    path.join(repo, ".claude", "crew.json"),
    JSON.stringify({ features: featuresJson }),
    "utf8"
  );
  return repo;
}

// Plain isolated tmp repo (no crew.json needed). FEAT-188 S1a wires
// learnings.jsonl capture onto warn-triggering paths — tests that trigger a
// warn must run against an isolated repo, never the real `process.cwd()`
// dev-team checkout, or they'd append real rows into the tracked
// .claude/artifacts/loop/learnings.jsonl on every test run.
async function makeTmpRepo(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "subagent-return-tmp-"));
}

async function readLearningsLines(repo: string): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(
      path.join(repo, ".claude", "artifacts", "loop", "learnings.jsonl"),
      "utf8"
    );
    return raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

// FEAT-193 S1: seed a minimal enabled gepa.config.json so captureFailureTrial
// (the dual-write sibling of captureFailureLearning) is not a config no-op.
async function seedGepaConfig(repo: string): Promise<void> {
  await fs.writeFile(
    path.join(repo, "gepa.config.json"),
    JSON.stringify({
      capture: { enabled: true, exclude: [], walltime_ms: 2000 },
      storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" }
    })
  );
}

async function readTrialLines(repo: string, agent: string): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(
      path.join(repo, ".claude", "artifacts", "crew", "gepa", "trials", `${agent}.jsonl`),
      "utf8"
    );
    return raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

// Build a PostToolUse Agent stdin payload with the given body.
function makeStdin(body: string, cwd = process.cwd()) {
  return JSON.stringify({
    session_id: "test-session",
    tool_name: "Agent",
    cwd,
    tool_response: { content: body }
  });
}

/** Returns a string of exactly `n` ASCII chars. */
function makeBody(n: number) {
  return "x".repeat(n);
}

// Build a SubagentStop stdin payload (dev-team#199 reviewer-decision-guard).
function makeSubagentStopStdin(opts: {
  agentName?: string;
  message?: string;
  cwd?: string;
  stopHookActive?: boolean;
  sessionId?: string;
}) {
  const payload: Record<string, unknown> = {
    session_id: opts.sessionId ?? "test-session",
    cwd: opts.cwd ?? process.cwd()
  };
  if (opts.agentName !== undefined) payload["agent_name"] = opts.agentName;
  if (opts.message !== undefined) payload["last_assistant_message"] = opts.message;
  if (opts.stopHookActive !== undefined) payload["stop_hook_active"] = opts.stopHookActive;
  return JSON.stringify(payload);
}

// ── Hook integration tests ────────────────────────────────────────────────────

// AC-7: body ≤ threshold (100 bytes) → silent
test("AC-7: body ≤ threshold (100 bytes) → silent", async () => {
  const result = await runHook(makeStdin(makeBody(100)));
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// AC-8: body > threshold (1000 bytes) WITH artifact path → silent
test("AC-8: body > threshold WITH .claude/artifacts/crew/handoffs/foo.md → silent", async () => {
  const body = makeBody(800) + " .claude/artifacts/crew/handoffs/foo.md " + makeBody(100);
  const result = await runHook(makeStdin(body));
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// SMOKE: Hook runtime contract with warning path (verifies stdin→stdout payload wiring)
// AC-9: body > threshold WITHOUT artifact path → warn with byte count + cost-discipline rule #2
test("smoke: AC-9 — body > threshold (1000 bytes) WITHOUT artifact path → warn", async () => {
  const repo = await makeTmpRepo();
  try {
    const body = makeBody(1000);
    const result = await runHookSpawn(makeStdin(body, repo));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe("approve");
    expect(parsed.systemMessage).toMatch(/cost-discipline rule #2/);
    expect(parsed.systemMessage).toMatch(/1000/);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// Feature off via crew.json: short-circuit (silent even on large body without path)
test("config: subagent-inline-warn disabled → silent even on large body", async () => {
  const repo = await makeRepoWithCrewJson({ "subagent-inline-warn": { enabled: false } });
  try {
    const result = await runHook(makeStdin(makeBody(5000), repo));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// Threshold knob in crew.json: 2048 → body=1500 silent
test("config: features['subagent-inline-warn'].threshold=2048 + body=1500 → silent", async () => {
  const repo = await makeRepoWithCrewJson({
    "subagent-inline-warn": { enabled: true, threshold: 2048 }
  });
  try {
    const result = await runHook(makeStdin(makeBody(1500), repo));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// Threshold knob in crew.json: 2048 → body=2500 warn
test("config: features['subagent-inline-warn'].threshold=2048 + body=2500 → warn", async () => {
  const repo = await makeRepoWithCrewJson({
    "subagent-inline-warn": { enabled: true, threshold: 2048 }
  });
  try {
    const result = await runHook(makeStdin(makeBody(2500), repo));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe("approve");
    expect(parsed.systemMessage).toMatch(/cost-discipline rule #2/);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// Default-on: no crew.json, body=1000 no path → warn at default 512 threshold
test("default-on — no crew.json + body=1000 no path → warn", async () => {
  const repo = await makeTmpRepo();
  try {
    const result = await runHookSpawn(makeStdin(makeBody(1000), repo));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe("approve");
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// AC-12: Windows-style path separator → silent (path detected)
test("AC-12a: Windows path .claude\\artifacts\\crew\\handoffs\\foo.md → silent", async () => {
  const body = makeBody(200) + " .claude\\artifacts\\crew\\handoffs\\foo.md " + makeBody(200);
  const result = await runHook(makeStdin(body));
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// AC-12: Reviews path → silent
test("AC-12b: .claude/artifacts/crew/reviews/foo.md → silent", async () => {
  const body = makeBody(200) + " .claude/artifacts/crew/reviews/foo.md " + makeBody(200);
  const result = await runHook(makeStdin(body));
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// AC-12: Validations path → silent
test("AC-12c: .claude/artifacts/crew/validations/foo.md → silent", async () => {
  const body = makeBody(200) + " .claude/artifacts/crew/validations/foo.md " + makeBody(200);
  const result = await runHook(makeStdin(body));
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// AC-11: Malformed JSON on stdin → silent
test("AC-11a: malformed JSON on stdin → silent", async () => {
  const result = await runHook("not json at all");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// AC-11: Missing tool_response → silent
test("AC-11b: missing tool_response → silent", async () => {
  const result = await runHook(
    JSON.stringify({ session_id: "s1", tool_name: "Agent", cwd: process.cwd() })
  );
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// AC-11: Empty body → silent
test("AC-11c: empty body string → silent", async () => {
  const result = await runHook(
    JSON.stringify({
      session_id: "s1",
      tool_name: "Agent",
      cwd: process.cwd(),
      tool_response: { content: "" }
    })
  );
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

// tool_response.body fallback → works
test("tool_response.body fallback: body field used when content absent", async () => {
  const repo = await makeTmpRepo();
  try {
    const payload = JSON.stringify({
      session_id: "s1",
      tool_name: "Agent",
      cwd: repo,
      tool_response: { body: makeBody(1000) }
    });
    const result = await runHook(payload);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe("approve");
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// tool_response as string → works
test("tool_response as plain string: string body used as fallback", async () => {
  const repo = await makeTmpRepo();
  try {
    const payload = JSON.stringify({
      session_id: "s1",
      tool_name: "Agent",
      cwd: repo,
      tool_response: makeBody(1000)
    });
    const result = await runHook(payload);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe("approve");
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// AC-4: decision is always "approve", never "block"
test("AC-4: output decision is always approve, never block", async () => {
  const repo = await makeTmpRepo();
  try {
    const result = await runHook(makeStdin(makeBody(2000), repo));
    expect(result.exitCode).toBe(0);
    if (result.stdout !== "") {
      const parsed = JSON.parse(result.stdout);
      expect(parsed.decision).not.toBe("block");
      expect(parsed.decision).toBe("approve");
    }
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// ── FEAT-188 S1a AC-3: inline-return-warn capture ───────────────────────────
// Wire capture onto the EXISTING `subagent-return:inline-return-warn` signal
// (hyphenated — not a new event). Every warn-triggering body (large,
// pathless, no terminal status) must append a failure-kind learnings entry.

test("AC-3: inline-return-warn fires → captures a failure entry in learnings.jsonl", async () => {
  const repo = await makeTmpRepo();
  try {
    const result = await runHook(makeStdin(makeBody(1000), repo));
    expect(result.stdout).not.toBe("");
    const lines = await readLearningsLines(repo);
    const captured = lines.filter((l) => l.source === "inline-return-warn");
    expect(captured.length).toBe(1);
    expect(captured[0]!.kind).toBe("failure");
    expect(captured[0]!.summary as string).toMatch(/cost-discipline rule #2/);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("AC-3: no warn (short body) → no learnings.jsonl capture", async () => {
  const repo = await makeTmpRepo();
  try {
    await runHook(makeStdin(makeBody(100), repo));
    const lines = await readLearningsLines(repo);
    expect(lines.length).toBe(0);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("AC-3: warn with feature disabled → no capture either (gate shared with the warn itself)", async () => {
  const repo = await makeRepoWithCrewJson({ "subagent-inline-warn": { enabled: false } });
  try {
    await runHook(makeStdin(makeBody(5000), repo));
    const lines = await readLearningsLines(repo);
    expect(lines.length).toBe(0);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// ── FEAT-188 S1a AC-4: subagent_incomplete (NEW signal) ─────────────────────
// Defined + emitted only when the oversized, pathless return ALSO carries no
// terminal status marker (DONE/BLOCKED/HELP/IN-PROGRESS) — a strict subset
// of the inline-return-warn trigger, so this never fires on a NEW condition
// the warn itself hasn't already gated on (no additional false-positive
// surface). See scripts/lib/subagent-return/incomplete-detector.ts.

test("AC-4: oversized pathless body with NO terminal status → subagent-incomplete event + capture", async () => {
  const repo = await makeTmpRepo();
  try {
    const result = await runHook(makeStdin(makeBody(1000), repo));
    expect(result.stdout).not.toBe("");
    const lines = await readLearningsLines(repo);
    const captured = lines.filter((l) => l.source === "subagent-incomplete");
    expect(captured.length).toBe(1);
    expect(captured[0]!.kind).toBe("failure");

    const events = await fs.readFile(path.join(repo, ".claude", "logs", "events.jsonl"), "utf8");
    const eventLines = events
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
    expect(
      eventLines.some((e) => e.event === "subagent-return:subagent-incomplete"),
      "expected a subagent-return:subagent-incomplete event log entry"
    ).toBeTruthy();
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("AC-4: oversized pathless body WITH a terminal status marker → no subagent-incomplete capture", async () => {
  const repo = await makeTmpRepo();
  try {
    const body = `DONE: finished the task.\n${makeBody(1000)}`;
    await runHook(makeStdin(body, repo));
    const lines = await readLearningsLines(repo);
    expect(
      lines.filter((l) => l.source === "subagent-incomplete").length,
      "a declared terminal status must suppress the new signal"
    ).toBe(0);
    // inline-return-warn still fires independently (still no artifact path).
    expect(lines.filter((l) => l.source === "inline-return-warn").length).toBe(1);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// ── FEAT-193 S1: dual-write into the GEPA trial store ───────────────────────
// Same inline-return-warn / subagent-incomplete signals ALSO append a failing
// Trial to .claude/artifacts/crew/gepa/trials/unknown.jsonl (agent identity is
// unavailable at this hook, per capture-failure-trial.ts's doc comment).

test("FEAT-193 S1: inline-return-warn also dual-writes a failing GEPA trial", async () => {
  const repo = await makeTmpRepo();
  try {
    await seedGepaConfig(repo);
    await runHook(makeStdin(makeBody(1000), repo));
    const trials = await readTrialLines(repo, "unknown");
    const captured = trials.filter(
      (t) => (t.input as Record<string, unknown>)?.source === "inline-return-warn"
    );
    expect(captured.length).toBe(1);
    expect(captured[0]!.agent).toBe("unknown");
    expect(captured[0]!.phase).toBe("build");
    expect(captured[0]!.source).toBe("captured");
    expect((captured[0]!.score as Record<string, unknown>).pass).toBe(false);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("FEAT-193 S1: subagent-incomplete also dual-writes a failing GEPA trial", async () => {
  const repo = await makeTmpRepo();
  try {
    await seedGepaConfig(repo);
    await runHook(makeStdin(makeBody(1000), repo));
    const trials = await readTrialLines(repo, "unknown");
    const captured = trials.filter(
      (t) => (t.input as Record<string, unknown>)?.source === "subagent-incomplete"
    );
    expect(captured.length).toBe(1);
    expect((captured[0]!.score as Record<string, unknown>).rationale as string).toMatch(
      /no terminal status marker/
    );
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("AC-4: body with an artifact path → no subagent-incomplete (already has a recorded outcome)", async () => {
  const repo = await makeTmpRepo();
  try {
    const body = makeBody(800) + " .claude/artifacts/crew/handoffs/foo.md " + makeBody(100);
    await runHook(makeStdin(body, repo));
    const lines = await readLearningsLines(repo);
    expect(lines.length).toBe(0);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// ── Pure library unit tests ───────────────────────────────────────────────────

// parseThreshold
test("parseThreshold: undefined returns default 512", () => {
  expect(parseThreshold(undefined)).toBe(512);
});

test('parseThreshold: "" returns default 512', () => {
  expect(parseThreshold("")).toBe(512);
});

test('parseThreshold: "0" returns 0', () => {
  expect(parseThreshold("0")).toBe(0);
});

test('parseThreshold: "2048" returns 2048', () => {
  expect(parseThreshold("2048")).toBe(2048);
});

test("parseThreshold: non-numeric string returns default 512", () => {
  expect(parseThreshold("banana")).toBe(512);
});

test("parseThreshold: custom default used when value is undefined", () => {
  expect(parseThreshold(undefined, 1024)).toBe(1024);
});

test("parseThreshold: non-numeric with custom default returns custom default", () => {
  expect(parseThreshold("abc", 256)).toBe(256);
});

// hasArtifactPath
test("hasArtifactPath: POSIX handoffs path → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/handoffs/foo.md")).toBeTruthy();
});

test("hasArtifactPath: Windows handoffs path → true", () => {
  expect(hasArtifactPath(".claude\\artifacts\\crew\\handoffs\\foo.md")).toBeTruthy();
});

test("hasArtifactPath: reviews subdir → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/reviews/review-result.md")).toBeTruthy();
});

test("hasArtifactPath: validations subdir → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/validations/val.md")).toBeTruthy();
});

test("hasArtifactPath: deployments subdir → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/deployments/dep.md")).toBeTruthy();
});

test("hasArtifactPath: runs subdir → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/runs/run.md")).toBeTruthy();
});

test("hasArtifactPath: cost subdir → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/cost/cost.md")).toBeTruthy();
});

test("hasArtifactPath: cost-insights subdir → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/cost-insights/ci.md")).toBeTruthy();
});

test("hasArtifactPath: agents subdir → true", () => {
  expect(hasArtifactPath(".claude/artifacts/crew/agents/a.md")).toBeTruthy();
});

test("hasArtifactPath: random text → false", () => {
  expect(!hasArtifactPath("nothing useful here")).toBeTruthy();
});

test("hasArtifactPath: path embedded in surrounding text → true", () => {
  expect(
    hasArtifactPath(
      "see the report at C:\\work\\mega\\hero-crew\\.claude/artifacts/crew/handoffs/20260601T123456Z-handoff-foo.md for details"
    )
  ).toBeTruthy();
});

test("hasArtifactPath: wrong subdir → false", () => {
  expect(!hasArtifactPath(".claude/artifacts/crew/other/foo.md")).toBeTruthy();
});

// checkSubagentReturn
test("checkSubagentReturn: body ≤ threshold → no warnings", () => {
  const { warnings } = checkSubagentReturn({ body: "x".repeat(100), threshold: 512 });
  expect(warnings.length).toBe(0);
});

test("checkSubagentReturn: body > threshold WITH artifact path → no warnings", () => {
  const body = "x".repeat(600) + " .claude/artifacts/crew/handoffs/foo.md";
  const { warnings } = checkSubagentReturn({ body, threshold: 512 });
  expect(warnings.length).toBe(0);
});

test("checkSubagentReturn: body > threshold WITHOUT artifact path → one warning", () => {
  const body = "x".repeat(600);
  const { warnings } = checkSubagentReturn({ body, threshold: 512 });
  expect(warnings.length).toBe(1);
  expect(warnings[0]!).toMatch(/cost-discipline rule #2/);
  expect(warnings[0]!.includes("600"), `Expected byte count in warn: ${warnings[0]!}`).toBeTruthy();
});

test("checkSubagentReturn: threshold=0 means body > 0 threshold is never triggered from check level (caller exits before)", () => {
  // When threshold=0, byteLen > 0 is always true, but hasArtifactPath is false for plain text
  // This is the edge case: threshold=0 semantics are "caller exits early" per hook, but
  // the pure function itself would still warn — confirm the library behavior
  const body = "x".repeat(10);
  const { warnings } = checkSubagentReturn({ body, threshold: 0 });
  // With threshold 0, any non-empty body without path warns (library is pure; hook exits before calling this)
  expect(warnings.length).toBe(1);
});

test("checkSubagentReturn: UTF-8 multi-byte characters measured by byte length", () => {
  // "é" is 2 bytes in UTF-8; repeat 300 times = 600 bytes but 300 chars
  const body = "é".repeat(300);
  const byteLen = Buffer.byteLength(body, "utf8");
  expect(byteLen > 512, `Expected >512 bytes, got ${byteLen}`).toBeTruthy();
  const { warnings } = checkSubagentReturn({ body, threshold: 512 });
  expect(warnings.length).toBe(1);
  expect(warnings[0]!.includes(String(byteLen))).toBeTruthy();
});

// ── parseUsageMetrics ─────────────────────────────────────────────────────────

test("parseUsageMetrics: full <usage> block → all three fields parsed", () => {
  const body =
    "Handoff: path/to/file.md\n<usage>total_tokens: 8500 tool_uses: 32 duration_ms: 120000</usage>";
  const m = parseUsageMetrics(body);
  expect(m.totalTokens).toBe(8500);
  expect(m.toolUses).toBe(32);
  expect(m.durationMs).toBe(120000);
});

test("parseUsageMetrics: no <usage> block → all zeros", () => {
  const m = parseUsageMetrics("No usage info here at all.");
  expect(m.totalTokens).toBe(0);
  expect(m.toolUses).toBe(0);
  expect(m.durationMs).toBe(0);
});

test("parseUsageMetrics: only total_tokens present → others zero", () => {
  const m = parseUsageMetrics("<usage>total_tokens: 300</usage>");
  expect(m.totalTokens).toBe(300);
  expect(m.toolUses).toBe(0);
  expect(m.durationMs).toBe(0);
});

// ── dev-team#199: SubagentStop reviewer-decision-guard ─────────────────────
// Reviewer-tier subagent idles without delivering a decision → block via the
// same SubagentStop/Stop {decision:"block", reason} contract the
// plugin-dev:hook-development skill documents. Non-reviewer agents and
// runtimes that don't expose last_assistant_message are never blocked.

test("isReviewerTierAgent: recognizes all five reviewer-tier agents, namespaced or bare", () => {
  for (const bare of [
    "reviewer",
    "reviewer-lite",
    "typescript-reviewer",
    "csharp-reviewer",
    "architect-reviewer"
  ]) {
    expect(isReviewerTierAgent(bare), `expected ${bare} to be reviewer-tier`).toBeTruthy();
    expect(
      isReviewerTierAgent(`crew:${bare}`),
      `expected crew:${bare} to be reviewer-tier`
    ).toBeTruthy();
  }
});

test("isReviewerTierAgent: builder/non-reviewer agents are not reviewer-tier", () => {
  expect(!isReviewerTierAgent("crew:fullstack-dev")).toBeTruthy();
  expect(!isReviewerTierAgent("verifier")).toBeTruthy();
  expect(!isReviewerTierAgent("dev-lite")).toBeTruthy();
});

test("hasDecisionLine: matches decision: approved / approved_with_notes / rejected, case-insensitively", () => {
  expect(hasDecisionLine("Findings summarized.\ndecision: approved\n")).toBeTruthy();
  expect(
    hasDecisionLine("Decision: approved_with_notes — two medium findings noted.")
  ).toBeTruthy();
  expect(hasDecisionLine("decision=rejected: scope exceeded")).toBeTruthy();
  expect(!hasDecisionLine("Still reviewing, no decision yet.")).toBeTruthy();
});

test("hasDeliveredDecision: a review-result artifact path counts even without literal 'decision:' text", () => {
  const msg =
    "Review complete: .claude/artifacts/crew/reviews/20260710T000000Z-review-result-foo.md";
  expect(!hasDecisionLine(msg)).toBeTruthy();
  expect(hasDeliveredDecision(msg)).toBeTruthy();
});

test("reviewer decision line present → allowed (no block)", async () => {
  const stdin = makeSubagentStopStdin({
    agentName: "crew:reviewer",
    message:
      "review-result written. decision: approved_with_notes — 1 medium finding, isolated fix."
  });
  const out = await runCheckReviewerDecisionHook(stdin);
  expect(out).toBe(null);
});

test("reviewer with NO decision line and no artifact path → blocked", async () => {
  const stdin = makeSubagentStopStdin({
    agentName: "crew:typescript-reviewer",
    message: "Looked through the diff, seems mostly fine, wrapping up now."
  });
  const out = await runCheckReviewerDecisionHook(stdin);
  expect(out).not.toBe(null);
  const parsed = JSON.parse(out as string);
  expect(parsed.decision).toBe("block");
  expect(parsed.reason).toMatch(/decision-guard/);
  expect(parsed.reason).toMatch(/crew:typescript-reviewer/);
});

test("non-reviewer agent (e.g. crew:fullstack-dev) with no decision line → unaffected", async () => {
  const stdin = makeSubagentStopStdin({
    agentName: "crew:fullstack-dev",
    message: "Implementation wrapping up, no decision line here at all."
  });
  const out = await runCheckReviewerDecisionHook(stdin);
  expect(out).toBe(null);
});

test("reviewer with a review-result artifact path but no literal 'decision:' text → allowed", async () => {
  const stdin = makeSubagentStopStdin({
    agentName: "crew:reviewer",
    message: "Done: .claude/artifacts/crew/reviews/20260710T000000Z-review-result-slice.md"
  });
  const out = await runCheckReviewerDecisionHook(stdin);
  expect(out).toBe(null);
});

test("stop_hook_active=true → never re-blocks (loop safety), even with no decision", async () => {
  const stdin = makeSubagentStopStdin({
    agentName: "crew:reviewer",
    message: "Still nothing delivered.",
    stopHookActive: true
  });
  const out = await runCheckReviewerDecisionHook(stdin);
  expect(out).toBe(null);
});

test("reviewer with no last_assistant_message field → fails open (documented residual gap)", async () => {
  const stdin = makeSubagentStopStdin({ agentName: "crew:architect-reviewer" });
  const out = await runCheckReviewerDecisionHook(stdin);
  expect(out).toBe(null);
});

test("missing agent_name → unaffected (cannot classify tier)", async () => {
  const stdin = makeSubagentStopStdin({ message: "No agent identity on this payload." });
  const out = await runCheckReviewerDecisionHook(stdin);
  expect(out).toBe(null);
});

test("malformed JSON on stdin → silent", async () => {
  const out = await runCheckReviewerDecisionHook("not json at all");
  expect(out).toBe(null);
});

test("config: features['reviewer-decision-guard'] disabled → silent even with no decision", async () => {
  const repo = await makeRepoWithCrewJson({ "reviewer-decision-guard": { enabled: false } });
  try {
    const stdin = makeSubagentStopStdin({
      agentName: "crew:csharp-reviewer",
      message: "Wrapping up, no decision stated.",
      cwd: repo
    });
    const out = await runCheckReviewerDecisionHook(stdin);
    expect(out).toBe(null);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

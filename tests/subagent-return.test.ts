// tests/subagent-return.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
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

// ── Hook integration tests ────────────────────────────────────────────────────

// AC-7: body ≤ threshold (100 bytes) → silent
test("AC-7: body ≤ threshold (100 bytes) → silent", async () => {
  const result = await runHook(makeStdin(makeBody(100)));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// AC-8: body > threshold (1000 bytes) WITH artifact path → silent
test("AC-8: body > threshold WITH .claude/artifacts/crew/handoffs/foo.md → silent", async () => {
  const body = makeBody(800) + " .claude/artifacts/crew/handoffs/foo.md " + makeBody(100);
  const result = await runHook(makeStdin(body));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// SMOKE: Hook runtime contract with warning path (verifies stdin→stdout payload wiring)
// AC-9: body > threshold WITHOUT artifact path → warn with byte count + cost-discipline rule #2
test("smoke: AC-9 — body > threshold (1000 bytes) WITHOUT artifact path → warn", async () => {
  const body = makeBody(1000);
  const result = await runHookSpawn(makeStdin(body));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /cost-discipline rule #2/);
  assert.match(parsed.systemMessage, /1000/);
});

// Feature off via crew.json: short-circuit (silent even on large body without path)
test("config: subagent-inline-warn disabled → silent even on large body", async () => {
  const repo = await makeRepoWithCrewJson({ "subagent-inline-warn": { enabled: false } });
  try {
    const result = await runHook(makeStdin(makeBody(5000), repo));
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
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
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
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
    assert.equal(result.exitCode, 0);
    assert.notEqual(result.stdout, "");
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "approve");
    assert.match(parsed.systemMessage, /cost-discipline rule #2/);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

// Default-on: no crew.json, body=1000 no path → warn at default 512 threshold
test("default-on — no crew.json + body=1000 no path → warn", async () => {
  const result = await runHookSpawn(makeStdin(makeBody(1000)));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
});

// AC-12: Windows-style path separator → silent (path detected)
test("AC-12a: Windows path .claude\\artifacts\\crew\\handoffs\\foo.md → silent", async () => {
  const body = makeBody(200) + " .claude\\artifacts\\crew\\handoffs\\foo.md " + makeBody(200);
  const result = await runHook(makeStdin(body));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// AC-12: Reviews path → silent
test("AC-12b: .claude/artifacts/crew/reviews/foo.md → silent", async () => {
  const body = makeBody(200) + " .claude/artifacts/crew/reviews/foo.md " + makeBody(200);
  const result = await runHook(makeStdin(body));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// AC-12: Validations path → silent
test("AC-12c: .claude/artifacts/crew/validations/foo.md → silent", async () => {
  const body = makeBody(200) + " .claude/artifacts/crew/validations/foo.md " + makeBody(200);
  const result = await runHook(makeStdin(body));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// AC-11: Malformed JSON on stdin → silent
test("AC-11a: malformed JSON on stdin → silent", async () => {
  const result = await runHook("not json at all");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// AC-11: Missing tool_response → silent
test("AC-11b: missing tool_response → silent", async () => {
  const result = await runHook(
    JSON.stringify({ session_id: "s1", tool_name: "Agent", cwd: process.cwd() })
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
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
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// tool_response.body fallback → works
test("tool_response.body fallback: body field used when content absent", async () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_name: "Agent",
    cwd: process.cwd(),
    tool_response: { body: makeBody(1000) }
  });
  const result = await runHook(payload);
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
});

// tool_response as string → works
test("tool_response as plain string: string body used as fallback", async () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_name: "Agent",
    cwd: process.cwd(),
    tool_response: makeBody(1000)
  });
  const result = await runHook(payload);
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
});

// AC-4: decision is always "approve", never "block"
test("AC-4: output decision is always approve, never block", async () => {
  const result = await runHook(makeStdin(makeBody(2000)));
  assert.equal(result.exitCode, 0);
  if (result.stdout !== "") {
    const parsed = JSON.parse(result.stdout);
    assert.notEqual(parsed.decision, "block");
    assert.equal(parsed.decision, "approve");
  }
});

// ── Pure library unit tests ───────────────────────────────────────────────────

// parseThreshold
test("parseThreshold: undefined returns default 512", () => {
  assert.equal(parseThreshold(undefined), 512);
});

test('parseThreshold: "" returns default 512', () => {
  assert.equal(parseThreshold(""), 512);
});

test('parseThreshold: "0" returns 0', () => {
  assert.equal(parseThreshold("0"), 0);
});

test('parseThreshold: "2048" returns 2048', () => {
  assert.equal(parseThreshold("2048"), 2048);
});

test("parseThreshold: non-numeric string returns default 512", () => {
  assert.equal(parseThreshold("banana"), 512);
});

test("parseThreshold: custom default used when value is undefined", () => {
  assert.equal(parseThreshold(undefined, 1024), 1024);
});

test("parseThreshold: non-numeric with custom default returns custom default", () => {
  assert.equal(parseThreshold("abc", 256), 256);
});

// hasArtifactPath
test("hasArtifactPath: POSIX handoffs path → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/handoffs/foo.md"));
});

test("hasArtifactPath: Windows handoffs path → true", () => {
  assert.ok(hasArtifactPath(".claude\\artifacts\\crew\\handoffs\\foo.md"));
});

test("hasArtifactPath: reviews subdir → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/reviews/review-result.md"));
});

test("hasArtifactPath: validations subdir → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/validations/val.md"));
});

test("hasArtifactPath: deployments subdir → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/deployments/dep.md"));
});

test("hasArtifactPath: runs subdir → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/runs/run.md"));
});

test("hasArtifactPath: cost subdir → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/cost/cost.md"));
});

test("hasArtifactPath: cost-insights subdir → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/cost-insights/ci.md"));
});

test("hasArtifactPath: agents subdir → true", () => {
  assert.ok(hasArtifactPath(".claude/artifacts/crew/agents/a.md"));
});

test("hasArtifactPath: random text → false", () => {
  assert.ok(!hasArtifactPath("nothing useful here"));
});

test("hasArtifactPath: path embedded in surrounding text → true", () => {
  assert.ok(
    hasArtifactPath(
      "see the report at C:\\work\\mega\\hero-crew\\.claude/artifacts/crew/handoffs/20260601T123456Z-handoff-foo.md for details"
    )
  );
});

test("hasArtifactPath: wrong subdir → false", () => {
  assert.ok(!hasArtifactPath(".claude/artifacts/crew/other/foo.md"));
});

// checkSubagentReturn
test("checkSubagentReturn: body ≤ threshold → no warnings", () => {
  const { warnings } = checkSubagentReturn({ body: "x".repeat(100), threshold: 512 });
  assert.equal(warnings.length, 0);
});

test("checkSubagentReturn: body > threshold WITH artifact path → no warnings", () => {
  const body = "x".repeat(600) + " .claude/artifacts/crew/handoffs/foo.md";
  const { warnings } = checkSubagentReturn({ body, threshold: 512 });
  assert.equal(warnings.length, 0);
});

test("checkSubagentReturn: body > threshold WITHOUT artifact path → one warning", () => {
  const body = "x".repeat(600);
  const { warnings } = checkSubagentReturn({ body, threshold: 512 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /cost-discipline rule #2/);
  assert.ok(warnings[0]!.includes("600"), `Expected byte count in warn: ${warnings[0]!}`);
});

test("checkSubagentReturn: threshold=0 means body > 0 threshold is never triggered from check level (caller exits before)", () => {
  // When threshold=0, byteLen > 0 is always true, but hasArtifactPath is false for plain text
  // This is the edge case: threshold=0 semantics are "caller exits early" per hook, but
  // the pure function itself would still warn — confirm the library behavior
  const body = "x".repeat(10);
  const { warnings } = checkSubagentReturn({ body, threshold: 0 });
  // With threshold 0, any non-empty body without path warns (library is pure; hook exits before calling this)
  assert.equal(warnings.length, 1);
});

test("checkSubagentReturn: UTF-8 multi-byte characters measured by byte length", () => {
  // "é" is 2 bytes in UTF-8; repeat 300 times = 600 bytes but 300 chars
  const body = "é".repeat(300);
  const byteLen = Buffer.byteLength(body, "utf8");
  assert.ok(byteLen > 512, `Expected >512 bytes, got ${byteLen}`);
  const { warnings } = checkSubagentReturn({ body, threshold: 512 });
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]!.includes(String(byteLen)));
});

// ── parseUsageMetrics ─────────────────────────────────────────────────────────

test("parseUsageMetrics: full <usage> block → all three fields parsed", () => {
  const body =
    "Handoff: path/to/file.md\n<usage>total_tokens: 8500 tool_uses: 32 duration_ms: 120000</usage>";
  const m = parseUsageMetrics(body);
  assert.equal(m.totalTokens, 8500);
  assert.equal(m.toolUses, 32);
  assert.equal(m.durationMs, 120000);
});

test("parseUsageMetrics: no <usage> block → all zeros", () => {
  const m = parseUsageMetrics("No usage info here at all.");
  assert.equal(m.totalTokens, 0);
  assert.equal(m.toolUses, 0);
  assert.equal(m.durationMs, 0);
});

test("parseUsageMetrics: only total_tokens present → others zero", () => {
  const m = parseUsageMetrics("<usage>total_tokens: 300</usage>");
  assert.equal(m.totalTokens, 300);
  assert.equal(m.toolUses, 0);
  assert.equal(m.durationMs, 0);
});

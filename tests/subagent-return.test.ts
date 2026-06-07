// tests/subagent-return.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";
import {
  parseThreshold,
  hasArtifactPath,
  checkSubagentReturn
} from "../scripts/lib/subagent-return/check.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(__dirname, "..", "hooks", "check-subagent-return.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * @param {string} stdin
 * @param {Record<string, string>} env
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runHook(
  stdin: string,
  env: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", HOOK_PATH], {
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

/**
 * Build a PostToolUse Agent stdin payload with the given body.
 *
 * @param {string} body  — the subagent return body
 * @param {string} [cwd]
 * @returns {string}
 */
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

// AC-9: body > threshold WITHOUT artifact path → warn with byte count + cost-discipline rule #2
test("AC-9: body > threshold (1000 bytes) WITHOUT artifact path → warn", async () => {
  const body = makeBody(1000);
  const result = await runHook(makeStdin(body));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /cost-discipline rule #2/);
  assert.match(parsed.systemMessage, /1000/);
});

// AC-5: CREW_SUBAGENT_INLINE_THRESHOLD=0 → short-circuit (silent even on large body without path)
test("AC-5: CREW_SUBAGENT_INLINE_THRESHOLD=0 → silent even on large body", async () => {
  const result = await runHook(makeStdin(makeBody(5000)), {
    CREW_SUBAGENT_INLINE_THRESHOLD: "0"
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// AC-10: CREW_SUBAGENT_INLINE_THRESHOLD=2048 → body=1500 silent; body=2500 warn
test("AC-10a: CREW_SUBAGENT_INLINE_THRESHOLD=2048 + body=1500 → silent", async () => {
  const result = await runHook(makeStdin(makeBody(1500)), {
    CREW_SUBAGENT_INLINE_THRESHOLD: "2048"
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("AC-10b: CREW_SUBAGENT_INLINE_THRESHOLD=2048 + body=2500 → warn", async () => {
  const result = await runHook(makeStdin(makeBody(2500)), {
    CREW_SUBAGENT_INLINE_THRESHOLD: "2048"
  });
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /cost-discipline rule #2/);
});

// AC-6: Default-on — unset env var with body=1000 no path → warn
test("AC-6: default-on — no env var set + body=1000 no path → warn", async () => {
  // Build env without CREW_SUBAGENT_INLINE_THRESHOLD
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k !== "CREW_SUBAGENT_INLINE_THRESHOLD")
  );
  const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>(
    (resolve) => {
      const proc = spawn("node", ["--experimental-strip-types", HOOK_PATH], { env: cleanEnv });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
      proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
      proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
      proc.stdin.end(makeStdin(makeBody(1000)));
    }
  );
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

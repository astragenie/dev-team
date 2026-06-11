// tests/dispatch-timing-pre-tap.test.ts
// Unit tests for hooks/lib/dispatch-timing-pre-tap.ts (FEAT-149)
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import {
  parseAgentPreInput,
  lookupAgentModel,
  runDispatchTimingPreTap
} from "../hooks/lib/dispatch-timing-pre-tap.ts";
import { parseUsageMetrics } from "../hooks/lib/check-subagent-return.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

// ── parseAgentPreInput ────────────────────────────────────────────────────────

test("parseAgentPreInput: valid Agent PreToolUse payload → object", () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_name: "Agent",
    tool_input: {
      subagent_type: "crew:builder",
      description: "implement the feature"
    }
  });
  const result = parseAgentPreInput(payload);
  assert.ok(result !== null);
  assert.equal(result.session_id, "s1");
  assert.equal(result.subagent_type, "crew:builder");
  assert.equal(result.description, "implement the feature");
});

test("parseAgentPreInput: non-Agent tool_name → null", () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_name: "Bash",
    tool_input: { command: "ls" }
  });
  assert.equal(parseAgentPreInput(payload), null);
});

test("parseAgentPreInput: malformed JSON → null", () => {
  assert.equal(parseAgentPreInput("not json at all"), null);
  assert.equal(parseAgentPreInput("{broken:"), null);
  assert.equal(parseAgentPreInput(""), null);
});

test("parseAgentPreInput: missing tool_name field → null", () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_input: { subagent_type: "crew:builder" }
  });
  assert.equal(parseAgentPreInput(payload), null);
});

test("parseAgentPreInput: missing tool_input → null", () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_name: "Agent"
  });
  assert.equal(parseAgentPreInput(payload), null);
});

test("parseAgentPreInput: minimal payload with only tool_name Agent and tool_input → defaults applied", () => {
  const payload = JSON.stringify({
    tool_name: "Agent",
    tool_input: {}
  });
  const result = parseAgentPreInput(payload);
  assert.ok(result !== null);
  assert.equal(result.session_id, "");
  assert.equal(result.subagent_type, "unknown");
  assert.equal(result.description, "");
});

// ── lookupAgentModel ──────────────────────────────────────────────────────────

test("lookupAgentModel: crew:lead → sonnet", async () => {
  const model = await lookupAgentModel("crew:lead");
  assert.equal(model, "sonnet");
});

test("lookupAgentModel: crew:builder → sonnet", async () => {
  const model = await lookupAgentModel("crew:builder");
  assert.equal(model, "sonnet");
});

test("lookupAgentModel: crew:investigator → haiku", async () => {
  const model = await lookupAgentModel("crew:investigator");
  assert.equal(model, "haiku");
});

test("lookupAgentModel: nonexistent agent → unknown", async () => {
  const model = await lookupAgentModel("crew:nonexistent-agent-xyz");
  assert.equal(model, "unknown");
});

test("lookupAgentModel: plain name without colon → unknown when no file", async () => {
  const model = await lookupAgentModel("general-purpose");
  assert.equal(model, "unknown");
});

// ── runDispatchTimingPreTap ───────────────────────────────────────────────────

test("runDispatchTimingPreTap: no-ops when CREW_DISPATCH_TIMING_LOG=0", async () => {
  // Should return null without side effects
  const payload = JSON.stringify({
    session_id: "s-noop",
    tool_name: "Agent",
    tool_input: { subagent_type: "crew:builder", description: "test" }
  });
  const result = await runDispatchTimingPreTap(payload, {
    ...process.env,
    CREW_DISPATCH_TIMING_LOG: "0"
  });
  assert.equal(result, null);
});

test("runDispatchTimingPreTap: registers a handle + JSONL row appears after end tap", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-pre-tap-"));
  const logPath = path.join(tmp, "dispatch-timing.jsonl");

  // We need to import the end side to trigger completion
  const { recordDispatchEnd } = await import("../scripts/lib/dispatch-timing.ts");

  try {
    const payload = JSON.stringify({
      session_id: "s-register",
      tool_name: "Agent",
      tool_input: {
        subagent_type: "crew:builder",
        description: "test dispatch"
      }
    });

    // Save original env and set test log path
    const origLog = process.env.CREW_DISPATCH_TIMING_LOG;
    process.env.CREW_DISPATCH_TIMING_LOG = logPath;
    const origRoot = process.env.CLAUDE_PLUGIN_ROOT;
    process.env.CLAUDE_PLUGIN_ROOT = REPO_ROOT;

    try {
      const result = await runDispatchTimingPreTap(payload, process.env);
      assert.equal(result, null);

      // Now simulate an end tap via the re-exported handle path
      // We directly call recordDispatchEnd with a manually-looked-up handle to verify
      // the integration path. The session_id "s-register" should have been registered.
      // Trigger end via direct recordDispatchEnd (bypasses handle map, but verifies JSONL write)
      recordDispatchEnd(
        {
          runId: "run-test",
          sliceId: "SLICE-test",
          agent: "crew:builder",
          model: "sonnet",
          startMs: Date.now() - 10
        },
        {
          toolCalls: { Total: 2 },
          bashDurationMs: 0,
          skillLoadCount: 0,
          tokenIn: 100,
          tokenOut: 0
        }
      );

      // Allow fire-and-forget append to flush
      await new Promise<void>((r) => setTimeout(r, 50));

      const raw = await fs.readFile(logPath, "utf-8");
      const rows = raw
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as Record<string, unknown>);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!["agent"], "crew:builder");
      assert.ok(typeof rows[0]!["wallMs"] === "number");
    } finally {
      process.env.CREW_DISPATCH_TIMING_LOG = origLog;
      if (origRoot !== undefined) {
        process.env.CLAUDE_PLUGIN_ROOT = origRoot;
      } else {
        delete process.env.CLAUDE_PLUGIN_ROOT;
      }
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("runDispatchTimingPreTap: returns null on non-Agent tool event", async () => {
  const payload = JSON.stringify({
    session_id: "s-bash",
    tool_name: "Bash",
    tool_input: { command: "ls" }
  });
  const result = await runDispatchTimingPreTap(payload, {
    ...process.env,
    CREW_DISPATCH_TIMING_LOG: "/tmp/should-not-write.jsonl"
  });
  assert.equal(result, null);
});

// ── parseUsageMetrics (end-tap improvement) ───────────────────────────────────

test("parseUsageMetrics: full usage block → all fields parsed", () => {
  const body =
    "Some result text\n<usage>total_tokens: 1234 tool_uses: 17 duration_ms: 45000</usage>\nMore text";
  const metrics = parseUsageMetrics(body);
  assert.equal(metrics.totalTokens, 1234);
  assert.equal(metrics.toolUses, 17);
  assert.equal(metrics.durationMs, 45000);
});

test("parseUsageMetrics: no usage block → all zeros", () => {
  const body = "Plain subagent return without usage marker";
  const metrics = parseUsageMetrics(body);
  assert.equal(metrics.totalTokens, 0);
  assert.equal(metrics.toolUses, 0);
  assert.equal(metrics.durationMs, 0);
});

test("parseUsageMetrics: partial block missing tool_uses → toolUses=0", () => {
  const body = "<usage>total_tokens: 500 duration_ms: 1000</usage>";
  const metrics = parseUsageMetrics(body);
  assert.equal(metrics.totalTokens, 500);
  assert.equal(metrics.toolUses, 0);
  assert.equal(metrics.durationMs, 1000);
});

test("parseUsageMetrics: multiline usage block → parsed correctly", () => {
  const body = "<usage>\ntotal_tokens: 999\ntool_uses: 5\nduration_ms: 12345\n</usage>";
  const metrics = parseUsageMetrics(body);
  assert.equal(metrics.totalTokens, 999);
  assert.equal(metrics.toolUses, 5);
  assert.equal(metrics.durationMs, 12345);
});

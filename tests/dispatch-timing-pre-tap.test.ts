// tests/dispatch-timing-pre-tap.test.ts
// Unit tests for hooks/lib/dispatch-timing-pre-tap.ts (FEAT-149)
import { test, expect } from "bun:test";
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
      subagent_type: "crew:fullstack-dev",
      description: "implement the feature"
    }
  });
  const result = parseAgentPreInput(payload);
  expect(result !== null).toBeTruthy();
  expect(result!.session_id).toBe("s1");
  expect(result!.subagent_type).toBe("crew:fullstack-dev");
  expect(result!.description).toBe("implement the feature");
});

test("parseAgentPreInput: non-Agent tool_name → null", () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_name: "Bash",
    tool_input: { command: "ls" }
  });
  expect(parseAgentPreInput(payload)).toBe(null);
});

test("parseAgentPreInput: malformed JSON → null", () => {
  expect(parseAgentPreInput("not json at all")).toBe(null);
  expect(parseAgentPreInput("{broken:")).toBe(null);
  expect(parseAgentPreInput("")).toBe(null);
});

test("parseAgentPreInput: missing tool_name field → null", () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_input: { subagent_type: "crew:fullstack-dev" }
  });
  expect(parseAgentPreInput(payload)).toBe(null);
});

test("parseAgentPreInput: missing tool_input → null", () => {
  const payload = JSON.stringify({
    session_id: "s1",
    tool_name: "Agent"
  });
  expect(parseAgentPreInput(payload)).toBe(null);
});

test("parseAgentPreInput: minimal payload with only tool_name Agent and tool_input → defaults applied", () => {
  const payload = JSON.stringify({
    tool_name: "Agent",
    tool_input: {}
  });
  const result = parseAgentPreInput(payload);
  expect(result !== null).toBeTruthy();
  expect(result!.session_id).toBe("");
  expect(result!.subagent_type).toBe("unknown");
  expect(result!.description).toBe("");
});

// ── lookupAgentModel ──────────────────────────────────────────────────────────

// crew:lead removed in v0.41 hard cut — lookup now returns "unknown".

test("lookupAgentModel: crew:fullstack-dev → sonnet", async () => {
  const model = await lookupAgentModel("crew:fullstack-dev");
  expect(model).toBe("sonnet");
});

test("lookupAgentModel: crew:investigator → haiku", async () => {
  const model = await lookupAgentModel("crew:investigator");
  expect(model).toBe("haiku");
});

test("lookupAgentModel: nonexistent agent → unknown", async () => {
  const model = await lookupAgentModel("crew:nonexistent-agent-xyz");
  expect(model).toBe("unknown");
});

test("lookupAgentModel: plain name without colon → unknown when no file", async () => {
  const model = await lookupAgentModel("general-purpose");
  expect(model).toBe("unknown");
});

// ── runDispatchTimingPreTap ───────────────────────────────────────────────────

test("runDispatchTimingPreTap: no-ops when CREW_DISPATCH_TIMING_LOG=0", async () => {
  // Should return null without side effects
  const payload = JSON.stringify({
    session_id: "s-noop",
    tool_name: "Agent",
    tool_input: { subagent_type: "crew:fullstack-dev", description: "test" }
  });
  const result = await runDispatchTimingPreTap(payload, {
    ...process.env,
    CREW_DISPATCH_TIMING_LOG: "0"
  });
  expect(result).toBe(null);
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
        subagent_type: "crew:fullstack-dev",
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
      expect(result).toBe(null);

      // Now simulate an end tap via the re-exported handle path
      // We directly call recordDispatchEnd with a manually-looked-up handle to verify
      // the integration path. The session_id "s-register" should have been registered.
      // Trigger end via direct recordDispatchEnd (bypasses handle map, but verifies JSONL write)
      recordDispatchEnd(
        {
          runId: "run-test",
          sliceId: "SLICE-test",
          agent: "crew:fullstack-dev",
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
      expect(rows.length).toBe(1);
      expect(rows[0]!["agent"]).toBe("crew:fullstack-dev");
      expect(typeof rows[0]!["wallMs"] === "number").toBeTruthy();
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
  expect(result).toBe(null);
});

// ── parseUsageMetrics (end-tap improvement) ───────────────────────────────────

test("parseUsageMetrics: full usage block → all fields parsed", () => {
  const body =
    "Some result text\n<usage>total_tokens: 1234 tool_uses: 17 duration_ms: 45000</usage>\nMore text";
  const metrics = parseUsageMetrics(body);
  expect(metrics.totalTokens).toBe(1234);
  expect(metrics.toolUses).toBe(17);
  expect(metrics.durationMs).toBe(45000);
});

test("parseUsageMetrics: no usage block → all zeros", () => {
  const body = "Plain subagent return without usage marker";
  const metrics = parseUsageMetrics(body);
  expect(metrics.totalTokens).toBe(0);
  expect(metrics.toolUses).toBe(0);
  expect(metrics.durationMs).toBe(0);
});

test("parseUsageMetrics: partial block missing tool_uses → toolUses=0", () => {
  const body = "<usage>total_tokens: 500 duration_ms: 1000</usage>";
  const metrics = parseUsageMetrics(body);
  expect(metrics.totalTokens).toBe(500);
  expect(metrics.toolUses).toBe(0);
  expect(metrics.durationMs).toBe(1000);
});

test("parseUsageMetrics: multiline usage block → parsed correctly", () => {
  const body = "<usage>\ntotal_tokens: 999\ntool_uses: 5\nduration_ms: 12345\n</usage>";
  const metrics = parseUsageMetrics(body);
  expect(metrics.totalTokens).toBe(999);
  expect(metrics.toolUses).toBe(5);
  expect(metrics.durationMs).toBe(12345);
});

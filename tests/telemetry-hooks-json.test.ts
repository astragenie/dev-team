/**
 * Tests for hooks/hooks.json — AC-8: wire three new OTel hook entries.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOKS_JSON_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "hooks",
  "hooks.json"
);

type HookEntry = { type: string; command: string };
type HookGroup = { matcher?: string; hooks: HookEntry[] };
type HooksJson = { hooks: Record<string, HookGroup[]> };

test("hooks.json: baseline entries present", async () => {
  const raw = await fs.readFile(HOOKS_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as HooksJson;

  // SessionStart baseline
  assert.ok(data.hooks["SessionStart"], "SessionStart must exist");
  const sessionStartCmds =
    data.hooks["SessionStart"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  assert.ok(
    sessionStartCmds.some((c) => c.includes("log_event.sh") && c.includes("session_start")),
    "SessionStart log_event.sh entry must be present"
  );

  // SubagentStop baseline: log_event.sh still there
  assert.ok(data.hooks["SubagentStop"], "SubagentStop must exist");
  const subagentStopCmds =
    data.hooks["SubagentStop"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  assert.ok(
    subagentStopCmds.some((c) => c.includes("log_event.sh") && c.includes("subagent_stop")),
    "SubagentStop baseline log_event.sh entry must be preserved"
  );

  // PostToolUse existing entries: Bash gate, Read record, Agent check
  assert.ok(data.hooks["PostToolUse"], "PostToolUse must exist");
  const postToolUseCmds =
    data.hooks["PostToolUse"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  assert.ok(
    postToolUseCmds.some((c) => c.includes("post-tool-use-bash-gate.ts")),
    "PostToolUse Bash gate entry must be preserved"
  );
  assert.ok(
    postToolUseCmds.some((c) => c.includes("record-read-content.ts")),
    "PostToolUse Read record entry must be preserved"
  );
});

test("hooks.json: new OTel PostToolUse entry (no matcher)", async () => {
  const raw = await fs.readFile(HOOKS_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as HooksJson;

  const postToolUseGroups = data.hooks["PostToolUse"] ?? [];
  const otelGroup = postToolUseGroups.find(
    (g) => !g.matcher && g.hooks.some((h) => h.command.includes("otel-post-tool-use.ts"))
  );
  assert.ok(otelGroup !== undefined, "PostToolUse must have a no-matcher OTel entry");
  assert.ok(
    otelGroup.hooks.some((h) => h.command.includes("otel-post-tool-use.ts")),
    "OTel PostToolUse entry command must reference otel-post-tool-use.ts"
  );
});

test("hooks.json: new Stop OTel entry", async () => {
  const raw = await fs.readFile(HOOKS_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as HooksJson;

  assert.ok(data.hooks["Stop"], "Stop top-level key must exist");
  const stopCmds = data.hooks["Stop"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  assert.ok(
    stopCmds.some((c) => c.includes("otel-stop.ts")),
    "Stop hooks must contain otel-stop.ts command"
  );
});

test("hooks.json: SubagentStop second entry for OTel", async () => {
  const raw = await fs.readFile(HOOKS_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as HooksJson;

  const subagentStopCmds =
    data.hooks["SubagentStop"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];

  // Must retain original log_event.sh
  assert.ok(
    subagentStopCmds.some((c) => c.includes("log_event.sh") && c.includes("subagent_stop")),
    "SubagentStop must still have log_event.sh command"
  );
  // Must add OTel shim
  assert.ok(
    subagentStopCmds.some((c) => c.includes("otel-subagent-stop.ts")),
    "SubagentStop must have new otel-subagent-stop.ts command"
  );
});

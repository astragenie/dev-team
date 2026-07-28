/**
 * Tests for hooks/hooks.json — AC-8: wire three new OTel hook entries.
 */
import { test, expect } from "bun:test";
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
  expect(data.hooks["SessionStart"], "SessionStart must exist").toBeTruthy();
  const sessionStartCmds =
    data.hooks["SessionStart"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  expect(
    sessionStartCmds.some((c) => c.includes("log_event.sh") && c.includes("session_start")),
    "SessionStart log_event.sh entry must be present"
  ).toBeTruthy();

  // SubagentStop baseline: log_event.sh still there
  expect(data.hooks["SubagentStop"], "SubagentStop must exist").toBeTruthy();
  const subagentStopCmds =
    data.hooks["SubagentStop"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  expect(
    subagentStopCmds.some((c) => c.includes("log_event.sh") && c.includes("subagent_stop")),
    "SubagentStop baseline log_event.sh entry must be preserved"
  ).toBeTruthy();

  // PostToolUse existing entries: Bash gate, Read record, Agent check
  expect(data.hooks["PostToolUse"], "PostToolUse must exist").toBeTruthy();
  const postToolUseCmds =
    data.hooks["PostToolUse"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  expect(
    postToolUseCmds.some((c) => c.includes("post-tool-use-bash-gate.ts")),
    "PostToolUse Bash gate entry must be preserved"
  ).toBeTruthy();
  expect(
    postToolUseCmds.some((c) => c.includes("record-read-content.ts")),
    "PostToolUse Read record entry must be preserved"
  ).toBeTruthy();
});

test("hooks.json: new OTel PostToolUse entry (no matcher)", async () => {
  const raw = await fs.readFile(HOOKS_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as HooksJson;

  const postToolUseGroups = data.hooks["PostToolUse"] ?? [];
  const otelGroup = postToolUseGroups.find(
    (g) => !g.matcher && g.hooks.some((h) => h.command.includes("otel-post-tool-use.ts"))
  );
  expect(otelGroup !== undefined, "PostToolUse must have a no-matcher OTel entry").toBeTruthy();
  expect(
    otelGroup!.hooks.some((h) => h.command.includes("otel-post-tool-use.ts")),
    "OTel PostToolUse entry command must reference otel-post-tool-use.ts"
  ).toBeTruthy();
});

test("hooks.json: new Stop OTel entry", async () => {
  const raw = await fs.readFile(HOOKS_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as HooksJson;

  expect(data.hooks["Stop"], "Stop top-level key must exist").toBeTruthy();
  const stopCmds = data.hooks["Stop"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];
  expect(
    stopCmds.some((c) => c.includes("otel-stop.ts")),
    "Stop hooks must contain otel-stop.ts command"
  ).toBeTruthy();
});

test("hooks.json: SubagentStop second entry for OTel", async () => {
  const raw = await fs.readFile(HOOKS_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as HooksJson;

  const subagentStopCmds =
    data.hooks["SubagentStop"]?.flatMap((g) => g.hooks.map((h) => h.command)) ?? [];

  // Must retain original log_event.sh
  expect(
    subagentStopCmds.some((c) => c.includes("log_event.sh") && c.includes("subagent_stop")),
    "SubagentStop must still have log_event.sh command"
  ).toBeTruthy();
  // Must add OTel shim
  expect(
    subagentStopCmds.some((c) => c.includes("otel-subagent-stop.ts")),
    "SubagentStop must have new otel-subagent-stop.ts command"
  ).toBeTruthy();
});

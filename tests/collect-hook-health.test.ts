// tests/collect-hook-health.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function makeRepo(events: Array<Record<string, string>>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-health-"));
  const logsDir = path.join(dir, ".claude", "logs");
  await fs.mkdir(logsDir, { recursive: true });
  const lines = events.map((e: Record<string, string>) => JSON.stringify(e)).join("\n") + "\n";
  await fs.writeFile(path.join(logsDir, "events.jsonl"), lines, "utf8");
  return dir;
}

import { collectHookHealth } from "../scripts/lib/briefing/collect.ts";

test("collectHookHealth returns empty hooks array when no events.jsonl", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-health-empty-"));
  const result = await collectHookHealth(dir);
  assert.deepEqual(
    result.hooks.map((h) => h.errorCount24h),
    [0, 0, 0, 0]
  );
  await fs.rm(dir, { recursive: true, force: true });
});

test("collectHookHealth counts hook_error events per hook in last 24h", async () => {
  const now = new Date();
  const recent = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const old = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
  const dir = await makeRepo([
    { ts: recent, type: "hook_error", hook: "preflight-shell", error: "oops" },
    { ts: recent, type: "hook_error", hook: "preflight-shell", error: "again" },
    { ts: old, type: "hook_error", hook: "check-redundant-read", error: "old" },
    { ts: recent, type: "other_event", hook: "preflight-shell", error: "ignored" }
  ]);
  const result = await collectHookHealth(dir);
  const ps = result.hooks.find((h) => h.name === "preflight-shell");
  assert.ok(ps, "must include preflight-shell");
  assert.equal(ps.errorCount24h, 2);
  const crr = result.hooks.find((h) => h.name === "check-redundant-read");
  assert.ok(!crr || crr.errorCount24h === 0, "old events must be excluded");
  await fs.rm(dir, { recursive: true, force: true });
});

test("collectHookHealth marks hooks with errors as yellow", async () => {
  const ts = new Date().toISOString();
  const dir = await makeRepo([
    { ts, type: "hook_error", hook: "record-read-content", error: "err" }
  ]);
  const result = await collectHookHealth(dir);
  const h = result.hooks.find((h) => h.name === "record-read-content");
  assert.ok(h, "must find hook");
  assert.equal(h.status, "yellow");
  await fs.rm(dir, { recursive: true, force: true });
});

test("collectHookHealth returns green status for hooks with no errors", async () => {
  const ts = new Date().toISOString();
  const dir = await makeRepo([
    { ts, type: "hook_error", hook: "check-subagent-return", error: "err" }
  ]);
  const result = await collectHookHealth(dir);
  const noErrors = result.hooks.filter((h) => h.errorCount24h === 0);
  noErrors.forEach((h) => assert.equal(h.status, "green"));
  await fs.rm(dir, { recursive: true, force: true });
});

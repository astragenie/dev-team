// tests/hook-error-events.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function parseEvents(dir) {
  const p = path.join(dir, ".claude", "logs", "events.jsonl");
  try {
    const text = await fs.readFile(p, "utf8");
    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

import { logHookError } from "../hooks/hook-error.mjs";

test("logHookError emits structured hook_error event to events.jsonl", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-err-"));
  await logHookError(dir, "check-redundant-read", new Error("test error"));
  const events = await parseEvents(dir);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "hook_error");
  assert.equal(events[0].hook, "check-redundant-read");
  assert.match(events[0].error, /test error/);
  assert.ok(events[0].ts, "must have timestamp");
  await fs.rm(dir, { recursive: true, force: true });
});

test("logHookError does not throw when logs dir does not exist", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-err2-"));
  await assert.doesNotReject(() => logHookError(dir, "preflight-shell", new Error("oops")));
  await fs.rm(dir, { recursive: true, force: true });
});

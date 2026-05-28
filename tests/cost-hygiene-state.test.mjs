// tests/cost-hygiene-state.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadSession, saveSession } from "../scripts/lib/cost-hygiene/state.mjs";

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-"));
}

async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

test("loadSession returns empty shape when file absent", async () => {
  const repo = await makeRepo();
  try {
    const state = await loadSession(repo, "sess-abc");
    assert.equal(state.session_id, "sess-abc");
    assert.equal(state.total_bytes, 0);
    assert.deepEqual(state.entries, {});
    assert.ok(state.first_seen);
    assert.ok(state.last_seen);
  } finally {
    await cleanup(repo);
  }
});

test("saveSession then loadSession round-trip preserves entries", async () => {
  const repo = await makeRepo();
  try {
    const state = await loadSession(repo, "sess-xyz");
    state.entries["/abs/foo"] = {
      read_count: 2,
      first_read_at: "2026-05-28T18:00:00.000Z",
      last_read_at: "2026-05-28T18:05:00.000Z",
      mtime_at_last_read: "2026-05-28T17:00:00.000Z",
      size_at_last_read: 100,
      content_bytes: 5,
      content: "hello"
    };
    state.total_bytes = 5;
    await saveSession(repo, "sess-xyz", state);
    const reloaded = await loadSession(repo, "sess-xyz");
    assert.equal(reloaded.entries["/abs/foo"].read_count, 2);
    assert.equal(reloaded.entries["/abs/foo"].content, "hello");
    assert.equal(reloaded.total_bytes, 5);
  } finally {
    await cleanup(repo);
  }
});

test("saveSession atomic — no .tmp.<pid> left on success", async () => {
  const repo = await makeRepo();
  try {
    const state = await loadSession(repo, "sess-tmp");
    await saveSession(repo, "sess-tmp", state);
    const dir = path.join(repo, ".claude", "state", "cost-hygiene");
    const files = await fs.readdir(dir);
    const tempFiles = files.filter((f) => f.includes(".tmp."));
    assert.deepEqual(tempFiles, []);
  } finally {
    await cleanup(repo);
  }
});

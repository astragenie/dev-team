// tests/cost-hygiene-state.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadSession,
  saveSession,
  recordRead,
  recordReadContent
} from "../scripts/lib/cost-hygiene/state.mjs";

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

test("recordRead increments read_count, updates last_read_at, preserves first_read_at", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-rec");
    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 100, "2026-05-28T18:00:00.000Z");
    assert.equal(state.entries["/abs/p"].read_count, 1);
    assert.equal(state.entries["/abs/p"].first_read_at, "2026-05-28T18:00:00.000Z");

    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 100, "2026-05-28T18:05:00.000Z");
    assert.equal(state.entries["/abs/p"].read_count, 2);
    assert.equal(state.entries["/abs/p"].first_read_at, "2026-05-28T18:00:00.000Z");
    assert.equal(state.entries["/abs/p"].last_read_at, "2026-05-28T18:05:00.000Z");
  } finally {
    await cleanup(repo);
  }
});

test("recordReadContent stores content when <=50KB, updates total_bytes", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-cnt");
    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 5, "2026-05-28T18:00:00.000Z");
    state = recordReadContent(state, "/abs/p", "hello");
    assert.equal(state.entries["/abs/p"].content, "hello");
    assert.equal(state.entries["/abs/p"].content_bytes, 5);
    assert.equal(state.total_bytes, 5);
  } finally {
    await cleanup(repo);
  }
});

test("recordReadContent caps content at 50KB, sets content:null when oversized", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-big");
    const big = "x".repeat(60_000);
    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 60_000, "2026-05-28T18:00:00.000Z");
    state = recordReadContent(state, "/abs/p", big);
    assert.equal(state.entries["/abs/p"].content, null);
    assert.equal(state.entries["/abs/p"].content_bytes, 0);
    assert.equal(state.total_bytes, 0);
  } finally {
    await cleanup(repo);
  }
});

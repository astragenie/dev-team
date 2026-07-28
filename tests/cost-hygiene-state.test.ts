// tests/cost-hygiene-state.test.mjs
import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadSession,
  saveSession,
  recordRead,
  recordReadContent,
  evictLRU
} from "../scripts/lib/cost-hygiene/state.ts";

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-"));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

test("loadSession returns empty shape when file absent", async () => {
  const repo = await makeRepo();
  try {
    const state = await loadSession(repo, "sess-abc");
    expect(state.session_id).toBe("sess-abc");
    expect(state.total_bytes).toBe(0);
    expect(state.entries).toEqual({});
    expect(state.first_seen).toBeTruthy();
    expect(state.last_seen).toBeTruthy();
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
    expect(reloaded.entries["/abs/foo"]!.read_count).toBe(2);
    expect(reloaded.entries["/abs/foo"]!.content).toBe("hello");
    expect(reloaded.total_bytes).toBe(5);
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
    expect(tempFiles).toEqual([]);
  } finally {
    await cleanup(repo);
  }
});

test("recordRead increments read_count, updates last_read_at, preserves first_read_at", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-rec");
    state = recordRead(
      state,
      "/abs/p",
      "2026-05-28T17:00:00.000Z",
      100,
      "2026-05-28T18:00:00.000Z"
    );
    expect(state.entries["/abs/p"]!.read_count).toBe(1);
    expect(state.entries["/abs/p"]!.first_read_at).toBe("2026-05-28T18:00:00.000Z");

    state = recordRead(
      state,
      "/abs/p",
      "2026-05-28T17:00:00.000Z",
      100,
      "2026-05-28T18:05:00.000Z"
    );
    expect(state.entries["/abs/p"]!.read_count).toBe(2);
    expect(state.entries["/abs/p"]!.first_read_at).toBe("2026-05-28T18:00:00.000Z");
    expect(state.entries["/abs/p"]!.last_read_at).toBe("2026-05-28T18:05:00.000Z");
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
    expect(state.entries["/abs/p"]!.content).toBe("hello");
    expect(state.entries["/abs/p"]!.content_bytes).toBe(5);
    expect(state.total_bytes).toBe(5);
  } finally {
    await cleanup(repo);
  }
});

test("recordReadContent caps content at 50KB, sets content:null when oversized", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-big");
    const big = "x".repeat(60_000);
    state = recordRead(
      state,
      "/abs/p",
      "2026-05-28T17:00:00.000Z",
      60_000,
      "2026-05-28T18:00:00.000Z"
    );
    state = recordReadContent(state, "/abs/p", big);
    expect(state.entries["/abs/p"]!.content).toBe(null);
    expect(state.entries["/abs/p"]!.content_bytes).toBe(0); // noUncheckedIndexedAccess
    expect(state.total_bytes).toBe(0);
  } finally {
    await cleanup(repo);
  }
});

test("evictLRU drops least-recently-read on session-cap overflow", () => {
  const state = {
    session_id: "s",
    first_seen: "2026-05-28T18:00:00.000Z",
    last_seen: "2026-05-28T18:00:00.000Z",
    total_bytes: 2_100_000,
    entries: {
      "/a": {
        read_count: 1,
        first_read_at: "2026-05-28T18:00:00.000Z",
        last_read_at: "2026-05-28T18:00:00.000Z",
        mtime_at_last_read: "x",
        size_at_last_read: 0,
        content_bytes: 1_000_000,
        content: "a"
      },
      "/b": {
        read_count: 1,
        first_read_at: "2026-05-28T18:01:00.000Z",
        last_read_at: "2026-05-28T18:01:00.000Z",
        mtime_at_last_read: "x",
        size_at_last_read: 0,
        content_bytes: 600_000,
        content: "b"
      },
      "/c": {
        read_count: 1,
        first_read_at: "2026-05-28T18:02:00.000Z",
        last_read_at: "2026-05-28T18:02:00.000Z",
        mtime_at_last_read: "x",
        size_at_last_read: 0,
        content_bytes: 500_000,
        content: "c"
      }
    }
  };
  const protectedPath = "/c";
  const result = evictLRU(state, protectedPath);
  expect(!("/a" in result.entries), "least-recently-read /a should be evicted").toBeTruthy();
  expect("/c" in result.entries, "currently-being-recorded /c must not be evicted").toBeTruthy();
  expect(result.total_bytes <= 2_000_000).toBeTruthy();
});

test("evictLRU never drops the entry being recorded even if it is the LRU", () => {
  const state = {
    session_id: "s",
    first_seen: "2026-05-28T18:00:00.000Z",
    last_seen: "2026-05-28T18:00:00.000Z",
    total_bytes: 2_100_000,
    entries: {
      "/oldest": {
        read_count: 1,
        first_read_at: "2026-05-28T18:00:00.000Z",
        last_read_at: "2026-05-28T18:00:00.000Z",
        mtime_at_last_read: "x",
        size_at_last_read: 0,
        content_bytes: 1_500_000,
        content: "x"
      },
      "/newer": {
        read_count: 1,
        first_read_at: "2026-05-28T18:05:00.000Z",
        last_read_at: "2026-05-28T18:05:00.000Z",
        mtime_at_last_read: "x",
        size_at_last_read: 0,
        content_bytes: 600_000,
        content: "y"
      }
    }
  };
  const result = evictLRU(state, "/oldest");
  expect("/oldest" in result.entries, "protected /oldest must survive eviction").toBeTruthy();
});

test("loadSession on corrupt JSON returns empty + does not throw", async () => {
  const repo = await makeRepo();
  try {
    const dir = path.join(repo, ".claude", "state", "cost-hygiene");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "sess-corrupt.json"), "{not valid json}", "utf8");
    const state = await loadSession(repo, "sess-corrupt");
    expect(state.session_id).toBe("sess-corrupt");
    expect(state.entries).toEqual({});
  } finally {
    await cleanup(repo);
  }
});

test("loadSession cleans up stale .tmp.<pid> files older than 60s", async () => {
  const repo = await makeRepo();
  try {
    const dir = path.join(repo, ".claude", "state", "cost-hygiene");
    await fs.mkdir(dir, { recursive: true });
    const stale = path.join(dir, "sess-x.json.tmp.99999");
    await fs.writeFile(stale, "{}", "utf8");
    const oldTime = new Date(Date.now() - 120_000);
    await fs.utimes(stale, oldTime, oldTime);
    const fresh = path.join(dir, "sess-x.json.tmp.88888");
    await fs.writeFile(fresh, "{}", "utf8");
    await loadSession(repo, "sess-x");
    const after = await fs.readdir(dir);
    expect(!after.includes("sess-x.json.tmp.99999"), "stale tmp should be deleted").toBeTruthy();
    expect(after.includes("sess-x.json.tmp.88888"), "fresh tmp should remain").toBeTruthy();
  } finally {
    await cleanup(repo);
  }
});

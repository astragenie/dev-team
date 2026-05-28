// tests/cost-hygiene-state.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadSession } from "../scripts/lib/cost-hygiene/state.mjs";

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

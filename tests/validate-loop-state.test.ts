import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkLoopState } from "../scripts/validate-loop-state.ts";

test("clean single tree passes", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "vls-"));
  try {
    const dir = path.join(repo, ".claude/artifacts/loop/backlog/pending");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "FEAT-001.md"), "---\nid: FEAT-001\n---\n");
    assert.deepEqual(await checkLoopState(repo), []);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("flags a second populated tree and duplicate ids", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "vls-"));
  try {
    for (const root of [".claude/artifacts/loop/backlog", "docs/backlog"]) {
      const dir = path.join(repo, root, "pending");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "FEAT-001.md"), "---\nid: FEAT-001\n---\n");
    }
    // duplicate id within the authoritative tree
    const doneDir = path.join(repo, ".claude/artifacts/loop/backlog/done");
    await fs.mkdir(doneDir, { recursive: true });
    await fs.writeFile(path.join(doneDir, "FEAT-001.md"), "---\nid: FEAT-001\n---\n");
    const errors = await checkLoopState(repo);
    assert.ok(
      errors.some((e) => e.includes("docs/backlog")),
      errors.join("; ")
    );
    assert.ok(
      errors.some((e) => e.includes("FEAT-001")),
      errors.join("; ")
    );
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

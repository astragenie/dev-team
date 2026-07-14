// tests/memory-injected-atoms.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { writeInjectedAtoms, readInjectedAtoms } from "../scripts/lib/memory/injected-atoms.ts";

async function tmp(p: string) { return fs.mkdtemp(path.join(os.tmpdir(), p)); }

test("round-trips ids under .claude/state/crew/injected-atoms/<runId>.json", async () => {
  const repo = await tmp("inj-atoms-");
  try {
    await writeInjectedAtoms(repo, "run-1", ["a", "b", "c"]);
    const target = path.join(repo, ".claude", "state", "crew", "injected-atoms", "run-1.json");
    assert.ok(await fs.stat(target));
    assert.deepEqual(await readInjectedAtoms(repo, "run-1"), ["a", "b", "c"]);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("readInjectedAtoms returns [] for a missing run (never throws)", async () => {
  const repo = await tmp("inj-atoms-missing-");
  try { assert.deepEqual(await readInjectedAtoms(repo, "nope"), []); }
  finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("writeInjectedAtoms is fire-and-forget: [] writes an empty list, never throws", async () => {
  const repo = await tmp("inj-atoms-empty-");
  try {
    await writeInjectedAtoms(repo, "run-2", []);
    assert.deepEqual(await readInjectedAtoms(repo, "run-2"), []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

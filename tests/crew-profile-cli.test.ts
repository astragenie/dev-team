// tests/crew-profile-cli.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildProfileBlock } from "../scripts/lib/memory/index.ts";
import { readInjectedAtoms } from "../scripts/lib/memory/injected-atoms.ts";

async function tmp(p: string) { return fs.mkdtemp(path.join(os.tmpdir(), p)); }

test("barrel re-exports buildProfileBlock and injected-atoms/feedback helpers", async () => {
  const mod = await import("../scripts/lib/memory/index.ts");
  assert.equal(typeof mod.buildProfileBlock, "function");
  assert.equal(typeof mod.submitOutcomeFeedback, "function");
  assert.equal(typeof mod.writeInjectedAtoms, "function");
});

test("buildProfileBlock via barrel is byte-silent when disabled (integration guard)", async () => {
  const repo = await tmp("cli-profile-off-");
  try {
    const r = await buildProfileBlock({ repoPath: repo, agent: "crew:reviewer", rawConfig: {} });
    assert.equal(r.block, "");
    assert.deepEqual(await readInjectedAtoms(repo, "any"), []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

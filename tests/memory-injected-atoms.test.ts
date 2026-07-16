// tests/memory-injected-atoms.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
import { writeInjectedAtoms, readInjectedAtoms } from "../scripts/lib/memory/injected-atoms.ts";

async function tmp(p: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), p));
}

test("round-trips ids under .claude/state/crew/injected-atoms/<runId>.json", async () => {
  const repo = await tmp("inj-atoms-");
  try {
    await writeInjectedAtoms(repo, "run-1", ["a", "b", "c"]);
    const target = path.join(repo, ".claude", "state", "crew", "injected-atoms", "run-1.json");
    expect(await fs.stat(target)).toBeTruthy();
    expect(await readInjectedAtoms(repo, "run-1")).toEqual(["a", "b", "c"]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("readInjectedAtoms returns [] for a missing run (never throws)", async () => {
  const repo = await tmp("inj-atoms-missing-");
  try {
    expect(await readInjectedAtoms(repo, "nope")).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("writeInjectedAtoms is fire-and-forget: [] writes an empty list, never throws", async () => {
  const repo = await tmp("inj-atoms-empty-");
  try {
    await writeInjectedAtoms(repo, "run-2", []);
    expect(await readInjectedAtoms(repo, "run-2")).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("writeInjectedAtoms merges across split-builder calls under the same runId (no clobber)", async () => {
  const repo = await tmp("inj-atoms-merge-");
  try {
    await writeInjectedAtoms(repo, "SLICE-NN", ["fe-1", "fe-2"]);
    await writeInjectedAtoms(repo, "SLICE-NN", ["be-1", "be-2"]);
    const ids = await readInjectedAtoms(repo, "SLICE-NN");
    expect([...ids].sort()).toEqual(["be-1", "be-2", "fe-1", "fe-2"]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("writeInjectedAtoms does not duplicate a repeated id across calls", async () => {
  const repo = await tmp("inj-atoms-dedupe-");
  try {
    await writeInjectedAtoms(repo, "run-3", ["a", "b"]);
    await writeInjectedAtoms(repo, "run-3", ["b", "c"]);
    const ids = await readInjectedAtoms(repo, "run-3");
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

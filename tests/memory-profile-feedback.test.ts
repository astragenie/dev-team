import { test, expect } from "bun:test";
// tests/memory-profile-feedback.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { submitOutcomeFeedback } from "../scripts/lib/memory/profile-feedback.ts";
import { writeInjectedAtoms } from "../scripts/lib/memory/injected-atoms.ts";
import type { ProfileCapableProvider } from "../scripts/lib/memory/profile-types.ts";

async function tmp(p: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), p));
}
function recordingProvider(sink: Array<[string, boolean]>): ProfileCapableProvider {
  return {
    async feedback(id, o) {
      sink.push([id, o.used]);
      return true;
    }
  };
}

test("credits every injected atom with used:true on PASS", async () => {
  const repo = await tmp("fb-pass-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a", "b"]);
    const sink: Array<[string, boolean]> = [];
    const r = await submitOutcomeFeedback({
      repoPath: repo,
      runId: "r1",
      outcome: "pass",
      rawConfig: { feedback: { enabled: true } },
      provider: recordingProvider(sink)
    });
    expect(r.credited.sort()).toEqual(["a", "b"]);
    expect(sink.sort()).toEqual([
      ["a", true],
      ["b", true]
    ]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("credits nothing on FAIL (positive-only signal)", async () => {
  const repo = await tmp("fb-fail-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a"]);
    const sink: Array<[string, boolean]> = [];
    const r = await submitOutcomeFeedback({
      repoPath: repo,
      runId: "r1",
      outcome: "fail",
      rawConfig: { feedback: { enabled: true } },
      provider: recordingProvider(sink)
    });
    expect(r.credited).toEqual([]);
    expect(sink).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("no-ops when feedback.enabled is false (default)", async () => {
  const repo = await tmp("fb-off-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a"]);
    const sink: Array<[string, boolean]> = [];
    const r = await submitOutcomeFeedback({
      repoPath: repo,
      runId: "r1",
      outcome: "pass",
      rawConfig: {},
      provider: recordingProvider(sink)
    });
    expect(r.credited).toEqual([]);
    expect(sink).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("fail-silent: a throwing feedback() never rejects", async () => {
  const repo = await tmp("fb-throw-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a"]);
    const throwing: ProfileCapableProvider = {
      async feedback() {
        throw new Error("down");
      }
    };
    const r = await submitOutcomeFeedback({
      repoPath: repo,
      runId: "r1",
      outcome: "pass",
      rawConfig: { feedback: { enabled: true } },
      provider: throwing
    });
    expect(r.credited).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

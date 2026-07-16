// tests/memory-handoff-credit.test.ts — orchestrator-side crediting for the
// OPTIONAL `memories_used` handoff field (dispatch-memory-credit-loop,
// runner-plugin upstream request 2026-07-16). Covers: happy-path batch
// credit, the memory.feedback.creditLoop.enabled kill-switch, malformed/
// absent ids ignored silently, the MAX_CREDIT_BATCH bound, and per-id/
// whole-call fail-silence.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
import { creditMemoriesUsed } from "../scripts/lib/memory/handoff-credit.ts";
import type { ProfileCapableProvider } from "../scripts/lib/memory/profile-types.ts";

async function tmp(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function recordingProvider(sink: Array<[string, boolean]>): ProfileCapableProvider {
  return {
    async feedback(id, o) {
      sink.push([id, o.used]);
      return true;
    }
  };
}

test("credits every reported id via feedback(id, {used:true}) when creditLoop.enabled", async () => {
  const repo = await tmp("credit-on-");
  try {
    const sink: Array<[string, boolean]> = [];
    const r = await creditMemoriesUsed({
      repoPath: repo,
      ids: ["a", "b"],
      rawConfig: { feedback: { creditLoop: { enabled: true } } },
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

test("no-ops when memory.creditLoop.enabled is false (default) — the dedicated kill-switch", async () => {
  const repo = await tmp("credit-off-");
  try {
    const sink: Array<[string, boolean]> = [];
    const r = await creditMemoriesUsed({
      repoPath: repo,
      ids: ["a"],
      rawConfig: {},
      provider: recordingProvider(sink)
    });
    expect(r.credited).toEqual([]);
    expect(sink).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("global memory.enabled:'never' wins even when creditLoop.enabled is true", async () => {
  const repo = await tmp("credit-killswitch-");
  try {
    const r = await creditMemoriesUsed({
      repoPath: repo,
      ids: ["a"],
      rawConfig: { enabled: "never", provider: "file", feedback: { creditLoop: { enabled: true } } }
      // No provider override: exercises the real resolveProvider() gate,
      // which resolves to noopProvider() (no feedback() method) when
      // captureEnabled is false.
    });
    expect(r.credited).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("absent/empty ids credit nothing, never throw", async () => {
  const repo = await tmp("credit-absent-");
  try {
    const sink: Array<[string, boolean]> = [];
    const provider = recordingProvider(sink);
    const r1 = await creditMemoriesUsed({ repoPath: repo, ids: undefined, provider });
    const r2 = await creditMemoriesUsed({ repoPath: repo, ids: [], provider });
    expect(r1.credited).toEqual([]);
    expect(r2.credited).toEqual([]);
    expect(sink).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("malformed ids (non-string entries, blanks) are dropped silently, valid ones still credited", async () => {
  const repo = await tmp("credit-malformed-");
  try {
    const sink: Array<[string, boolean]> = [];
    const r = await creditMemoriesUsed({
      repoPath: repo,
      ids: ["a", 42, null, "", "   ", "b", { id: "c" }],
      rawConfig: { feedback: { creditLoop: { enabled: true } } },
      provider: recordingProvider(sink)
    });
    expect(r.credited.sort()).toEqual(["a", "b"]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("bounds the credit batch at 20 ids even when more are reported", async () => {
  const repo = await tmp("credit-bound-");
  try {
    const sink: Array<[string, boolean]> = [];
    const many = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    const r = await creditMemoriesUsed({
      repoPath: repo,
      ids: many,
      rawConfig: { feedback: { creditLoop: { enabled: true } } },
      provider: recordingProvider(sink)
    });
    expect(r.credited.length).toBe(20);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("provider lacking feedback() resolves to a no-op, never throws", async () => {
  const repo = await tmp("credit-nomethod-");
  try {
    const r = await creditMemoriesUsed({
      repoPath: repo,
      ids: ["a"],
      rawConfig: { feedback: { creditLoop: { enabled: true } } },
      provider: {}
    });
    expect(r.credited).toEqual([]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("fail-silent: a throwing feedback() for one id never rejects and does not block the rest", async () => {
  const repo = await tmp("credit-throw-");
  try {
    const flaky: ProfileCapableProvider = {
      async feedback(id) {
        if (id === "bad") throw new Error("daemon down");
        return true;
      }
    };
    const r = await creditMemoriesUsed({
      repoPath: repo,
      ids: ["bad", "good"],
      rawConfig: { feedback: { creditLoop: { enabled: true } } },
      provider: flaky
    });
    expect(r.credited).toEqual(["good"]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
